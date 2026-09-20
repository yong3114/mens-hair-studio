-- MEN'S HAIR STUDIO V2.1 — FINAL RLS LOCKDOWN
-- Run ONLY after localhost + production tests pass.

create or replace function public.is_active_admin() returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles p where p.id=auth.uid() and p.active=true and p.role='admin');
$$;
revoke all on function public.is_active_admin() from public;
grant execute on function public.is_active_admin() to authenticated;

DO $$ declare t text; begin
 foreach t in array array['profiles','leads','customers','appointments','services','hair_systems','consumables','inventory_movements','payments','credit_transactions','media','activity_log'] loop
  execute format('drop policy if exists temp_authenticated_all on public.%I',t);
  execute format('drop policy if exists admin_all on public.%I',t);
  execute format('create policy admin_all on public.%I for all to authenticated using (public.is_active_admin()) with check (public.is_active_admin())',t);
 end loop;
end $$;

drop policy if exists temp_customer_media_all on storage.objects;
drop policy if exists admin_customer_media_all on storage.objects;
create policy admin_customer_media_all on storage.objects for all to authenticated
using(bucket_id='customer-media' and public.is_active_admin())
with check(bucket_id='customer-media' and public.is_active_admin());

select 'FINAL_RLS_LOCKDOWN_OK' as result;
