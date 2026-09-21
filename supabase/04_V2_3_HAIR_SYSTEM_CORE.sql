-- MEN'S HAIR STUDIO V2.3 — HAIR SYSTEM BUSINESS CORE
-- Run ONCE after V2.1/V2.2 on the existing Supabase project.
-- Safe to re-run where practical. This migration separates consultation, deal and service workflows.

-- 1) Lead lifecycle: a consultation does NOT mean a sale.
alter table public.leads add column if not exists lost_reason text;
alter table public.leads drop constraint if exists leads_stage_check;
alter table public.leads add constraint leads_stage_check check(stage in (
  'new','contacted','interested','consultation_booked','consultation_done','follow_up','signed','customer','deposit_paid','lost'
));

-- 2) A lead may have a consultation booking before a customer/client record exists.
alter table public.appointments add column if not exists lead_id uuid references public.leads(id) on delete set null;
create index if not exists appointments_lead_idx on public.appointments(lead_id);

-- 3) Client lifecycle begins only after a signed consultation/deal.
alter table public.customers add column if not exists lifecycle_stage text;
update public.customers set lifecycle_stage='active' where lifecycle_stage is null;
alter table public.customers alter column lifecycle_stage set default 'signed';
alter table public.customers alter column lifecycle_stage set not null;
alter table public.customers drop constraint if exists customers_lifecycle_stage_check;
alter table public.customers add constraint customers_lifecycle_stage_check check(lifecycle_stage in ('signed','active','inactive'));
alter table public.customers add column if not exists source_lead_id uuid references public.leads(id) on delete set null;
create index if not exists customers_source_lead_idx on public.customers(source_lead_id);

-- 4) Consultation record: separate from technical service.
create table if not exists public.consultations (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid unique references public.appointments(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  consultant_id uuid references public.profiles(id) on delete set null,
  status text not null default 'in_progress' check(status in ('in_progress','completed','cancelled')),
  outcome text check(outcome in ('signed','follow_up','not_signed')),
  concern text,
  coverage_area text,
  colour_preference text,
  density_preference text,
  hairline_preference text,
  lifestyle text,
  budget numeric(12,2),
  recommendation text,
  follow_up_date date,
  lost_reason text,
  notes text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists consultations_lead_idx on public.consultations(lead_id);
create index if not exists consultations_customer_idx on public.consultations(customer_id);
create index if not exists consultations_status_idx on public.consultations(status);

-- 5) Signed deal / hair-system selection layer.
create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  consultation_id uuid references public.consultations(id) on delete set null,
  status text not null default 'signed' check(status in ('signed','system_reserved','system_ordered','ready_for_installation','installation_booked','installed','cancelled')),
  system_source text not null default 'stock' check(system_source in ('stock','custom','undecided')),
  hair_system_id uuid references public.hair_systems(id) on delete set null,
  base text,
  colour text,
  size text,
  density text,
  length text,
  hair_type text,
  quoted_price numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  final_price numeric(12,2) not null default 0,
  deposit_amount numeric(12,2) not null default 0,
  balance_amount numeric(12,2) not null default 0,
  expected_ready_date date,
  notes text,
  signed_at timestamptz not null default now(),
  installed_at timestamptz,
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists deals_customer_idx on public.deals(customer_id);
create index if not exists deals_status_idx on public.deals(status);

-- 6) In-app notifications. Email/WhatsApp delivery is connected in the Automation phase later.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references public.profiles(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete cascade,
  notification_type text not null,
  title text not null,
  body text,
  read_at timestamptz,
  email_status text not null default 'not_configured' check(email_status in ('not_configured','pending','sent','failed')),
  whatsapp_status text not null default 'not_configured' check(whatsapp_status in ('not_configured','pending','sent','failed')),
  created_at timestamptz not null default now()
);
create index if not exists notifications_recipient_idx on public.notifications(recipient_user_id,created_at desc);
create index if not exists notifications_unread_idx on public.notifications(recipient_user_id,read_at);

-- updated_at triggers for new workflow tables
DO $$ declare t text; begin
 foreach t in array array['consultations','deals'] loop
  execute format('drop trigger if exists trg_%I_updated_at on public.%I',t,t);
  execute format('create trigger trg_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()',t,t);
 end loop;
end $$;

-- activity log for the new workflow tables
DO $$ declare t text; begin
 foreach t in array array['consultations','deals','notifications'] loop
  execute format('drop trigger if exists trg_%I_activity on public.%I',t,t);
  execute format('create trigger trg_%I_activity after insert or update or delete on public.%I for each row execute function public.log_change()',t,t);
 end loop;
end $$;

