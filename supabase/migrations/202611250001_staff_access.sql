-- Membership is provisioned separately from a Supabase Auth account.
create function public.studio_staff_role() returns text language sql stable security definer set search_path='' as $$
 select p.role::text from studio_member.operators o join public.profiles p using(id)
 where o.id=auth.uid() and p.active and p.role in ('admin','staff')
$$;
revoke all on function public.studio_staff_role() from public, anon;
grant execute on function public.studio_staff_role() to authenticated;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,email,full_name,role,active)
 values(new.id,new.email,coalesce(nullif(new.raw_user_meta_data->>'full_name',''),split_part(new.email,'@',1),'Staff'),'staff',false)
 on conflict(id) do nothing;
 return new;
end $$;

do $$
declare t text;
begin
 foreach t in array array['profiles','leads','lead_followups','customers','appointments','consultations','deals','services','hair_systems','consumables','inventory_movements','payments','payment_allocations','credit_transactions','media','notifications','activity_log'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon, public',t);
  execute format('revoke truncate, references, trigger on public.%I from authenticated',t);
  execute format('create policy studio_staff_required on public.%I as restrictive for all to authenticated using ((select public.studio_staff_role()) is not null) with check ((select public.studio_staff_role()) is not null)',t);
  if t <> 'notifications' then
   execute format('create policy studio_admin_delete on public.%I as restrictive for delete to authenticated using ((select public.studio_staff_role()) = ''admin'')',t);
  end if;
 end loop;
end $$;

create policy studio_profile_admin_insert on public.profiles as restrictive for insert to authenticated with check ((select public.studio_staff_role())='admin');
create policy studio_profile_admin_update on public.profiles as restrictive for update to authenticated using ((select public.studio_staff_role())='admin') with check ((select public.studio_staff_role())='admin');
create policy studio_own_notifications on public.notifications as restrictive for all to authenticated
 using ((select public.studio_staff_role())='admin' or recipient_user_id=(select auth.uid()))
 with check ((select public.studio_staff_role())='admin' or recipient_user_id=(select auth.uid()));
-- The application writes audit entries via its owner-run trigger.
revoke insert,update,delete on public.activity_log from authenticated;
create policy studio_media_staff on storage.objects as restrictive for all to authenticated
 using (bucket_id<>'customer-media' or (select public.studio_staff_role()) is not null)
 with check (bucket_id<>'customer-media' or (select public.studio_staff_role()) is not null);
create policy studio_media_admin_delete on storage.objects as restrictive for delete to authenticated
 using (bucket_id<>'customer-media' or (select public.studio_staff_role())='admin');

-- Financial rollups are invoked by owner-run allocation and payment triggers.
revoke all on function public.refresh_deal_financials(uuid) from public,anon,authenticated;

create or replace function public.member_manage(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare staff_id uuid:=studio_member.operator();
begin
 if p_action in ('offer','close_offer') and public.studio_staff_role() is distinct from 'admin' then
  raise exception 'Administrator access required';
 end if;
 case p_action
 when 'slot' then
 if (p_data->>'starts')::timestamptz<=now() then raise exception 'Choose a future time'; end if;
 insert into studio_member.slots(staff,starts,minutes,service) values(staff_id,(p_data->>'starts')::timestamptz,(p_data->>'minutes')::int,p_data->>'service');
 when 'offer' then insert into studio_member.offers(title,cost) values(trim(p_data->>'title'),(p_data->>'cost')::int);
 when 'remove_slot' then delete from studio_member.slots where id=(p_data->>'id')::uuid and staff=staff_id;
 when 'close_offer' then update studio_member.offers set active=false where id=(p_data->>'id')::uuid;
 when 'use' then update studio_member.vouchers set used_at=now() where id=(p_data->>'id')::uuid and used_at is null; if not found then raise exception 'Voucher unavailable or already used'; end if;
 when 'list' then null;
 else raise exception 'Unknown action'; end case;
 return jsonb_build_object('offers',(select coalesce(jsonb_agg(to_jsonb(o)),'[]') from studio_member.offers o where active),'slots',(select coalesce(jsonb_agg(to_jsonb(s) order by starts),'[]') from studio_member.slots s where staff=staff_id and starts>now()));
end $$;
