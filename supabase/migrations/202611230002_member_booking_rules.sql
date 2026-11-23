insert into studio_member.offers(title,cost) values('RM10 studio voucher',300);
create or replace view studio_member.available as
select s.* from studio_member.slots s join public.profiles p on p.id=s.staff and p.active
where starts>now() and not exists(select 1 from public.appointments a where (a.assigned_user_id=s.staff or a.assigned_user_id is null) and a.status in ('tentative','confirmed','in_progress') and a.blocked_start<s.starts+s.minutes*interval '1 minute' and a.blocked_end>s.starts)
and not exists(select 1 from (select s.starts as at_time union select a.scheduled_at from public.appointments a where a.scheduled_at>=s.starts and a.scheduled_at<s.starts+s.minutes*interval '1 minute') times
where (select count(*) from public.appointments a where a.status in ('tentative','confirmed','in_progress') and a.location_type='studio' and a.scheduled_at<=times.at_time and a.scheduled_at+a.duration_min*interval '1 minute'>times.at_time)>=4);
create function public.member_book_visit(p_key text,p_slot uuid,p_pickup int) returns void language plpgsql security definer set search_path='' as $$
declare cid uuid:=studio_member.ident(p_key); s studio_member.slots;
begin
 if p_pickup is null or p_pickup not between 0 and 2 then raise exception 'Choose no pickup, one passenger or two passengers'; end if;
 lock table public.appointments in share row exclusive mode;
 perform 1 from public.customers where id=cid for update;
 select * into s from studio_member.slots where id=p_slot for update;
 if not exists(select 1 from studio_member.available where id=p_slot) then raise exception 'This time is no longer available'; end if;
 if exists(select 1 from public.appointments where customer_id=cid and status in ('confirmed','tentative','in_progress') and blocked_start<s.starts+s.minutes*interval '1 minute' and blocked_end>s.starts) then raise exception 'You already have a booking at this time'; end if;
 insert into public.appointments(customer_id,assigned_user_id,service_type,scheduled_at,duration_min,location_type,status,notes) values(cid,s.staff,s.service,s.starts,s.minutes,'studio','confirmed',case p_pickup when 1 then 'JB CIQ pickup requested: 1 passenger. Confirm with client.' when 2 then 'JB CIQ pickup requested: 2 passengers (client + companion). Confirm with client.' end);
 delete from studio_member.slots where id=p_slot;
end $$;

create or replace function public.member_book(p_key text,p_slot uuid) returns void language sql security invoker set search_path='' as $$ select public.member_book_visit(p_key,p_slot,0) $$;
revoke all on function public.member_book_visit(text,uuid,int) from public;
grant execute on function public.member_book_visit(text,uuid,int) to anon,authenticated;