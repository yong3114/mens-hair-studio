create or replace function public.record_lead_contact(p_lead_id uuid, p_note text, p_next_follow_up_date date, p_channel text, p_outcome text, p_clear_reminder boolean)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  lead public.leads%rowtype;
  logged_id uuid;
begin
  select * into strict lead from public.leads where id=p_lead_id for update;
  if p_clear_reminder and p_next_follow_up_date is not null then
    raise exception 'Choose either a date or clear reminder';
  end if;
  if lead.stage in ('signed','lost') or p_clear_reminder then
    lead.follow_up_date := null;
  else
    lead.follow_up_date := coalesce(p_next_follow_up_date,lead.follow_up_date);
  end if;
  if lead.stage not in ('signed','lost') and p_outcome in ('interested','considering','not_interested') then
    lead.interest_status := p_outcome;
  end if;
  insert into public.lead_followups(lead_id,channel,note,next_follow_up_date,contacted_at,outcome,interest_after)
  values(lead.id,coalesce(nullif(p_channel,''),'WhatsApp'),nullif(trim(p_note),''),lead.follow_up_date,now(),p_outcome,lead.interest_status)
  returning id into logged_id;
  update public.leads set last_contacted_at=now(), follow_up_date=lead.follow_up_date,
    interest_status=lead.interest_status, stage=case when lead.stage='new' then 'contacted' else lead.stage end
    where id=lead.id;
  return logged_id;
end $$;
revoke all on function public.record_lead_contact(uuid,text,date,text,text,boolean) from public,anon;
grant execute on function public.record_lead_contact(uuid,text,date,text,text,boolean) to authenticated,service_role;
create or replace function public.log_lead_contact(p_lead_id uuid,p_note text default null,p_next_follow_up_date date default null,p_channel text default 'WhatsApp',p_outcome text default 'general')
returns uuid language sql security invoker set search_path = '' as $$
  select public.record_lead_contact(p_lead_id,p_note,p_next_follow_up_date,p_channel,p_outcome,false);
$$;
