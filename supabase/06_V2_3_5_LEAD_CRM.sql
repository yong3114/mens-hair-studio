-- MEN'S HAIR STUDIO V2.3.5 — LEAD CRM MODEL FIX
-- Run ONCE after V2.3.4. Safe to re-run where practical.
-- Separates sales Stage, Interest, Follow-up scheduling and Contact Log.

-- 1) Interest is NOT a stage. It is a separate signal.
alter table public.leads add column if not exists interest_status text;
update public.leads set interest_status = case
  when interest_status is not null then interest_status
  when stage='interested' then 'interested'
  when stage='follow_up' then 'considering'
  else 'unknown'
end;
alter table public.leads alter column interest_status set default 'unknown';
alter table public.leads alter column interest_status set not null;
alter table public.leads drop constraint if exists leads_interest_status_check;
alter table public.leads add constraint leads_interest_status_check check(interest_status in ('unknown','interested','considering','not_interested'));

-- Migrate old stage values into the simpler workflow-stage model.
update public.leads set stage='contacted' where stage in ('interested','follow_up');
update public.leads set stage='signed' where stage in ('customer','deposit_paid');
alter table public.leads drop constraint if exists leads_stage_check;
alter table public.leads add constraint leads_stage_check check(stage in ('new','contacted','consultation_booked','consultation_done','signed','lost'));

-- 2) Contact history stores the outcome separately from stage.
alter table public.lead_followups add column if not exists outcome text;
alter table public.lead_followups add column if not exists interest_after text;
update public.lead_followups set outcome=coalesce(outcome,'general');
alter table public.lead_followups alter column outcome set default 'general';
alter table public.lead_followups alter column outcome set not null;
alter table public.lead_followups drop constraint if exists lead_followups_outcome_check;
alter table public.lead_followups add constraint lead_followups_outcome_check check(outcome in ('general','no_reply','interested','considering','not_interested'));
alter table public.lead_followups drop constraint if exists lead_followups_interest_after_check;
alter table public.lead_followups add constraint lead_followups_interest_after_check check(interest_after is null or interest_after in ('unknown','interested','considering','not_interested'));

-- 3) Log contact: optional follow-up date. Logging contact does NOT turn follow-up into a stage.
drop function if exists public.log_lead_contact(uuid,text,date,text,text);
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
  current_interest text;
  next_interest text;
begin
  if p_outcome not in ('general','no_reply','interested','considering','not_interested') then
    raise exception 'Invalid contact outcome';
  end if;

  select stage,interest_status into current_stage,current_interest
  from public.leads where id=p_lead_id for update;
  if not found then raise exception 'Lead not found'; end if;

  next_interest := case p_outcome
    when 'interested' then 'interested'
    when 'considering' then 'considering'
    when 'not_interested' then 'not_interested'
    else coalesce(current_interest,'unknown')
  end;

  insert into public.lead_followups(lead_id,channel,note,next_follow_up_date,contacted_at,outcome,interest_after)
  values(
    p_lead_id,
    coalesce(nullif(p_channel,''),'WhatsApp'),
    nullif(trim(p_note),''),
    p_next_follow_up_date,
    now(),
    p_outcome,
    next_interest
  ) returning id into fid;

  update public.leads
  set last_contacted_at=now(),
      follow_up_date=case when stage in ('signed','lost') then null else p_next_follow_up_date end,
      interest_status=case when stage in ('signed','lost') then interest_status else next_interest end,
      stage=case when stage='new' then 'contacted' else stage end
  where id=p_lead_id;

  return fid;
end $$;

-- 4) Consultation booking updates only Stage. It does not create a fake follow-up stage.
create or replace function public.sync_lead_consultation_stage() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if new.lead_id is null or position('Consultation' in coalesce(new.service_type,''))=0 then return new; end if;

  if new.status in ('tentative','confirmed','in_progress') then
    update public.leads
      set stage='consultation_booked',
          interest_status=case when interest_status='unknown' then 'interested' else interest_status end,
          follow_up_date=null
      where id=new.lead_id and stage not in ('signed','lost');
  elsif new.status in ('cancelled','no-show') then
    update public.leads set stage='contacted'
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

-- 5) Consultation outcome stays aligned with the new Stage / Interest model.
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
      update public.leads set stage='consultation_done', interest_status='considering', follow_up_date=nullif(p_payload->>'follow_up_date','')::date where id=c.lead_id;
    end if;
    return jsonb_build_object('outcome','follow_up','lead_id',c.lead_id);
  end if;

  if p_outcome='not_signed' then
    if c.lead_id is not null then
      update public.leads set stage='lost', interest_status='not_interested', follow_up_date=null, lost_reason=coalesce(nullif(p_payload->>'lost_reason',''),'Other') where id=c.lead_id;
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

  if c.lead_id is not null then update public.leads set stage='signed', interest_status='interested', follow_up_date=null, name=coalesce(name,real_name) where id=c.lead_id; end if;
  return jsonb_build_object('outcome','signed','customer_id',customer_uuid,'deal_id',deal_uuid);
end $$;

select 'V2_3_5_LEAD_CRM_OK' as result;
