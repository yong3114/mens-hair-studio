-- MEN'S HAIR STUDIO QA WORKFLOW GUARDS
-- Prepared after the 2026-09-22 full-app review.
-- DO NOT run directly on production. Validate on a test database first.

create or replace function public.guard_completed_appointment_update() returns trigger
language plpgsql as $$
begin
  if old.status='completed' and to_jsonb(new) is distinct from to_jsonb(old) then
    raise exception 'Completed appointments are locked';
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_completed_appointment_update on public.appointments;
create trigger trg_guard_completed_appointment_update
before update on public.appointments
for each row execute function public.guard_completed_appointment_update();

create or replace function public.install_hair_system(
  p_system_id uuid,
  p_customer_id uuid,
  p_service_id uuid default null
) returns uuid
language plpgsql security invoker as $$
begin
  update public.hair_systems
  set status='installed',customer_id=p_customer_id,installed_date=current_date
  where id=p_system_id and status='available';

  if not found then
    raise exception 'Only available hair systems can be installed directly';
  end if;

  insert into public.inventory_movements(item_type,item_id,movement_type,qty,reason,service_id)
  values('hair_system',p_system_id,'installed',1,'Installed to customer',p_service_id);

  return p_system_id;
end $$;

create or replace function public.guard_hair_system_install_transition() returns trigger
language plpgsql as $$
begin
  if new.status='installed' and old.status is distinct from 'installed' then
    if old.status='available' then
      if new.customer_id is null then raise exception 'Installed hair system requires a customer'; end if;
    elsif old.status='reserved' then
      if old.customer_id is null or new.customer_id is distinct from old.customer_id then
        raise exception 'Reserved hair system cannot be reassigned during installation';
      end if;
    else
      raise exception 'Hair system in status % cannot be installed',old.status;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_hair_system_install_transition on public.hair_systems;
create trigger trg_guard_hair_system_install_transition
before update of status,customer_id on public.hair_systems
for each row execute function public.guard_hair_system_install_transition();

select 'QA_WORKFLOW_GUARDS_READY' as result;
