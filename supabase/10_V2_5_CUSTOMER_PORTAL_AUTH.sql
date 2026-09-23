-- MEN'S HAIR STUDIO V2.5 — CUSTOMER PORTAL AUTH + SECURITY BOUNDARY
-- QA FIRST. Do not run directly on production before backup + policy review.
--
-- Customer login model:
-- - Staff remain Supabase Auth users with a row in public.profiles.
-- - Customers use Supabase Email OTP / Magic Link.
-- - A customer can claim portal access only when:
--     1) the auth email is verified,
--     2) a customer row has the same email,
--     3) portal_enabled = true.
-- - Customers do NOT receive direct table access. A narrow SECURITY DEFINER
--   RPC returns only their own customer-safe portal data.
--
-- IMPORTANT:
-- This migration also removes the old dangerous behaviour where every new
-- auth.users row automatically became an admin profile.

-- 1) Customer portal switch.
alter table public.customers
  add column if not exists portal_enabled boolean not null default false;

alter table public.customers
  add column if not exists portal_enabled_at timestamptz;

create unique index if not exists customers_portal_email_unique
on public.customers ((lower(trim(email))))
where portal_enabled=true and nullif(trim(email),'') is not null;

-- 2) Auth user <-> customer mapping.
create table if not exists public.customer_accounts (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  customer_id uuid not null unique references public.customers(id) on delete cascade,
  email text not null,
  active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_customer_accounts_updated_at on public.customer_accounts;
create trigger trg_customer_accounts_updated_at
before update on public.customer_accounts
for each row execute function public.set_updated_at();

-- 3) STOP automatically creating an admin for every Auth signup.
-- Existing Yong / Ah Bi profile rows are preserved.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- 4) Staff / customer identity helpers.
create or replace function public.is_active_staff() returns boolean
language sql stable security definer set search_path=public as $$
  select exists(
    select 1
    from public.profiles p
    where p.id=auth.uid()
      and p.active=true
      and p.role in ('admin','staff')
  );
$$;

create or replace function public.is_active_admin() returns boolean
language sql stable security definer set search_path=public as $$
  select exists(
    select 1
    from public.profiles p
    where p.id=auth.uid()
      and p.active=true
      and p.role='admin'
  );
$$;

create or replace function public.current_customer_id() returns uuid
language sql stable security definer set search_path=public,auth as $$
  select ca.customer_id
  from public.customer_accounts ca
  join public.customers c on c.id=ca.customer_id
  join auth.users u on u.id=ca.auth_user_id
  where ca.auth_user_id=auth.uid()
    and ca.active=true
    and c.portal_enabled=true
    and nullif(trim(c.email),'') is not null
    and lower(trim(c.email))=lower(trim(u.email))
  limit 1;
$$;

revoke all on function public.is_active_staff() from public;
revoke all on function public.is_active_admin() from public;
revoke all on function public.current_customer_id() from public;
grant execute on function public.is_active_staff() to authenticated;
grant execute on function public.is_active_admin() to authenticated;
grant execute on function public.current_customer_id() to authenticated;

-- 5) RLS: business tables are staff-only.
-- Customers read their portal through get_my_customer_portal().
DO $$ declare t text; begin
  foreach t in array array[
    'leads','lead_followups','customers','appointments','consultations','deals',
    'services','hair_systems','consumables','inventory_movements','payments',
    'payment_allocations','credit_transactions','media','notifications','activity_log'
  ] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('drop policy if exists temp_authenticated_all on public.%I',t);
    execute format('drop policy if exists admin_all on public.%I',t);
    execute format('drop policy if exists active_staff_all on public.%I',t);
    execute format('drop policy if exists staff_all on public.%I',t);
    execute format(
      'create policy staff_all on public.%I for all to authenticated using (public.is_active_staff()) with check (public.is_active_staff())',
      t
    );
  end loop;
end $$;

-- Profiles: staff may read team members; only admins may write staff profiles.
alter table public.profiles enable row level security;
drop policy if exists temp_authenticated_all on public.profiles;
drop policy if exists admin_all on public.profiles;
drop policy if exists active_staff_all on public.profiles;
drop policy if exists staff_all on public.profiles;
drop policy if exists staff_profiles_read on public.profiles;
drop policy if exists admin_profiles_write on public.profiles;

create policy staff_profiles_read on public.profiles
for select to authenticated
using (public.is_active_staff());

create policy admin_profiles_write on public.profiles
for all to authenticated
using (public.is_active_admin())
with check (public.is_active_admin());

-- Customer account mappings.
alter table public.customer_accounts enable row level security;
drop policy if exists customer_account_self_read on public.customer_accounts;
drop policy if exists staff_customer_accounts_read on public.customer_accounts;

create policy customer_account_self_read on public.customer_accounts
for select to authenticated
using (auth_user_id=auth.uid());

create policy staff_customer_accounts_read on public.customer_accounts
for select to authenticated
using (public.is_active_staff());

grant select on public.customer_accounts to authenticated;

-- 6) Customer claims access only through a verified matching email.
create or replace function public.claim_customer_portal_access() returns uuid
language plpgsql security definer set search_path=public,auth as $$
declare
  uid uuid := auth.uid();
  auth_email text;
  customer_uuid uuid;