-- Temporary authenticated-user policies, matching the existing development setup.
DO $$ declare t text; begin
 foreach t in array array['consultations','deals','notifications'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('drop policy if exists temp_authenticated_all on public.%I',t);
  execute format('create policy temp_authenticated_all on public.%I for all to authenticated using (true) with check (true)',t);
 end loop;
end $$;

-- 7) Start a consultation from a consultation appointment.
create or replace function public.start_consultation(
  p_appointment_id uuid,
  p_consultant_id uuid default null
) returns uuid
language plpgsql security invoker as $$
declare a public.appointments; cid uuid; existing_status text;
begin
  select * into a from public.appointments where id=p_appointment_id for update;
  if not found then raise exception 'Appointment not found'; end if;
  if position('Consultation' in coalesce(a.service_type,''))=0 then raise exception 'This booking is not a consultation'; end if;
  if a.status in ('completed','cancelled','no-show') then raise exception 'This consultation cannot be started'; end if;

  select id,status into cid,existing_status from public.consultations where appointment_id=p_appointment_id limit 1;
  if found then
    if existing_status='in_progress' then return cid; end if;
    if existing_status='completed' then raise exception 'Consultation already completed'; end if;
  end if;

  insert into public.consultations(appointment_id,lead_id,customer_id,consultant_id,status,started_at)
  values(a.id,a.lead_id,a.customer_id,coalesce(p_consultant_id,a.assigned_user_id),'in_progress',now())
  returning id into cid;

  update public.appointments set status='in_progress', assigned_user_id=coalesce(p_consultant_id,assigned_user_id) where id=a.id;
  return cid;
end $$;

-- 8) Consultation outcome transaction.
create or replace function public.complete_consultation(
  p_consultation_id uuid,
  p_outcome text,
  p_payload jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security invoker as $$
declare
  c public.consultations;
  l public.leads;
  a public.appointments;
  customer_uuid uuid;
  deal_uuid uuid;
  hs_uuid uuid;
  dep numeric;
  final_amount numeric;
  pay_status text;
  pay_method text;
  real_name text;
begin
  if p_outcome not in ('signed','follow_up','not_signed') then raise exception 'Invalid consultation outcome'; end if;
  select * into c from public.consultations where id=p_consultation_id for update;
  if not found then raise exception 'Consultation not found'; end if;
  if c.status='completed' then raise exception 'Consultation already completed'; end if;

  update public.consultations set
    status='completed', outcome=p_outcome, completed_at=now(),
    concern=coalesce(p_payload->>'concern',concern),
    coverage_area=coalesce(p_payload->>'coverage_area',coverage_area),
    colour_preference=coalesce(p_payload->>'colour_preference',colour_preference),
    density_preference=coalesce(p_payload->>'density_preference',density_preference),
    hairline_preference=coalesce(p_payload->>'hairline_preference',hairline_preference),
    lifestyle=coalesce(p_payload->>'lifestyle',lifestyle),
    budget=nullif(p_payload->>'budget','')::numeric,
    recommendation=coalesce(p_payload->>'recommendation',recommendation),
    follow_up_date=nullif(p_payload->>'follow_up_date','')::date,
    lost_reason=coalesce(p_payload->>'lost_reason',lost_reason),
    notes=coalesce(p_payload->>'notes',notes)
  where id=p_consultation_id;

  if c.appointment_id is not null then select * into a from public.appointments where id=c.appointment_id; update public.appointments set status='completed' where id=c.appointment_id; end if;

  if c.lead_id is not null then select * into l from public.leads where id=c.lead_id for update; end if;

  if p_outcome='follow_up' then
    if c.lead_id is not null then
      update public.leads set stage='follow_up',follow_up_date=nullif(p_payload->>'follow_up_date','')::date where id=c.lead_id;
    end if;
    return jsonb_build_object('outcome','follow_up','lead_id',c.lead_id);
  end if;

  if p_outcome='not_signed' then
    if c.lead_id is not null then
      update public.leads set stage='lost',lost_reason=coalesce(nullif(p_payload->>'lost_reason',''),'Other') where id=c.lead_id;
    end if;
    return jsonb_build_object('outcome','not_signed','lead_id',c.lead_id);
  end if;

  -- SIGNED: only now does a prospect become a client.
  customer_uuid := c.customer_id;
  if customer_uuid is null then
    real_name := coalesce(nullif(trim(p_payload->>'real_name'),''), nullif(trim(l.name),''));
    insert into public.customers(name,whatsapp_name,phone,email,area,address,place_name,google_place_id,lat,lng,google_maps_url,notes,lifecycle_stage,source_lead_id)
    values(
      real_name,l.whatsapp_name,l.phone,null,l.area,
      a.address,a.place_name,a.google_place_id,a.lat,a.lng,a.google_maps_url,l.notes,'signed',l.id
    ) returning id into customer_uuid;
  else
    update public.customers set lifecycle_stage='signed' where id=customer_uuid;
  end if;

  hs_uuid := nullif(p_payload->>'hair_system_id','')::uuid;
  final_amount := greatest(coalesce(nullif(p_payload->>'final_price','')::numeric,0),0);
  dep := greatest(coalesce(nullif(p_payload->>'deposit_amount','')::numeric,0),0);

  insert into public.deals(
    customer_id,lead_id,consultation_id,status,system_source,hair_system_id,
    base,colour,size,density,length,hair_type,quoted_price,discount,final_price,deposit_amount,balance_amount,expected_ready_date,notes
  ) values(
    customer_uuid,c.lead_id,c.id,
    case when hs_uuid is not null then 'system_reserved' else 'signed' end,
    coalesce(nullif(p_payload->>'system_source',''),'undecided'),hs_uuid,
    nullif(p_payload->>'base',''),nullif(p_payload->>'colour',''),nullif(p_payload->>'size',''),nullif(p_payload->>'density',''),nullif(p_payload->>'length',''),nullif(p_payload->>'hair_type',''),
    greatest(coalesce(nullif(p_payload->>'quoted_price','')::numeric,final_amount),0),
    greatest(coalesce(nullif(p_payload->>'discount','')::numeric,0),0),
    final_amount,dep,greatest(final_amount-dep,0),nullif(p_payload->>'expected_ready_date','')::date,nullif(p_payload->>'deal_notes','')
  ) returning id into deal_uuid;

  if hs_uuid is not null then
    update public.hair_systems set status='reserved',customer_id=customer_uuid,reserved_at=now() where id=hs_uuid and status='available';
    if not found then raise exception 'Selected hair system is no longer available'; end if;
    insert into public.inventory_movements(item_type,item_id,movement_type,qty,reason)
    values('hair_system',hs_uuid,'reserved',1,'Reserved after signed consultation');
  end if;

  if dep>0 then
    pay_status := coalesce(nullif(p_payload->>'payment_status',''),'paid');
    pay_method := coalesce(nullif(p_payload->>'payment_method',''),'DuitNow QR');
    insert into public.payments(customer_id,type,method,amount,status,paid_at,notes)
    values(customer_uuid,'deposit',pay_method,dep,pay_status,case when pay_status='paid' then now() else null end,'Deposit from signed consultation');
  end if;

  if c.lead_id is not null then update public.leads set stage='signed',name=coalesce(name,real_name) where id=c.lead_id; end if;
  return jsonb_build_object('outcome','signed','customer_id',customer_uuid,'deal_id',deal_uuid);
end $$;

-- 9) Technical-service completion activates a signed client after installation.
create or replace function public.complete_service(p_payload jsonb,p_consumptions jsonb default '[]'::jsonb) returns uuid
language plpgsql security invoker as $$
declare
  sid uuid; service_status text; x jsonb; cid uuid; q numeric; available numeric; amount numeric; appointment_uuid uuid;
  service_name text; reserved_hs uuid; installation_deal uuid;
