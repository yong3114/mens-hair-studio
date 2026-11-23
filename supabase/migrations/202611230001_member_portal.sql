create schema studio_member;
revoke all on schema studio_member from public,anon,authenticated;
create table studio_member.operators(id uuid primary key references public.profiles(id));
insert into studio_member.operators select id from public.profiles where active;
create table studio_member.access(customer_id uuid primary key references public.customers(id) on delete cascade, key_hash bytea unique not null);
create table studio_member.slots(id uuid primary key default gen_random_uuid(),staff uuid not null references public.profiles(id),starts timestamptz not null, minutes int not null check(minutes between 15 and 240),service text not null check(service in ('Maintenance','Studio Consultation','New System Installation')));
create table studio_member.offers(id uuid primary key default gen_random_uuid(),title text not null check(length(trim(title)) between 1 and 100),cost int not null check(cost>0),active boolean not null default true);
create table studio_member.vouchers(id uuid primary key default gen_random_uuid(),customer_id uuid not null references public.customers(id) on delete cascade,offer uuid not null references studio_member.offers(id),title text not null,cost int not null,used_at timestamptz,request uuid not null,unique(customer_id,request));
create function studio_member.operator() returns uuid language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from studio_member.operators o join public.profiles p using(id) where o.id=auth.uid() and p.active) then raise exception 'Staff access required'; end if;
 return auth.uid();
end $$;
create function public.member_issue(p_customer uuid) returns text language plpgsql security definer set search_path='' as $$
declare k text:=encode(extensions.gen_random_bytes(20),'hex');
begin
 perform studio_member.operator();
 insert into studio_member.access values(p_customer,extensions.digest(k,'sha256')) on conflict(customer_id) do update set key_hash=excluded.key_hash;
 return k;
end $$;
create function studio_member.ident(k text) returns uuid language plpgsql set search_path='' as $$
declare cid uuid;
begin
 select customer_id into cid from studio_member.access where key_hash=extensions.digest(k,'sha256');
 if cid is null then raise exception 'Invalid member code'; end if; return cid;
end $$;
create function studio_member.points(cid uuid) returns integer language sql set search_path='' as $$
 select greatest(0,floor(coalesce((select sum(case when type='refund' then -amount else amount end) from public.payments where customer_id=cid and status='paid'),0)) - coalesce((select sum(cost) from studio_member.vouchers where customer_id=cid),0))::integer
$$;
create view studio_member.available as select s.* from studio_member.slots s join public.profiles p on p.id=s.staff and p.active where starts>now() and not exists(select 1 from public.appointments a where (a.assigned_user_id=s.staff or a.assigned_user_id is null) and a.status in ('tentative','confirmed','in_progress') and a.blocked_start<s.starts+s.minutes*interval '1 minute' and a.blocked_end>s.starts);
create function public.member_home(p_key text) returns jsonb language plpgsql security definer set search_path='' as $$
declare cid uuid:=studio_member.ident(p_key);
begin
 return jsonb_build_object('name',(select coalesce(nullif(name,''),whatsapp_name) from public.customers where id=cid),
 'credit',(select coalesce(sum(case when type='use' then -amount else amount end),0) from public.credit_transactions where customer_id=cid),
 'deal_balance',(select coalesce(sum(balance_amount),0) from public.deals where customer_id=cid and status<>'cancelled'),
 'outstanding',(select coalesce(sum(amount),0) from public.payments where customer_id=cid and status='outstanding'),
 'points',studio_member.points(cid),
 'systems',(select coalesce(jsonb_agg(jsonb_build_object('code',code,'installed',installed_date,'days',(now() at time zone 'Asia/Kuala_Lumpur')::date-installed_date::date) order by installed_date desc),'[]') from public.hair_systems where customer_id=cid and status='installed'),
 'due',(select next_maintenance_date from public.services where customer_id=cid and status='completed' order by completed_at desc nulls last limit 1),
 'visits',(select coalesce(jsonb_agg(jsonb_build_object('service',service_type,'starts',scheduled_at,'status',status) order by scheduled_at),'[]') from public.appointments where customer_id=cid and scheduled_at>=now() and status in ('tentative','confirmed','in_progress')),
 'slots',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'service',service,'starts',starts,'minutes',minutes) order by starts),'[]') from studio_member.available),
 'offers',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title,'cost',cost) order by cost),'[]') from studio_member.offers where active),
 'vouchers',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title,'used',used_at is not null)),'[]') from studio_member.vouchers where customer_id=cid));
end $$;
create function public.member_book(p_key text,p_slot uuid) returns void language plpgsql security definer set search_path='' as $$
declare cid uuid:=studio_member.ident(p_key); s studio_member.slots;
begin
 perform 1 from public.customers where id=cid for update;
 select * into s from studio_member.slots where id=p_slot for update;
 if not exists(select 1 from studio_member.available where id=p_slot) then raise exception 'This time is no longer available'; end if;
 if exists(select 1 from public.appointments where customer_id=cid and status in ('confirmed','tentative','in_progress') and blocked_start<s.starts+s.minutes*interval '1 minute' and blocked_end>s.starts) then raise exception 'You already have a booking at this time'; end if;
 insert into public.appointments(customer_id,assigned_user_id,service_type,scheduled_at,duration_min,location_type,status) values(cid,s.staff,s.service,s.starts,s.minutes,'studio','confirmed');
 delete from studio_member.slots where id=p_slot;
end $$;
create function public.member_redeem(p_key text,p_offer uuid,p_request uuid) returns void language plpgsql security definer set search_path='' as $$
declare cid uuid:=studio_member.ident(p_key); o studio_member.offers;
begin
 perform 1 from public.customers where id=cid for update;
 if exists(select 1 from studio_member.vouchers where customer_id=cid and request=p_request) then return; end if;
 select * into strict o from studio_member.offers where id=p_offer and active for share;
 if studio_member.points(cid)<o.cost then raise exception 'Not enough points'; end if;
 insert into studio_member.vouchers(customer_id,offer,title,cost,request) values(cid,o.id,o.title,o.cost,p_request);
end $$;
create function public.member_manage(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare staff_id uuid:=studio_member.operator();
begin
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
revoke all on function public.member_issue(uuid), public.member_manage(text,jsonb) from public,anon,authenticated;
grant execute on function public.member_issue(uuid),public.member_manage(text,jsonb) to authenticated;
revoke all on function public.member_home(text),public.member_book(text,uuid),public.member_redeem(text,uuid,uuid) from public;
grant execute on function public.member_home(text),public.member_book(text,uuid),public.member_redeem(text,uuid,uuid) to anon,authenticated;