begin
  if uid is null then
    raise exception 'Sign in first';
  end if;

  if exists(select 1 from public.profiles p where p.id=uid) then
    raise exception 'Staff accounts use the staff login';
  end if;

  select lower(trim(u.email))
  into auth_email
  from auth.users u
  where u.id=uid
    and u.email_confirmed_at is not null;

  if auth_email is null or auth_email='' then
    raise exception 'A verified email is required';
  end if;

  select c.id
  into customer_uuid
  from public.customers c
  where c.portal_enabled=true
    and c.status='active'
    and lower(trim(c.email))=auth_email
  limit 1;

  if customer_uuid is null then
    raise exception 'Customer portal access is not enabled for this email';
  end if;

  delete from public.customer_accounts
  where auth_user_id=uid and customer_id<>customer_uuid;

  insert into public.customer_accounts(auth_user_id,customer_id,email,active,last_login_at)
  values(uid,customer_uuid,auth_email,true,now())
  on conflict(customer_id) do update
    set auth_user_id=excluded.auth_user_id,
        email=excluded.email,
        active=true,
        last_login_at=now();

  return customer_uuid;
end $$;

revoke all on function public.claim_customer_portal_access() from public;
grant execute on function public.claim_customer_portal_access() to authenticated;

-- 7) Customer-safe portal payload. Internal notes / staff-only records are omitted.
create or replace function public.get_my_customer_portal() returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  cid uuid := public.current_customer_id();
  result jsonb;
begin
  if cid is null then
    raise exception 'Customer portal access unavailable';
  end if;

  select jsonb_build_object(
    'customer', (
      select jsonb_build_object(
        'id',c.id,
        'name',c.name,
        'whatsapp_name',c.whatsapp_name,
        'phone',c.phone,
        'email',c.email,
        'area',c.area,
        'address',c.address,
        'place_name',c.place_name,
        'google_place_id',c.google_place_id,
        'lat',c.lat,
        'lng',c.lng,
        'google_maps_url',c.google_maps_url,
        'lifecycle_stage',c.lifecycle_stage
      )
      from public.customers c where c.id=cid
    ),
    'appointments', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.scheduled_at desc)
      from (
        select a.id,a.scheduled_at,a.duration_min,a.status,a.service_type,
               a.location_type,a.address,a.place_name,a.google_maps_url
        from public.appointments a
        where a.customer_id=cid
      ) x
    ),'[]'::jsonb),
    'services', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.completed_at desc nulls last, x.started_at desc)
      from (
        select s.id,s.service_type,s.status,s.started_at,s.completed_at,
               s.next_maintenance_date,s.customer_notes
        from public.services s
        where s.customer_id=cid
      ) x
    ),'[]'::jsonb),
    'systems', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.installed_date desc nulls last)
      from (
        select h.id,h.code,h.status,h.base,h.colour,h.size,h.density,h.length,
               h.hair_type,h.installed_date
        from public.hair_systems h
        where h.customer_id=cid
      ) x
    ),'[]'::jsonb),
    'payments', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id',p.id,
          'type',p.type,
          'method',p.method,
          'amount',p.amount,
          'status',p.status,
          'paid_at',p.paid_at,
          'created_at',p.created_at,
          'payment_allocations',coalesce((
            select jsonb_agg(jsonb_build_object('deal_id',pa.deal_id,'amount',pa.amount))
            from public.payment_allocations pa
            where pa.payment_id=p.id
          ),'[]'::jsonb)
        )
        order by p.created_at desc
      )
      from public.payments p
      where p.customer_id=cid
    ),'[]'::jsonb),
    'credits', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at desc)
      from (
        select cr.id,cr.type,cr.amount,cr.created_at
        from public.credit_transactions cr
        where cr.customer_id=cid
      ) x
    ),'[]'::jsonb),
    'media', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at desc)
      from (
        select m.id,m.service_id,m.kind,m.consent,m.storage_path,m.created_at
        from public.media m
        where m.customer_id=cid
      ) x
    ),'[]'::jsonb),
    'deals', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.signed_at desc)
      from (
        select d.id,d.status,d.system_source,d.final_price,d.deposit_amount,
               d.paid_amount,d.refunded_amount,d.balance_amount,
               d.expected_ready_date,d.signed_at,d.installed_at,
               h.code as hair_system_code
        from public.deals d
        left join public.hair_systems h on h.id=d.hair_system_id
        where d.customer_id=cid
      ) x
    ),'[]'::jsonb)
  )
  into result;

  update public.customer_accounts
  set last_login_at=now()
  where auth_user_id=auth.uid();

  return result;
end $$;

revoke all on function public.get_my_customer_portal() from public;
grant execute on function public.get_my_customer_portal() to authenticated;

-- 8) Storage: staff manage all customer media; customers can only read their own folder.
drop policy if exists temp_customer_media_all on storage.objects;
drop policy if exists admin_customer_media_all on storage.objects;
drop policy if exists staff_customer_media_all on storage.objects;
drop policy if exists customer_media_read_own on storage.objects;

create policy staff_customer_media_all on storage.objects
for all to authenticated
using(bucket_id='customer-media' and public.is_active_staff())
with check(bucket_id='customer-media' and public.is_active_staff());

create policy customer_media_read_own on storage.objects
for select to authenticated
using(
  bucket_id='customer-media'
  and public.current_customer_id() is not null
  and (storage.foldername(name))[1]=public.current_customer_id()::text
);

-- 9) Anonymous readiness check used by the login screen.
create or replace function public.customer_portal_ready() returns boolean
language sql stable security definer set search_path=public as $$
  select true;
$$;

revoke all on function public.customer_portal_ready() from public;
grant execute on function public.customer_portal_ready() to anon,authenticated;

select 'V2_5_CUSTOMER_PORTAL_AUTH_READY' as result;