begin
  sid := nullif(p_payload->>'service_id','')::uuid;
  appointment_uuid := nullif(p_payload->>'appointment_id','')::uuid;
  service_name := coalesce(p_payload->>'service_type','');

  if sid is not null then
    select status into service_status from public.services where id=sid for update;
    if not found then raise exception 'Service not found'; end if;
    if service_status='completed' then raise exception 'Service already completed'; end if;
    if service_status='cancelled' then raise exception 'Cancelled service cannot be completed'; end if;
    update public.services set
      customer_id=(p_payload->>'customer_id')::uuid,appointment_id=appointment_uuid,service_type=service_name,
      technician_id=nullif(p_payload->>'technician_id','')::uuid,amount=coalesce(nullif(p_payload->>'amount','')::numeric,0),
      completed_at=coalesce(nullif(p_payload->>'completed_at','')::timestamptz,now()),next_maintenance_date=nullif(p_payload->>'next_maintenance_date','')::date,
      technical_notes=p_payload->>'technical_notes',customer_notes=p_payload->>'customer_notes',status='completed' where id=sid;
  else
    insert into public.services(customer_id,appointment_id,service_type,technician_id,amount,started_at,completed_at,next_maintenance_date,technical_notes,customer_notes,status)
    values((p_payload->>'customer_id')::uuid,appointment_uuid,service_name,nullif(p_payload->>'technician_id','')::uuid,
      coalesce(nullif(p_payload->>'amount','')::numeric,0),coalesce(nullif(p_payload->>'started_at','')::timestamptz,now()),now(),
      nullif(p_payload->>'next_maintenance_date','')::date,p_payload->>'technical_notes',p_payload->>'customer_notes','completed') returning id into sid;
  end if;

  for x in select * from jsonb_array_elements(coalesce(p_consumptions,'[]'::jsonb)) loop
    cid := (x->>'consumable_id')::uuid; q := (x->>'qty')::numeric; if q<=0 then continue; end if;
    select qty into available from public.consumables where id=cid for update;
    if available is null then raise exception 'Consumable not found'; end if;
    if available<q then raise exception 'Insufficient consumable stock'; end if;
    update public.consumables set qty=qty-q where id=cid;
    insert into public.inventory_movements(item_type,item_id,movement_type,qty,reason,service_id) values('consumable',cid,'used',q,'Used in service',sid);
  end loop;

  amount:=coalesce(nullif(p_payload->>'amount','')::numeric,0);
  if amount>0 then
    insert into public.payments(customer_id,service_id,type,method,amount,status,paid_at)
    values((p_payload->>'customer_id')::uuid,sid,'sale',coalesce(nullif(p_payload->>'payment_method',''),'Other'),amount,
      coalesce(nullif(p_payload->>'payment_status',''),'paid'),case when coalesce(nullif(p_payload->>'payment_status',''),'paid')='paid' then now() else null end);
  end if;
  if appointment_uuid is not null then update public.appointments set status='completed' where id=appointment_uuid; end if;

  if service_name='New System Installation' then
    update public.customers set lifecycle_stage='active' where id=(p_payload->>'customer_id')::uuid;
    select id,hair_system_id into installation_deal,reserved_hs from public.deals
      where customer_id=(p_payload->>'customer_id')::uuid and status in ('signed','system_reserved','system_ordered','ready_for_installation','installation_booked')
      order by signed_at desc limit 1 for update;
    if installation_deal is not null then update public.deals set status='installed',installed_at=now() where id=installation_deal; end if;
    if reserved_hs is not null then
      update public.hair_systems set status='installed',installed_date=current_date,customer_id=(p_payload->>'customer_id')::uuid where id=reserved_hs;
      insert into public.inventory_movements(item_type,item_id,movement_type,qty,reason,service_id) values('hair_system',reserved_hs,'installed',1,'Installed to client',sid);
    end if;
  end if;
  return sid;
