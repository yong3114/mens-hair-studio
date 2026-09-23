-- MEN'S HAIR STUDIO V2.3.8 QA — ACTIVE WORKFLOW GUARDS
-- Prepared for QA after the mobile/workflow review.
-- DO NOT run directly on production. Validate in a test database first.
--
-- Rules:
-- 1. A lead/client may have only ONE active consultation booking at a time.
-- 2. A client may have only ONE technical service in_progress at a time.
-- Existing duplicates are not deleted automatically.

create or replace function public.guard_active_workflow_booking() returns trigger
language plpgsql as $$
begin
  if position('Consultation' in coalesce(new.service_type,''))>0
     and new.status in ('tentative','confirmed','in_progress') then

    if exists(
      select 1
      from public.appointments a
      where a.id<>new.id
        and a.status in ('tentative','confirmed','in_progress')
        and position('Consultation' in coalesce(a.service_type,''))>0
        and (
          (new.lead_id is not null and a.lead_id=new.lead_id)
          or
          (new.customer_id is not null and a.customer_id=new.customer_id)
        )
    ) then
      raise exception 'This person already has an active consultation. Finish or cancel it before creating another.';
    end if;

  elsif position('Consultation' in coalesce(new.service_type,''))=0
        and new.status='in_progress'
        and new.customer_id is not null then

    if exists(
      select 1
      from public.appointments a
      where a.id<>new.id
        and a.customer_id=new.customer_id
        and a.status='in_progress'
        and position('Consultation' in coalesce(a.service_type,''))=0
    ) then
      raise exception 'This client already has a service in progress.';
    end if;
  end if;

  return new;
end $$;

drop trigger if exists trg_guard_active_workflow_booking on public.appointments;
create trigger trg_guard_active_workflow_booking
before insert or update of status,service_type,lead_id,customer_id
on public.appointments
for each row execute function public.guard_active_workflow_booking();

select 'V2_3_8_ACTIVE_WORKFLOW_GUARDS_READY' as result;
