-- MEN'S HAIR STUDIO V2.4 — ORDERS & PAYMENTS
-- Prepared after QA review on 2026-09-22.
-- TEST DATABASE FIRST. Do not run directly on production without a backup + reconciliation check.
--
-- Goals:
-- 1) Keep order receivables separate from payment transactions.
-- 2) Allow a payment to be allocated to a signed deal.
-- 3) Paid allocations reduce deal balance; outstanding promises do not.
-- 4) Refund allocations reopen deal balance.
-- 5) Preserve existing deal balances without guessing which old payment belonged to which deal.

-- A) Existing deals get a migration opening balance snapshot.
alter table public.deals add column if not exists opening_paid_amount numeric(12,2) not null default 0 check(opening_paid_amount>=0);
alter table public.deals add column if not exists paid_amount numeric(12,2) not null default 0 check(paid_amount>=0);
alter table public.deals add column if not exists refunded_amount numeric(12,2) not null default 0 check(refunded_amount>=0);

-- Capture only the amount already implied by the legacy final_price/balance_amount pair.
-- We deliberately do NOT guess which historic payment row caused it.
update public.deals
set opening_paid_amount=greatest(final_price-balance_amount,0),
    paid_amount=greatest(final_price-balance_amount,0),
    refunded_amount=0
where opening_paid_amount=0
  and paid_amount=0
  and refunded_amount=0
  and balance_amount<=final_price;

-- B) Explicit payment -> deal allocation.
create table if not exists public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  amount numeric(12,2) not null check(amount>0),
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  unique(payment_id,deal_id)
);
create index if not exists payment_allocations_payment_idx on public.payment_allocations(payment_id);
create index if not exists payment_allocations_deal_idx on public.payment_allocations(deal_id);

alter table public.payment_allocations enable row level security;
drop policy if exists active_staff_all on public.payment_allocations;
create policy active_staff_all on public.payment_allocations
for all to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.active=true))
with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.active=true));

drop trigger if exists trg_payment_allocations_activity on public.payment_allocations;
create trigger trg_payment_allocations_activity
after insert or update or delete on public.payment_allocations
for each row execute function public.log_change();

-- C) Allocation validation.
create or replace function public.guard_payment_allocation() returns trigger
language plpgsql as $$
declare
  payment_customer uuid;
  payment_amount numeric;
  deal_customer uuid;
  already_allocated numeric;
begin
  select customer_id,amount into payment_customer,payment_amount
  from public.payments where id=new.payment_id;

  if payment_customer is null then raise exception 'Payment not found'; end if;

  select customer_id into deal_customer from public.deals where id=new.deal_id;
  if deal_customer is null then raise exception 'Deal not found'; end if;
  if payment_customer is distinct from deal_customer then
    raise exception 'Payment and deal must belong to the same customer';
  end if;

  select coalesce(sum(amount),0) into already_allocated
  from public.payment_allocations
  where payment_id=new.payment_id
    and id is distinct from new.id;

  if already_allocated+new.amount>payment_amount then
    raise exception 'Allocated amount cannot exceed payment amount';
  end if;

  return new;
end $$;

drop trigger if exists trg_guard_payment_allocation on public.payment_allocations;
create trigger trg_guard_payment_allocation
before insert or update on public.payment_allocations
for each row execute function public.guard_payment_allocation();

create or replace function public.guard_payment_amount_against_allocations() returns trigger
language plpgsql as $$
declare allocated numeric;
begin
  select coalesce(sum(amount),0) into allocated
  from public.payment_allocations
  where payment_id=new.id;

  if new.amount<allocated then
    raise exception 'Payment amount cannot be lower than its allocated amount';
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_payment_amount_against_allocations on public.payments;
create trigger trg_guard_payment_amount_against_allocations
before update of amount on public.payments
for each row execute function public.guard_payment_amount_against_allocations();

-- D) Deal totals are derived from payment state.
create or replace function public.refresh_deal_financials(p_deal_id uuid) returns void
language plpgsql security definer set search_path=public as $$
declare
  opening_paid numeric;
  received numeric;
  refunded numeric;