end $$;

-- 10) Staff in-app notification when a job is assigned/rescheduled/cancelled.
create or replace function public.notify_appointment_staff() returns trigger
language plpgsql security definer set search_path=public as $$
declare person_name text; title_text text; body_text text;
begin
  if new.assigned_user_id is null then return new; end if;
  select coalesce(c.name,c.whatsapp_name,l.name,l.whatsapp_name,l.phone,'Client') into person_name
  from (select 1) x
  left join public.customers c on c.id=new.customer_id
  left join public.leads l on l.id=new.lead_id;

  if tg_op='INSERT' then
    title_text:='New job assigned';
  elsif old.assigned_user_id is distinct from new.assigned_user_id then
    title_text:='New job assigned';
  elsif old.scheduled_at is distinct from new.scheduled_at then
    title_text:='Job rescheduled';
  elsif old.status is distinct from new.status and new.status='cancelled' then
    title_text:='Job cancelled';
  else
    return new;
  end if;
  body_text:=coalesce(person_name,'Client')||' · '||new.service_type||' · '||to_char(new.scheduled_at at time zone 'Asia/Kuala_Lumpur','DD Mon, HH24:MI');
  insert into public.notifications(recipient_user_id,actor_user_id,appointment_id,notification_type,title,body)
  values(new.assigned_user_id,auth.uid(),new.id,lower(replace(title_text,' ','_')),title_text,body_text);
  return new;
end $$;

drop trigger if exists trg_appointment_staff_notification on public.appointments;
create trigger trg_appointment_staff_notification
after insert or update of assigned_user_id,scheduled_at,status on public.appointments
for each row execute function public.notify_appointment_staff();


-- Keep the latest signed deal aligned with an installation booking.
create or replace function public.sync_deal_installation_booking() returns trigger
language plpgsql security definer set search_path=public as $$
declare did uuid;
begin
  if new.customer_id is null or new.service_type<>'New System Installation' then return new; end if;
  select id into did from public.deals where customer_id=new.customer_id and status in ('signed','system_reserved','system_ordered','ready_for_installation','installation_booked') order by signed_at desc limit 1;
  if did is not null then
    if new.status in ('tentative','confirmed','in_progress') then update public.deals set status='installation_booked' where id=did;
    elsif new.status='cancelled' then update public.deals set status=case when hair_system_id is not null then 'system_reserved' else 'signed' end where id=did;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_sync_deal_installation_booking on public.appointments;
create trigger trg_sync_deal_installation_booking
after insert or update of status,service_type,customer_id on public.appointments
for each row execute function public.sync_deal_installation_booking();

select 'V2_3_HAIR_SYSTEM_CORE_OK' as result;
