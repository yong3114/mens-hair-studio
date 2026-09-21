-- MEN'S HAIR STUDIO V2.3.4 — LEADS + IN-PROGRESS STATUS FIX
-- Run ONCE after V2.3. Safe to re-run where practical.
-- Adds proper lead follow-up history and safe status recovery for work that was started by mistake.

-- 1) Lead follow-up metadata.
alter table public.leads add column if not exists last_contacted_at timestamptz;

create table if not exists public.lead_followups (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  channel text not null default 'WhatsApp' check(channel in ('WhatsApp','Call','Email','Instagram','Facebook','Walk-in','Other')),
  note text,
  next_follow_up_date date,
  contacted_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists lead_followups_lead_idx on public.lead_followups(lead_id, contacted_at desc);

alter table public.lead_followups enable row level security;
drop policy if exists temp_authenticated_all on public.lead_followups;
create policy temp_authenticated_all on public.lead_followups for all to authenticated using (true) with check (true);

drop trigger if exists trg_lead_followups_activity on public.lead_followups;
create trigger trg_lead_followups_activity after insert or update or delete on public.lead_followups
for each row execute function public.log_change();

-- Log one real sales follow-up and update the lead in the same transaction.
create or replace function public.log_lead_followup(
  p_lead_id uuid,
  p_note text default null,
  p_next_follow_up_date date default null,
  p_channel text default 'WhatsApp',
  p_stage text default 'follow_up'
) returns uuid
language plpgsql security invoker as $$
declare fid uuid; next_stage text;
begin
  if p_stage not in ('contacted','interested','follow_up') then
    raise exception 'Invalid follow-up stage';
  end if;
  if not exists(select 1 from public.leads where id=p_lead_id) then
    raise exception 'Lead not found';
  end if;

  next_stage := case when p_next_follow_up_date is not null then 'follow_up' else p_stage end;

  insert into public.lead_followups(lead_id,channel,note,next_follow_up_date,contacted_at)
  values(p_lead_id,coalesce(nullif(p_channel,''),'WhatsApp'),nullif(trim(p_note),''),p_next_follow_up_date,now())
  returning id into fid;

  update public.leads
  set last_contacted_at=now(),
      follow_up_date=p_next_follow_up_date,
      stage=case when stage in ('signed','lost') then stage else next_stage end
  where id=p_lead_id;

  return fid;
end $$;

-- 2) Safe recovery for an appointment that was started by mistake.
-- Completed work is intentionally NOT reversible here because it may already have payments / stock movements.
create or replace function public.reset_appointment_workflow(
  p_appointment_id uuid,
  p_target_status text default 'confirmed'
) returns boolean
language plpgsql security invoker as $$
declare a public.appointments;
begin
  if p_target_status not in ('tentative','confirmed','cancelled','no-show') then
    raise exception 'Invalid target status';
  end if;

  select * into a from public.appointments where id=p_appointment_id for update;
  if not found then raise exception 'Appointment not found'; end if;
  if a.status='completed' then raise exception 'Completed bookings cannot be reset. Open the completed record instead.'; end if;

  if position('Consultation' in coalesce(a.service_type,''))>0 then
    update public.consultations
      set status='cancelled', completed_at=null
      where appointment_id=p_appointment_id and status='in_progress';
  else
    update public.services
      set status='cancelled', completed_at=null
      where appointment_id=p_appointment_id and status='in_progress';
  end if;

  update public.appointments set status=p_target_status where id=p_appointment_id;
  return true;
end $$;

-- 3) Start consultation can re-open a previously reset/cancelled consultation record.
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
    if existing_status='cancelled' then
      update public.consultations set
        status='in_progress', outcome=null, completed_at=null, started_at=now(),
        consultant_id=coalesce(p_consultant_id,a.assigned_user_id),
        lead_id=a.lead_id, customer_id=a.customer_id
      where id=cid;
      update public.appointments set status='in_progress',assigned_user_id=coalesce(p_consultant_id,assigned_user_id) where id=a.id;
      return cid;
    end if;
  end if;

  insert into public.consultations(appointment_id,lead_id,customer_id,consultant_id,status,started_at)
  values(a.id,a.lead_id,a.customer_id,coalesce(p_consultant_id,a.assigned_user_id),'in_progress',now())
  returning id into cid;

  update public.appointments set status='in_progress', assigned_user_id=coalesce(p_consultant_id,assigned_user_id) where id=a.id;
  return cid;
end $$;

-- 4) Start service can re-open the latest cancelled service created for the same appointment.
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
      if existing_status='cancelled' then
        update public.services set
          customer_id=p_customer_id, service_type=p_service_type,
          technician_id=p_technician_id, amount=0,
          started_at=coalesce(p_started_at,now()), completed_at=null, status='in_progress'
        where id=sid;
        update public.appointments
          set status='in_progress', assigned_user_id=coalesce(p_technician_id,assigned_user_id)
          where id=p_appointment_id and status not in ('completed','cancelled','no-show');
        if not found then raise exception 'Appointment cannot be started'; end if;
        return sid;
      end if;
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


-- 5) Keep Lead stage aligned with the consultation booking itself.
create or replace function public.sync_lead_consultation_stage() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if new.lead_id is null or position('Consultation' in coalesce(new.service_type,''))=0 then return new; end if;

  if new.status in ('tentative','confirmed','in_progress') then
    update public.leads set stage='consultation_booked',follow_up_date=null
      where id=new.lead_id and stage not in ('signed','lost');
  elsif new.status in ('cancelled','no-show') then
    update public.leads set stage='follow_up'
      where id=new.lead_id and stage not in ('signed','lost');
  elsif new.status='completed' then
    update public.leads set stage='consultation_done'
      where id=new.lead_id and stage not in ('signed','lost');
  end if;
  return new;
end $$;

drop trigger if exists trg_sync_lead_consultation_stage on public.appointments;
create trigger trg_sync_lead_consultation_stage
after insert or update of status,service_type,lead_id on public.appointments
for each row execute function public.sync_lead_consultation_stage();

select 'V2_3_4_LEADS_STATUS_OK' as result;
