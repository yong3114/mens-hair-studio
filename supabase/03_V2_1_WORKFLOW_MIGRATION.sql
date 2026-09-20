-- MEN'S HAIR STUDIO V2.1 — WORKFLOW MIGRATION
-- Run this ONCE on an existing V2.0.x Supabase project BEFORE deploying V2.1.
-- Safe to re-run: statements are written to be idempotent where possible.

-- 1) Leads / customers can begin with only a WhatsApp display name.
alter table public.leads add column if not exists whatsapp_name text;
alter table public.leads alter column name drop not null;
alter table public.customers add column if not exists whatsapp_name text;
alter table public.customers alter column name drop not null;

-- 2) Appointment can be actively in service and remains blocked on the calendar.
alter table public.appointments drop constraint if exists appointments_status_check;
alter table public.appointments add constraint appointments_status_check
check(status in ('tentative','confirmed','in_progress','completed','cancelled','no-show'));

alter table public.appointments drop constraint if exists appointment_no_overlap;
alter table public.appointments add constraint appointment_no_overlap
exclude using gist (
  assigned_user_id with =,
  tstzrange(blocked_start, blocked_end, '[)') with &&
) where (status in ('tentative','confirmed','in_progress'));

-- 3) Service is now a real start -> complete workflow.
alter table public.services add column if not exists status text;
update public.services set status='completed' where status is null;
alter table public.services alter column status set default 'completed';
alter table public.services alter column status set not null;
alter table public.services drop constraint if exists services_status_check;
alter table public.services add constraint services_status_check check(status in ('in_progress','completed','cancelled'));
alter table public.services alter column completed_at drop not null;
alter table public.services alter column completed_at drop default;
create index if not exists services_status_idx on public.services(status);
create index if not exists services_appointment_idx on public.services(appointment_id);

-- 4) Lead conversion supports an explicit customer display name and copies WhatsApp identity.
create or replace function public.convert_lead_to_customer_v2(p_lead_id uuid, p_customer_name text default null) returns uuid
language plpgsql security invoker as $$
declare l public.leads; cid uuid; real_name text;
begin
  select * into l from public.leads where id=p_lead_id for update;
  if not found then raise exception 'Lead not found'; end if;
  real_name := coalesce(nullif(trim(p_customer_name),''), nullif(trim(l.name),''));
  insert into public.customers(name,whatsapp_name,phone,area,notes)
  values(real_name,l.whatsapp_name,l.phone,l.area,l.notes)
  returning id into cid;
  update public.leads set stage='customer', name=coalesce(name,real_name) where id=p_lead_id;
  return cid;
end $$;

-- 5) Start service. A booked service is linked to its appointment.
create or replace function public.start_service(
  p_customer_id uuid,
  p_appointment_id uuid default null,
  p_service_type text default 'Maintenance',
  p_technician_id uuid default null,
  p_started_at timestamptz default now()
) returns uuid
language plpgsql security invoker as $$
declare sid uuid; existing_status text;
begin
  if p_appointment_id is not null then
    select id,status into sid,existing_status
    from public.services
    where appointment_id=p_appointment_id
    order by created_at desc limit 1;
    if found then
      if existing_status='in_progress' then return sid; end if;
      if existing_status='completed' then raise exception 'This appointment already has a completed service'; end if;
    end if;
  end if;

  insert into public.services(customer_id,appointment_id,service_type,technician_id,amount,started_at,completed_at,status)
  values(p_customer_id,p_appointment_id,p_service_type,p_technician_id,0,coalesce(p_started_at,now()),null,'in_progress')
  returning id into sid;

  if p_appointment_id is not null then
    update public.appointments
    set status='in_progress', assigned_user_id=coalesce(p_technician_id,assigned_user_id)
    where id=p_appointment_id and status not in ('completed','cancelled','no-show');
    if not found then raise exception 'Appointment cannot be started'; end if;
  end if;

  return sid;
end $$;

-- 6) Complete either an existing in-progress service or a legacy direct completion.
create or replace function public.complete_service(p_payload jsonb,p_consumptions jsonb default '[]'::jsonb) returns uuid
language plpgsql security invoker as $$
declare
  sid uuid;
  service_status text;
  x jsonb;
  cid uuid;
  q numeric;
  available numeric;
  amount numeric;
  appointment_uuid uuid;
begin
  sid := nullif(p_payload->>'service_id','')::uuid;
  appointment_uuid := nullif(p_payload->>'appointment_id','')::uuid;

  if sid is not null then
    select status into service_status from public.services where id=sid for update;
    if not found then raise exception 'Service not found'; end if;
    if service_status='completed' then raise exception 'Service already completed'; end if;
    if service_status='cancelled' then raise exception 'Cancelled service cannot be completed'; end if;

    update public.services set
      customer_id=(p_payload->>'customer_id')::uuid,
      appointment_id=appointment_uuid,
      service_type=p_payload->>'service_type',
      technician_id=nullif(p_payload->>'technician_id','')::uuid,
      amount=coalesce(nullif(p_payload->>'amount','')::numeric,0),
      completed_at=coalesce(nullif(p_payload->>'completed_at','')::timestamptz,now()),
      next_maintenance_date=nullif(p_payload->>'next_maintenance_date','')::date,
      technical_notes=p_payload->>'technical_notes',
      customer_notes=p_payload->>'customer_notes',
      status='completed'
    where id=sid;
  else
    insert into public.services(customer_id,appointment_id,service_type,technician_id,amount,started_at,completed_at,next_maintenance_date,technical_notes,customer_notes,status)
    values(
      (p_payload->>'customer_id')::uuid,
      appointment_uuid,
      p_payload->>'service_type',
      nullif(p_payload->>'technician_id','')::uuid,
      coalesce(nullif(p_payload->>'amount','')::numeric,0),
      coalesce(nullif(p_payload->>'started_at','')::timestamptz,now()),
      coalesce(nullif(p_payload->>'completed_at','')::timestamptz,now()),
      nullif(p_payload->>'next_maintenance_date','')::date,
      p_payload->>'technical_notes',
      p_payload->>'customer_notes',
      'completed'
    ) returning id into sid;
  end if;

  for x in select * from jsonb_array_elements(coalesce(p_consumptions,'[]'::jsonb)) loop
    cid := (x->>'consumable_id')::uuid;
    q := (x->>'qty')::numeric;
    if q <= 0 then continue; end if;
    select qty into available from public.consumables where id=cid for update;
    if available is null then raise exception 'Consumable not found'; end if;
    if available < q then raise exception 'Insufficient consumable stock'; end if;
    update public.consumables set qty=qty-q where id=cid;
    insert into public.inventory_movements(item_type,item_id,movement_type,qty,reason,service_id)
    values('consumable',cid,'used',q,'Used in service',sid);
  end loop;

  amount:=coalesce(nullif(p_payload->>'amount','')::numeric,0);
  if amount>0 then
    insert into public.payments(customer_id,service_id,type,method,amount,status,paid_at)
    values(
      (p_payload->>'customer_id')::uuid,
      sid,
      'sale',
      coalesce(nullif(p_payload->>'payment_method',''),'Other'),
      amount,
      coalesce(nullif(p_payload->>'payment_status',''),'paid'),
      case when coalesce(nullif(p_payload->>'payment_status',''),'paid')='paid' then now() else null end
    );
  end if;

  if appointment_uuid is not null then
    update public.appointments set status='completed' where id=appointment_uuid;
  end if;

  return sid;
end $$;

select 'V2_1_WORKFLOW_MIGRATION_OK' as result;