begin
  select opening_paid_amount into opening_paid
  from public.deals
  where id=p_deal_id
  for update;

  if not found then return; end if;

  select
    coalesce(sum(case when p.type<>'refund' and p.status='paid' then pa.amount else 0 end),0),
    coalesce(sum(case when p.type='refund' and p.status in ('paid','refunded') then pa.amount else 0 end),0)
  into received,refunded
  from public.payment_allocations pa
  join public.payments p on p.id=pa.payment_id
  where pa.deal_id=p_deal_id;

  update public.deals
  set paid_amount=greatest(opening_paid+received,0),
      refunded_amount=greatest(refunded,0),
      balance_amount=greatest(final_price-(opening_paid+received)+refunded,0)
  where id=p_deal_id;
end $$;

create or replace function public.refresh_deal_from_allocation_trigger() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if tg_op='DELETE' then
    perform public.refresh_deal_financials(old.deal_id);
    return old;
  end if;

  perform public.refresh_deal_financials(new.deal_id);
  if tg_op='UPDATE' and old.deal_id is distinct from new.deal_id then
    perform public.refresh_deal_financials(old.deal_id);
  end if;
  return new;
end $$;

drop trigger if exists trg_refresh_deal_from_allocation on public.payment_allocations;
create trigger trg_refresh_deal_from_allocation
after insert or update or delete on public.payment_allocations
for each row execute function public.refresh_deal_from_allocation_trigger();

create or replace function public.refresh_deals_from_payment_trigger() returns trigger
language plpgsql security definer set search_path=public as $$
declare did uuid;
begin
  for did in select deal_id from public.payment_allocations where payment_id=new.id loop
    perform public.refresh_deal_financials(did);
  end loop;
  return new;
end $$;

drop trigger if exists trg_refresh_deals_from_payment on public.payments;
create trigger trg_refresh_deals_from_payment
after update of amount,status,type on public.payments
for each row execute function public.refresh_deals_from_payment_trigger();

-- E) Atomic payment recorder.
create or replace function public.record_payment(
  p_payload jsonb,
  p_deal_id uuid default null,
  p_allocated_amount numeric default null
) returns uuid
language plpgsql security invoker as $$
declare
  pid uuid;
  cid uuid;
  ptype text;
  pstatus text;
  pmethod text;
  pamount numeric;
  alloc numeric;
  deal_customer uuid;
  deal_balance numeric;
  pending_alloc numeric;
  refundable numeric;
begin
  cid:=nullif(p_payload->>'customer_id','')::uuid;
  ptype:=coalesce(nullif(p_payload->>'type',''),'sale');
  pstatus:=coalesce(nullif(p_payload->>'status',''),'paid');
  pmethod:=coalesce(nullif(p_payload->>'method',''),'DuitNow QR');
  pamount:=greatest(coalesce(nullif(p_payload->>'amount','')::numeric,0),0);
  alloc:=coalesce(p_allocated_amount,pamount);

  if cid is null then raise exception 'Customer is required'; end if;
  if pamount<=0 then raise exception 'Payment amount must be greater than zero'; end if;

  if p_deal_id is not null then
    select customer_id,balance_amount,paid_amount-refunded_amount
      into deal_customer,deal_balance,refundable
    from public.deals where id=p_deal_id for update;

    if not found then raise exception 'Deal not found'; end if;
    if deal_customer is distinct from cid then raise exception 'Payment and deal customer do not match'; end if;
    if alloc<=0 or alloc>pamount then raise exception 'Invalid allocated amount'; end if;

    if ptype='refund' then
      if alloc>greatest(refundable,0) then raise exception 'Refund exceeds net paid amount for this deal'; end if;
    else
      select coalesce(sum(pa.amount),0) into pending_alloc
      from public.payment_allocations pa
      join public.payments p on p.id=pa.payment_id
      where pa.deal_id=p_deal_id
        and p.status='outstanding'
        and p.type<>'refund';

      if alloc>greatest(deal_balance-pending_alloc,0) then
        raise exception 'Allocated payment exceeds the remaining uncommitted deal balance';
      end if;
    end if;
  end if;

  insert into public.payments(customer_id,service_id,type,method,amount,status,reference,notes,paid_at)
  values(
    cid,
    nullif(p_payload->>'service_id','')::uuid,
    ptype,
    pmethod,
    pamount,
    pstatus,
    nullif(p_payload->>'reference',''),
    nullif(p_payload->>'notes',''),
    case when pstatus='paid' then coalesce(nullif(p_payload->>'paid_at','')::timestamptz,now()) else null end
  )
  returning id into pid;

  if p_deal_id is not null then
    insert into public.payment_allocations(payment_id,deal_id,amount)
    values(pid,p_deal_id,alloc);
  end if;

  return pid;
