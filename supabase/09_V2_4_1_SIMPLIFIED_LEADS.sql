-- MEN'S HAIR STUDIO V2.4.1 — SIMPLIFIED LEAD WORKFLOW
-- Run after 08_V2_4_ORDERS_PAYMENTS.sql.
-- Keeps legacy interest/contact columns for compatibility, but the UI no longer uses them.
--
-- Lead status becomes:
-- new -> contacted ("In discussion") -> consultation_booked -> signed / lost
-- Follow-up is a DATE, not a stage.
-- consultation_done and legacy follow_up are normalized back to contacted.

-- 1) Normalize existing legacy stage rows.
update public.leads
set stage='contacted'
where stage in ('consultation_done','follow_up');

alter table public.leads drop constraint if exists leads_stage_check;
alter table public.leads add constraint leads_stage_check
check(stage in ('new','contacted','consultation_booked','signed','lost'));

-- 2) Compatibility guard.
-- Older RPC/trigger code that still writes follow_up / consultation_done is converted
-- into contacted before the check constraint is evaluated.
create or replace function public.normalize_lead_stage() returns trigger
language plpgsql as $$
begin
  if new.stage in ('follow_up','consultation_done') then
    new.stage:='contacted';
  end if;

  if new.stage in ('signed','lost') then
    new.follow_up_date:=null;
  end if;

  return new;
end $$;

drop trigger if exists trg_normalize_lead_stage on public.leads;
create trigger trg_normalize_lead_stage
before insert or update of stage,follow_up_date on public.leads
for each row execute function public.normalize_lead_stage();

-- 3) Consultation booking is the only automatic middle-stage status.
create or replace function public.sync_lead_consultation_stage() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if new.lead_id is null or position('Consultation' in coalesce(new.service_type,''))=0 then
    return new;
  end if;

  if new.status in ('tentative','confirmed','in_progress') then
    update public.leads
    set stage='consultation_booked',
        follow_up_date=null
    where id=new.lead_id and stage not in ('signed','lost');

  elsif new.status in ('cancelled','no-show','completed') then
    update public.leads
    set stage='contacted'
    where id=new.lead_id and stage not in ('signed','lost');
  end if;

  return new;
end $$;

drop trigger if exists trg_sync_lead_consultation_stage on public.appointments;
create trigger trg_sync_lead_consultation_stage
after insert or update of status,service_type,lead_id on public.appointments
for each row execute function public.sync_lead_consultation_stage();

-- 4) Keep the existing contact-history table, but treat it as a simple Updates / Notes timeline.
-- The frontend sends outcome='general', so saving an update only:
--   * timestamps the contact
--   * optionally sets the next follow-up date
--   * moves New -> In discussion
create or replace function public.log_lead_contact(
  p_lead_id uuid,
  p_note text default null,
  p_next_follow_up_date date default null,
  p_channel text default 'WhatsApp',
  p_outcome text default 'general'
) returns uuid
language plpgsql security invoker as $$
declare
  fid uuid;
  current_stage text;
begin
  select stage into current_stage
  from public.leads
  where id=p_lead_id
  for update;

  if not found then raise exception 'Lead not found'; end if;

  insert into public.lead_followups(lead_id,channel,note,next_follow_up_date,contacted_at,outcome,interest_after)
  values(
    p_lead_id,
    coalesce(nullif(p_channel,''),'WhatsApp'),
    nullif(trim(p_note),''),
    p_next_follow_up_date,
    now(),
    'general',
    null
  )
  returning id into fid;

  update public.leads
  set last_contacted_at=now(),
      follow_up_date=case when stage in ('signed','lost') then null else p_next_follow_up_date end,
      stage=case when stage='new' then 'contacted' else stage end
  where id=p_lead_id;

  return fid;
end $$;

select 'V2_4_1_SIMPLIFIED_LEADS_READY' as result;
