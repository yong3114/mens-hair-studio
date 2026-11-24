create table studio_member.phone_changes(
 id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.customers on delete cascade,
 requested text not null, created_at timestamptz not null default now(), decision text check(decision in ('approved','declined')), decided_by uuid, decided_at timestamptz
);
create unique index phone_change_pending on studio_member.phone_changes(customer_id) where decision is null;
revoke all on studio_member.phone_changes from public,anon,authenticated;
create function studio_member.edit_fields(cid uuid) returns jsonb language sql set search_path='' as $$
 select jsonb_build_object('name',name,'whatsapp_name',whatsapp_name,'email',email,'area',area) from public.customers where id=cid
$$;
create or replace function studio_member.request_data(cid uuid) returns jsonb language sql set search_path='' as $$
 select jsonb_build_object('contact',(select phone from studio_member.visit_contact),'edit_fields',studio_member.edit_fields(cid),
 'phone_change',(select jsonb_build_object('number',requested,'status',coalesce(decision,'pending')) from studio_member.phone_changes where customer_id=cid order by created_at desc,id desc limit 1),
 'requests',coalesce((select jsonb_agg(to_jsonb(r)-'customer_id'-'token' order by created_at desc)
 from studio_member.visit_requests r where customer_id=cid and resolved_at is null),'[]'::jsonb))
$$;
create function public.member_save_profile(p_key text,p_before jsonb,p_name text,p_display text,p_email text,p_area text)
returns void language plpgsql security definer set search_path='' as $$
declare cid uuid:=studio_member.ident(p_key);
begin
 perform 1 from public.customers where id=cid for update;
 if studio_member.edit_fields(cid) is distinct from p_before then raise exception 'Profile changed. Close the editor and refresh before saving.';end if;
 if nullif(trim(p_name),'') is null and nullif(trim(p_display),'') is null then raise exception 'Enter a name or preferred name.';end if;
 if greatest(length(p_name),length(p_display),length(p_area))>120 or length(p_email)>254 or (nullif(trim(p_email),'') is not null and trim(p_email) !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$') then raise exception 'Check your profile details.';end if;
 update public.customers set name=nullif(trim(p_name),''),whatsapp_name=nullif(trim(p_display),''),email=nullif(trim(p_email),''),area=nullif(trim(p_area),'') where id=cid;
end $$;
create function public.member_request_phone(p_key text,p_phone text) returns void language plpgsql security definer set search_path='' as $$
declare cid uuid:=studio_member.ident(p_key); n text:=studio_member.normalize_phone(p_phone); old text;
begin
 select studio_member.normalize_phone(phone) into old from public.customers where id=cid for update;
 if n is null or n=coalesce((select phone from studio_member.phone_logins where customer_id=cid),old) then raise exception 'Enter a different valid mobile number with +60 or +65.';end if;
 if exists(select 1 from studio_member.phone_changes where customer_id=cid and decision is null and requested=n) then return;end if;
 insert into studio_member.phone_changes(customer_id,requested) values(cid,n);
exception when unique_violation then raise exception 'A number change is already pending.';
end $$;
create function public.staff_phone_changes() returns jsonb language plpgsql security definer set search_path='' as $$
begin perform studio_member.operator();
 return coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'name',coalesce(c.name,c.whatsapp_name),'old',coalesce(p.phone,c.phone),'requested',r.requested) order by r.created_at)
 from studio_member.phone_changes r join public.customers c on c.id=r.customer_id left join studio_member.phone_logins p on p.customer_id=c.id where decision is null),'[]'::jsonb);
end $$;
create function public.staff_decide_phone(p_id uuid,p_approve boolean) returns void language plpgsql security definer set search_path='' as $$
declare staff uuid:=studio_member.operator(); r studio_member.phone_changes; cid uuid;
begin
 select customer_id into strict cid from studio_member.phone_changes where id=p_id;
 perform 1 from public.customers where id=cid for update;
 select * into strict r from studio_member.phone_changes where id=p_id for update;
 if r.decision is not null then return;end if;
 if p_approve then
  perform pg_advisory_xact_lock(hashtextextended(r.requested,0));
  if exists(select 1 from public.customers where id<>cid and studio_member.normalize_phone(phone)=r.requested) then raise exception 'Number already belongs to another client.';end if;
  update studio_member.phone_logins set phone=r.requested,invitation=null,expires=null,failures=0,retry_at=null where customer_id=cid;
  update public.customers set phone='+'||r.requested where id=cid;
  delete from studio_member.login_sessions where customer_id=cid;
 end if;
 update studio_member.phone_changes set decision=case when p_approve then 'approved' else 'declined' end,decided_by=staff,decided_at=now() where id=p_id;
exception when unique_violation then raise exception 'Number already belongs to another client.';
end $$;
revoke all on function public.member_save_profile(text,jsonb,text,text,text,text),public.member_request_phone(text,text),public.staff_phone_changes(),public.staff_decide_phone(uuid,boolean) from public,anon,authenticated;
grant execute on function public.member_save_profile(text,jsonb,text,text,text,text),public.member_request_phone(text,text) to anon,authenticated;
grant execute on function public.staff_phone_changes(),public.staff_decide_phone(uuid,boolean) to authenticated;