end $$;

-- F) Signed consultation now links the deposit transaction to the new deal.
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
    status='completed',outcome=p_outcome,completed_at=now(),
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

  if c.appointment_id is not null then
    select * into a from public.appointments where id=c.appointment_id;
    update public.appointments set status='completed' where id=c.appointment_id;
  end if;

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

  customer_uuid:=c.customer_id;
  if customer_uuid is null then
    real_name:=coalesce(nullif(trim(p_payload->>'real_name'),''),nullif(trim(l.name),''));
    insert into public.customers(name,whatsapp_name,phone,email,area,address,place_name,google_place_id,lat,lng,google_maps_url,notes,lifecycle_stage,source_lead_id)
    values(real_name,l.whatsapp_name,l.phone,null,l.area,a.address,a.place_name,a.google_place_id,a.lat,a.lng,a.google_maps_url,l.notes,'signed',l.id)
    returning id into customer_uuid;
  else
    update public.customers set lifecycle_stage='signed' where id=customer_uuid;
  end if;

  hs_uuid:=nullif(p_payload->>'hair_system_id','')::uuid;
  final_amount:=greatest(coalesce(nullif(p_payload->>'final_price','')::numeric,0),0);
  dep:=greatest(coalesce(nullif(p_payload->>'deposit_amount','')::numeric,0),0);
  if dep>final_amount then raise exception 'Deposit cannot exceed final price'; end if;

  insert into public.deals(
    customer_id,lead_id,consultation_id,status,system_source,hair_system_id,
    base,colour,size,density,length,hair_type,quoted_price,discount,final_price,
    deposit_amount,opening_paid_amount,paid_amount,refunded_amount,balance_amount,expected_ready_date,notes
  ) values(
    customer_uuid,c.lead_id,c.id,
    case when hs_uuid is not null then 'system_reserved' else 'signed' end,
    coalesce(nullif(p_payload->>'system_source',''),'undecided'),hs_uuid,
    nullif(p_payload->>'base',''),nullif(p_payload->>'colour',''),nullif(p_payload->>'size',''),nullif(p_payload->>'density',''),nullif(p_payload->>'length',''),nullif(p_payload->>'hair_type',''),
    greatest(coalesce(nullif(p_payload->>'quoted_price','')::numeric,final_amount),0),
    greatest(coalesce(nullif(p_payload->>'discount','')::numeric,0),0),
    final_amount,dep,0,0,0,final_amount,nullif(p_payload->>'expected_ready_date','')::date,nullif(p_payload->>'deal_notes','')
  ) returning id into deal_uuid;

  if hs_uuid is not null then
    update public.hair_systems set status='reserved',customer_id=customer_uuid,reserved_at=now()
    where id=hs_uuid and status='available';
    if not found then raise exception 'Selected hair system is no longer available'; end if;
    insert into public.inventory_movements(item_type,item_id,movement_type,qty,reason)
    values('hair_system',hs_uuid,'reserved',1,'Reserved after signed consultation');
  end if;

  if dep>0 then
    pay_status:=coalesce(nullif(p_payload->>'payment_status',''),'paid');
    pay_method:=coalesce(nullif(p_payload->>'payment_method',''),'DuitNow QR');
    perform public.record_payment(
      jsonb_build_object(
        'customer_id',customer_uuid,
        'type','deposit',
        'method',pay_method,
        'amount',dep,
        'status',pay_status,
        'notes','Deposit from signed consultation'
      ),
      deal_uuid,
      dep
    );
  end if;

  if c.lead_id is not null then update public.leads set stage='signed',name=coalesce(name,real_name) where id=c.lead_id; end if;
  return jsonb_build_object('outcome','signed','customer_id',customer_uuid,'deal_id',deal_uuid);
end $$;

-- G) Service amount is the service charge. Payment collected is separate.
create or replace function public.complete_service(p_payload jsonb,p_consumptions jsonb default '[]'::jsonb) returns uuid
language plpgsql security invoker as $$
declare
  sid uuid;
  service_status text;
  x jsonb;
  cid uuid;
  q numeric;
  available numeric;
  appointment_uuid uuid;
  service_name text;
  reserved_hs uuid;
  installation_deal uuid;
  service_charge numeric;
  payment_amount numeric;
  allocation_amount numeric;
  payment_type text;
