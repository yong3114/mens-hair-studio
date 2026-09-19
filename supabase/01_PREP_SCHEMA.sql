-- MEN'S HAIR STUDIO V2.0 — PREP SCHEMA
-- Run this FIRST in a fresh Supabase project.
-- Safe testing policies allow authenticated users only.

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text not null default 'Admin',
  role text not null default 'admin' check (role in ('admin','staff')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists active boolean not null default true;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,email,full_name,role)
  values(new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1), 'Admin'), 'admin')
  on conflict(id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
insert into public.profiles(id,email,full_name,role)
select id,email,coalesce(raw_user_meta_data->>'full_name', split_part(email,'@',1), 'Admin'), 'admin'
from auth.users on conflict(id) do nothing;

create table if not exists public.leads (
 id uuid primary key default gen_random_uuid(),
 name text not null, phone text, area text, source text not null default 'Other',
 stage text not null default 'new' check(stage in ('new','contacted','interested','consultation_booked','consultation_done','deposit_paid','customer','lost')),
 follow_up_date date, potential_value numeric(12,2) not null default 0, concern text, notes text,
 created_by uuid references public.profiles(id) default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.customers (
 id uuid primary key default gen_random_uuid(),
 name text not null, phone text, email text, area text, status text not null default 'active' check(status in ('active','inactive')),
 address text, place_name text, google_place_id text, lat double precision, lng double precision, google_maps_url text, notes text,
 created_by uuid references public.profiles(id) default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.appointments (
 id uuid primary key default gen_random_uuid(),
 customer_id uuid references public.customers(id) on delete set null,
 service_type text not null, scheduled_at timestamptz not null, duration_min integer not null default 60 check(duration_min>0),
 assigned_user_id uuid references public.profiles(id) on delete set null,
 location_type text not null default 'studio' check(location_type in ('studio','home')),
 address text, place_name text, google_place_id text, lat double precision, lng double precision, google_maps_url text,
 travel_buffer_before integer not null default 0 check(travel_buffer_before>=0), travel_buffer_after integer not null default 0 check(travel_buffer_after>=0),
 status text not null default 'confirmed' check(status in ('tentative','confirmed','completed','cancelled','no-show')),
 notes text, created_by uuid references public.profiles(id) default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- Appointment booking window is materialized in ordinary columns because
-- PostgreSQL exclusion-index expressions must be IMMUTABLE. Arithmetic on
-- timestamptz + interval is STABLE, so doing that arithmetic directly inside
-- the GiST exclusion expression fails on PostgreSQL/Supabase.
alter table public.appointments add column if not exists blocked_start timestamptz;
alter table public.appointments add column if not exists blocked_end timestamptz;

create or replace function public.set_appointment_block_window() returns trigger
language plpgsql as $$
begin
  new.blocked_start := new.scheduled_at - (new.travel_buffer_before * interval '1 minute');
  new.blocked_end := new.scheduled_at + ((new.duration_min + new.travel_buffer_after) * interval '1 minute');
  return new;
end $$;

drop trigger if exists trg_appointments_block_window on public.appointments;
create trigger trg_appointments_block_window
before insert or update
on public.appointments
for each row execute function public.set_appointment_block_window();

-- Backfill rows that may already exist (also makes reruns safe after a partial setup).
update public.appointments
set blocked_start = scheduled_at - (travel_buffer_before * interval '1 minute'),
    blocked_end = scheduled_at + ((duration_min + travel_buffer_after) * interval '1 minute')
where blocked_start is null or blocked_end is null;

alter table public.appointments alter column blocked_start set not null;
alter table public.appointments alter column blocked_end set not null;

alter table public.appointments drop constraint if exists appointment_no_overlap;
alter table public.appointments add constraint appointment_no_overlap
exclude using gist (
  assigned_user_id with =,
  tstzrange(blocked_start, blocked_end, '[)') with &&
) where (status in ('tentative','confirmed'));

create table if not exists public.services (
 id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.customers(id) on delete cascade,
 appointment_id uuid references public.appointments(id) on delete set null, service_type text not null,
 technician_id uuid references public.profiles(id) on delete set null, amount numeric(12,2) not null default 0,
 started_at timestamptz, completed_at timestamptz not null default now(), next_maintenance_date date,
 technical_notes text, customer_notes text, created_by uuid references public.profiles(id) default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create sequence if not exists public.hair_system_code_seq start 1;

create table if not exists public.hair_systems (
 id uuid primary key default gen_random_uuid(), code text not null unique default ('HS-' || lpad(nextval('public.hair_system_code_seq')::text,6,'0')), sku text, base text, colour text, size text, density text, length text,
 hair_type text, supplier text, batch text, cost numeric(12,2) not null default 0, selling_price numeric(12,2) not null default 0,
 received_date date, status text not null default 'available' check(status in ('available','reserved','installed','damaged','returned')),
 customer_id uuid references public.customers(id) on delete set null, reserved_at timestamptz, installed_date date, notes text,
 created_by uuid references public.profiles(id) default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.hair_systems alter column code set default ('HS-' || lpad(nextval('public.hair_system_code_seq')::text,6,'0'));

create table if not exists public.consumables (
 id uuid primary key default gen_random_uuid(), name text not null, sku text, category text, unit text not null default 'unit',
 qty numeric(12,2) not null default 0 check(qty>=0), min_qty numeric(12,2) not null default 0 check(min_qty>=0), supplier text, unit_cost numeric(12,2) not null default 0,
 created_by uuid references public.profiles(id) default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.inventory_movements (
 id uuid primary key default gen_random_uuid(), item_type text not null check(item_type in ('hair_system','consumable')), item_id uuid not null,
 movement_type text not null, qty numeric(12,2) not null, reason text, service_id uuid references public.services(id) on delete set null,
 created_by uuid references public.profiles(id) default auth.uid(), created_at timestamptz not null default now()
);

create table if not exists public.payments (
 id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.customers(id) on delete cascade,
 service_id uuid references public.services(id) on delete set null, type text not null default 'sale' check(type in ('sale','deposit','balance','refund')),
 method text not null default 'DuitNow QR', amount numeric(12,2) not null check(amount>=0), status text not null default 'paid' check(status in ('paid','outstanding','refunded')),
 reference text, notes text, paid_at timestamptz, created_by uuid references public.profiles(id) default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.credit_transactions (
 id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.customers(id) on delete cascade,
 type text not null check(type in ('topup','use','adjustment')), amount numeric(12,2) not null check(amount>=0), notes text,
 created_by uuid references public.profiles(id) default auth.uid(), created_at timestamptz not null default now()
);

create table if not exists public.media (
 id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.customers(id) on delete cascade,
 service_id uuid references public.services(id) on delete set null, kind text not null check(kind in ('before','process','after')),
 consent text not null default 'private' check(consent in ('private','public_blur','public')), storage_path text not null,
 created_by uuid references public.profiles(id) default auth.uid(), created_at timestamptz not null default now()
);

create table if not exists public.activity_log (
 id uuid primary key default gen_random_uuid(), user_id uuid references public.profiles(id) on delete set null,
 action text not null, entity_type text not null, entity_id uuid, details jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);

create index if not exists leads_followup_idx on public.leads(follow_up_date);
create index if not exists customers_phone_idx on public.customers(phone);
create index if not exists appointments_schedule_idx on public.appointments(scheduled_at);
create index if not exists appointments_customer_idx on public.appointments(customer_id);
create index if not exists services_customer_idx on public.services(customer_id);
create index if not exists hair_systems_status_idx on public.hair_systems(status);
create index if not exists payments_customer_idx on public.payments(customer_id);

-- updated_at triggers
DO $$ declare t text; begin
 foreach t in array array['profiles','leads','customers','appointments','services','hair_systems','consumables','payments'] loop
  execute format('drop trigger if exists trg_%I_updated_at on public.%I',t,t);
  execute format('create trigger trg_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()',t,t);
 end loop;
end $$;

create or replace function public.log_change() returns trigger language plpgsql security definer set search_path=public as $$
declare rid uuid; begin
 if tg_op='DELETE' then rid:=old.id; else rid:=new.id; end if;
 insert into public.activity_log(user_id,action,entity_type,entity_id,details)
 values(auth.uid(), lower(tg_op), tg_table_name, rid, jsonb_build_object('id',rid));
 if tg_op='DELETE' then return old; else return new; end if;
end $$;
DO $$ declare t text; begin
 foreach t in array array['leads','customers','appointments','services','hair_systems','consumables','payments','credit_transactions','media'] loop
  execute format('drop trigger if exists trg_%I_activity on public.%I',t,t);
  execute format('create trigger trg_%I_activity after insert or update or delete on public.%I for each row execute function public.log_change()',t,t);
 end loop;
end $$;


create or replace function public.log_opening_inventory() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_table_name='consumables' and new.qty>0 then
   insert into public.inventory_movements(item_type,item_id,movement_type,qty,reason,created_by) values('consumable',new.id,'stock_in',new.qty,'Opening stock',auth.uid());
 elsif tg_table_name='hair_systems' then
   insert into public.inventory_movements(item_type,item_id,movement_type,qty,reason,created_by) values('hair_system',new.id,'stock_in',1,'New hair system received',auth.uid());
 end if;
 return new;
end $$;
drop trigger if exists trg_consumables_opening on public.consumables;
create trigger trg_consumables_opening after insert on public.consumables for each row execute function public.log_opening_inventory();
drop trigger if exists trg_hair_systems_opening on public.hair_systems;
create trigger trg_hair_systems_opening after insert on public.hair_systems for each row execute function public.log_opening_inventory();

create or replace function public.convert_lead_to_customer(p_lead_id uuid) returns uuid
language plpgsql security invoker as $$
declare l public.leads; cid uuid; begin
 select * into l from public.leads where id=p_lead_id for update;
 if not found then raise exception 'Lead not found'; end if;
 insert into public.customers(name,phone,area,notes) values(l.name,l.phone,l.area,l.notes) returning id into cid;
 update public.leads set stage='customer' where id=p_lead_id;
 return cid;
end $$;

create or replace function public.adjust_consumable(p_consumable_id uuid,p_delta numeric,p_reason text default 'Adjustment') returns numeric
language plpgsql security invoker as $$
declare current_qty numeric; new_qty numeric; begin
 select qty into current_qty from public.consumables where id=p_consumable_id for update;
 if current_qty is null then raise exception 'Consumable not found'; end if;
 new_qty := current_qty + p_delta;
 if new_qty < 0 then raise exception 'Insufficient stock'; end if;
 update public.consumables set qty=new_qty where id=p_consumable_id;
 insert into public.inventory_movements(item_type,item_id,movement_type,qty,reason) values('consumable',p_consumable_id,case when p_delta>=0 then 'stock_in' else 'used' end,abs(p_delta),p_reason);
 return new_qty;
end $$;

create or replace function public.install_hair_system(p_system_id uuid,p_customer_id uuid,p_service_id uuid default null) returns uuid
language plpgsql security invoker as $$
begin
 update public.hair_systems set status='installed',customer_id=p_customer_id,installed_date=current_date where id=p_system_id and status<>'installed';
 if not found then raise exception 'Hair system unavailable or already installed'; end if;
 insert into public.inventory_movements(item_type,item_id,movement_type,qty,reason,service_id) values('hair_system',p_system_id,'installed',1,'Installed to customer',p_service_id);
 return p_system_id;
end $$;

create or replace function public.complete_service(p_payload jsonb,p_consumptions jsonb default '[]'::jsonb) returns uuid
language plpgsql security invoker as $$
declare sid uuid; x jsonb; cid uuid; q numeric; available numeric; amount numeric; begin
 insert into public.services(customer_id,appointment_id,service_type,technician_id,amount,completed_at,next_maintenance_date,technical_notes,customer_notes)
 values((p_payload->>'customer_id')::uuid,nullif(p_payload->>'appointment_id','')::uuid,p_payload->>'service_type',nullif(p_payload->>'technician_id','')::uuid,coalesce((p_payload->>'amount')::numeric,0),coalesce((p_payload->>'completed_at')::timestamptz,now()),nullif(p_payload->>'next_maintenance_date','')::date,p_payload->>'technical_notes',p_payload->>'customer_notes') returning id into sid;
 for x in select * from jsonb_array_elements(coalesce(p_consumptions,'[]'::jsonb)) loop
  cid := (x->>'consumable_id')::uuid; q := (x->>'qty')::numeric;
  select qty into available from public.consumables where id=cid for update;
  if available is null then raise exception 'Consumable not found'; end if;
  if available < q then raise exception 'Insufficient consumable stock'; end if;
  update public.consumables set qty=qty-q where id=cid;
  insert into public.inventory_movements(item_type,item_id,movement_type,qty,reason,service_id) values('consumable',cid,'used',q,'Used in service',sid);
 end loop;
 amount:=coalesce((p_payload->>'amount')::numeric,0);
 if amount>0 then
  insert into public.payments(customer_id,service_id,type,method,amount,status,paid_at)
  values((p_payload->>'customer_id')::uuid,sid,'sale',coalesce(p_payload->>'payment_method','Other'),amount,coalesce(p_payload->>'payment_status','paid'),case when coalesce(p_payload->>'payment_status','paid')='paid' then now() else null end);
 end if;
 if nullif(p_payload->>'appointment_id','') is not null then update public.appointments set status='completed' where id=(p_payload->>'appointment_id')::uuid; end if;
 return sid;
end $$;

-- TEMP TESTING RLS: authenticated users only. Final lockdown comes later.
DO $$ declare t text; begin
 foreach t in array array['profiles','leads','customers','appointments','services','hair_systems','consumables','inventory_movements','payments','credit_transactions','media','activity_log'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('drop policy if exists temp_authenticated_all on public.%I',t);
  execute format('create policy temp_authenticated_all on public.%I for all to authenticated using (true) with check (true)',t);
 end loop;
end $$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('customer-media','customer-media',false,10485760,array['image/jpeg','image/png','image/webp','image/heic'])
on conflict(id) do update set public=false;

drop policy if exists temp_customer_media_all on storage.objects;
create policy temp_customer_media_all on storage.objects for all to authenticated using(bucket_id='customer-media') with check(bucket_id='customer-media');

select 'PREP_SCHEMA_OK' as result;
