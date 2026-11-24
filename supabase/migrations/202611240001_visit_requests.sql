create table studio_member.visit_contact (
 singleton boolean primary key default true check(singleton),
 phone text not null check(phone ~ '^[1-9][0-9]{7,14}$')
);
create table studio_member.visit_requests (
 id uuid primary key default gen_random_uuid(),
 customer_id uuid not null references public.customers on delete cascade,
 token uuid not null, preferred timestamptz not null, alternative timestamptz,
 service text not null, phone text not null, passengers int not null, note text not null,
 created_at timestamptz not null default now(), resolved_at timestamptz,
 appointment_id uuid references public.appointments on delete set null,
 unique(customer_id,token)
);
create index on studio_member.visit_requests(customer_id,created_at) where resolved_at is null;
create function studio_member.request_data(cid uuid) returns jsonb language sql set search_path='' as $$
 select jsonb_build_object('contact',(select phone from studio_member.visit_contact),
 'requests',coalesce((select jsonb_agg(to_jsonb(r)-'customer_id'-'token' order by created_at desc)
 from studio_member.visit_requests r where customer_id=cid and resolved_at is null),'[]'::jsonb))
$$;
create or replace function public.member_home(p_key text) returns jsonb language plpgsql security definer set search_path='' as $$
declare cid uuid:=studio_member.ident(p_key);
begin return (studio_member.home_for(cid) || jsonb_build_object('slots','[]'::jsonb)) || studio_member.request_data(cid); end $$;
create or replace function public.member_preview(p_customer uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform studio_member.operator();
 if not exists(select 1 from public.customers where id=p_customer) then raise exception 'Client unavailable'; end if;
 return (studio_member.home_for(p_customer) || jsonb_build_object('slots','[]'::jsonb)) || studio_member.request_data(p_customer); end $$;
create function public.member_request_visit(p_key text,p_token uuid,p_preferred timestamptz,p_alternative timestamptz,p_service text,p_phone text,p_passengers int,p_note text)
returns uuid language plpgsql security definer set search_path='' as $$
declare cid uuid:=studio_member.ident(p_key); rid uuid;
begin
 perform 1 from public.customers where id=cid for update;
 select id into rid from studio_member.visit_requests where customer_id=cid and token=p_token;
 if found then return rid; end if;
 if not exists(select 1 from studio_member.visit_contact) then raise exception 'Studio contact unavailable'; end if;
 if p_preferred is null or p_preferred<=now() or p_alternative<=now() or p_alternative=p_preferred then raise exception 'Choose distinct future visit times'; end if;
 if p_service is null or p_service not in ('Maintenance','Studio Consultation','New System Installation') or p_passengers is null or p_passengers not between 0 and 4 or length(trim(p_phone)) not between 7 and 30 or coalesce(p_phone,'') !~ '^[+0-9 ()-]+$' or length(regexp_replace(p_phone,'[^0-9]','','g')) not between 7 and 15 or length(coalesce(p_note,''))>500 then raise exception 'Check visit details and contact number'; end if;
 if exists(select 1 from studio_member.visit_requests where customer_id=cid and preferred=p_preferred and resolved_at is null) then raise exception 'You already requested this time. See My visits.'; end if;
 insert into studio_member.visit_requests(customer_id,token,preferred,alternative,service,phone,passengers,note) values(cid,p_token,p_preferred,p_alternative,p_service,trim(p_phone),p_passengers,trim(coalesce(p_note,''))) returning id into rid;
 return rid;
end $$;
create function public.staff_visit_requests() returns jsonb language plpgsql security definer set search_path='' as $$
begin perform studio_member.operator();
 return coalesce((select jsonb_agg((to_jsonb(r)-'token') || jsonb_build_object('name',coalesce(nullif(c.name,''),c.whatsapp_name)) order by r.created_at)
 from studio_member.visit_requests r join public.customers c on c.id=r.customer_id where resolved_at is null),'[]'::jsonb);
end $$;
create function public.confirm_visit_request(p_id uuid,p_start timestamptz,p_minutes int,p_staff uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare r studio_member.visit_requests; aid uuid; finish timestamptz;
begin perform studio_member.operator();
 select * into strict r from studio_member.visit_requests where id=p_id for update;
 if r.resolved_at is not null then return r.appointment_id; end if;
 if p_start is null or p_start<=now() or p_minutes is null or p_minutes not in(60,90,120) or not exists(select 1 from public.profiles where id=p_staff and active) then raise exception 'Choose a future time, duration and active staff member'; end if;
 finish:=p_start+p_minutes*interval '1 minute';
 lock table public.appointments in share row exclusive mode;
 if exists(select 1 from public.appointments where status in ('tentative','confirmed','in_progress') and (customer_id=r.customer_id or assigned_user_id=p_staff or assigned_user_id is null) and blocked_start<finish and blocked_end>p_start) then raise exception 'This time overlaps a staff or client booking'; end if;
 if exists(with rooms as (select scheduled_at as starts,scheduled_at+duration_min*interval '1 minute' as ends from public.appointments where location_type='studio' and status in ('tentative','confirmed','in_progress') and scheduled_at<finish and scheduled_at+duration_min*interval '1 minute'>p_start)
 select 1 from (select p_start as t union select starts from rooms where starts>=p_start) times where (select count(*) from rooms where starts<=t and ends>t)>=2) then raise exception 'Both studio rooms are booked'; end if;
 insert into public.appointments(customer_id,assigned_user_id,service_type,scheduled_at,duration_min,location_type,status,notes) values(r.customer_id,p_staff,r.service,p_start,p_minutes,'studio','confirmed',concat_ws(E'\n','Contact: '||r.phone,case when r.passengers>0 then 'JB CIQ pickup: '||r.passengers||' passenger(s)' end,nullif(r.note,''))) returning id into aid;
 update studio_member.visit_requests set appointment_id=aid,resolved_at=now() where id=p_id;
 return aid;
end $$;
revoke all on function public.member_request_visit(text,uuid,timestamptz,timestamptz,text,text,int,text),public.staff_visit_requests(),public.confirm_visit_request(uuid,timestamptz,int,uuid) from public,anon,authenticated;
grant execute on function public.member_request_visit(text,uuid,timestamptz,timestamptz,text,text,int,text) to anon,authenticated;
grant execute on function public.staff_visit_requests(),public.confirm_visit_request(uuid,timestamptz,int,uuid) to authenticated;
revoke execute on function public.member_book(text,uuid),public.member_book_visit(text,uuid,int) from public,anon,authenticated;
