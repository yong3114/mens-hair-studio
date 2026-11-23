CREATE OR REPLACE FUNCTION public.sync_lead_consultation_stage()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.lead_id is null or position('Consultation' in coalesce(new.service_type,''))=0 then
    return new;
  end if;

  if new.status in ('tentative','confirmed','in_progress') then
    update public.leads
    set stage='consultation_booked'
    where id=new.lead_id and stage not in ('signed','lost');

  elsif new.status in ('cancelled','no-show','completed') then
    update public.leads
    set stage='contacted'
    where id=new.lead_id and stage not in ('signed','lost');
  end if;

  return new;
end $function$
;