begin
  sid:=nullif(p_payload->>'service_id','')::uuid;
  appointment_uuid:=nullif(p_payload->>'appointment_id','')::uuid;
  service_name:=coalesce(p_payload->>'service_type','');
  service_charge:=greatest(coalesce(nullif(p_payload->>'service_price','')::numeric,nullif(p_payload->>'amount','')::numeric,0),0);

  if p_payload ? 'payment_amount' then
    payment_amount:=greatest(coalesce(nullif(p_payload->>'payment_amount','')::numeric,0),0);
  else
    payment_amount:=greatest(coalesce(nullif(p_payload->>'amount','')::numeric,0),0);
  end if;

  if sid is not null then
    select status into service_status from public.services where id=sid for update;
    if not found then raise exception 'Service not found'; end if;
    if service_status='completed' then raise exception 'Service already completed'; end if;
    if service_status='cancelled' then raise exception 'Cancelled service cannot be completed'; end if;

    update public.services set
      customer_id=(p_payload->>'customer_id')::uuid,
      appointment_id=appointment_uuid,
      service_type=service_name,
      technician_id=nullif(p_payload->>'technician_id','')::uuid,
      amount=service_charge,
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
      service_name,
      nullif(p_payload->>'technician_id','')::uuid,
      service_charge,
      coalesce(nullif(p_payload->>'started_at','')::timestamptz,now()),
      now(),
      nullif(p_payload->>'next_maintenance_date','')::date,
      p_payload->>'technical_notes',
      p_payload->>'customer_notes',
      'completed'
    )
    returning id into sid;
  end if;

  for x in select * from jsonb_array_elements(coalesce(p_consumptions,'[]'::jsonb)) loop
    cid:=(x->>'consumable_id')::uuid;
    q:=(x->>'qty')::numeric;
    if q<=0 then continue; end if;
    select qty into available from public.consumables where id=cid for update;
    if available is null then raise exception 'Consumable not found'; end if;
    if available<q then raise exception 'Insufficient consumable stock'; end if;
    update public.consumables set qty=qty-q where id=cid;
    insert into public.inventory_movements(item_type,item_id,movement_type,qty,reason,service_id)
    values('consumable',cid,'used',q,'Used in service',sid);
  end loop;

  if service_name='New System Installation' then
    select id,hair_system_id into installation_deal,reserved_hs
    from public.deals
    where customer_id=(p_payload->>'customer_id')::uuid
      and status in ('signed','system_reserved','system_ordered','ready_for_installation','installation_booked')
    order by signed_at desc
    limit 1
    for update;
  end if;

  if payment_amount>0 then
    allocation_amount:=0;
    if installation_deal is not null then
      select least(payment_amount,balance_amount) into allocation_amount
      from public.deals where id=installation_deal;
    end if;

    payment_type:=case when allocation_amount>0 and allocation_amount=payment_amount then 'balance' else 'sale' end;

    perform public.record_payment(
      jsonb_build_object(
        'customer_id',(p_payload->>'customer_id')::uuid,
        'service_id',sid,
        'type',payment_type,
        'method',coalesce(nullif(p_payload->>'payment_method',''),'Other'),
        'amount',payment_amount,
        'status',coalesce(nullif(p_payload->>'payment_status',''),'paid'),
        'notes',case when installation_deal is not null then 'Collected during installation service' else 'Collected during service' end
      ),
      case when allocation_amount>0 then installation_deal else null end,
      case when allocation_amount>0 then allocation_amount else null end
    );
  end if;

  if appointment_uuid is not null then
    update public.appointments set status='completed' where id=appointment_uuid;
  end if;

  if service_name='New System Installation' then
    update public.customers set lifecycle_stage='active'
    where id=(p_payload->>'customer_id')::uuid;

    if installation_deal is not null then
      update public.deals set status='installed',installed_at=now()
      where id=installation_deal;
    end if;

    if reserved_hs is not null then
      update public.hair_systems
      set status='installed',installed_date=current_date,customer_id=(p_payload->>'customer_id')::uuid
      where id=reserved_hs;

      insert into public.inventory_movements(item_type,item_id,movement_type,qty,reason,service_id)
      values('hair_system',reserved_hs,'installed',1,'Installed to client',sid);
    end if;
  end if;

  return sid;
end $$;

select 'V2_4_ORDERS_PAYMENTS_READY' as result;
