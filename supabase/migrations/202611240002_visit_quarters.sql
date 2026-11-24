alter table studio_member.visit_requests alter column phone drop not null;
create or replace function public.member_request_visit(p_key text,p_token uuid,p_preferred timestamptz,p_alternative timestamptz,p_service text,p_phone text,p_passengers int,p_note text)
returns uuid language plpgsql security definer set search_path='' as $$
declare cid uuid:=studio_member.ident(p_key); rid uuid;
begin
 perform 1 from public.customers where id=cid for update;
 select id into rid from studio_member.visit_requests where customer_id=cid and token=p_token;
 if found then return rid; end if;
 if not exists(select 1 from studio_member.visit_contact) then raise exception 'Studio contact unavailable'; end if;
 if p_preferred is null or p_preferred<=now() or p_alternative<=now() or p_alternative=p_preferred then raise exception 'Choose distinct future visit times'; end if;
 if exists(select 1 from unnest(array[p_preferred,p_alternative]) t where extract(minute from t)::int % 15 <> 0 or extract(second from t)<>0) then raise exception 'Choose minutes 00, 15, 30 or 45'; end if;
 if p_service is null or p_service not in ('Maintenance','Studio Consultation','New System Installation') or p_passengers is null or p_passengers not between 0 and 4 or length(coalesce(p_note,''))>500 then raise exception 'Check visit details and contact number'; end if;
 if exists(select 1 from studio_member.visit_requests where customer_id=cid and preferred=p_preferred and resolved_at is null) then raise exception 'You already requested this time. See My visits.'; end if;
 insert into studio_member.visit_requests(customer_id,token,preferred,alternative,service,phone,passengers,note) values(cid,p_token,p_preferred,p_alternative,p_service,nullif(trim(left(p_phone,30)),''),p_passengers,trim(coalesce(p_note,''))) returning id into rid;
 return rid;
end $$;
