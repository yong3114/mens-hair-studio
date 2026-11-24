create table studio_member.phone_logins (
 customer_id uuid primary key references public.customers on delete cascade,
 phone text not null unique, secret text, invitation bytea unique, expires timestamptz,
 failures integer not null default 0, retry_at timestamptz
);
create table studio_member.login_sessions (
 digest bytea primary key, customer_id uuid not null references studio_member.phone_logins on delete cascade,
 expires timestamptz not null
);
create index on studio_member.login_sessions(customer_id);
revoke all on studio_member.phone_logins,studio_member.login_sessions from public, anon, authenticated;

create function studio_member.normalize_phone(raw text) returns text language plpgsql immutable set search_path='' as $$
declare n text:=regexp_replace(trim(raw),'[()[:space:]-]','','g');
begin
 if n like '0%' then n:='60'||substr(n,2); end if;
 n:=regexp_replace(n,'^\+','');
 if n ~ '^(601[0-9]{8,9}|65[89][0-9]{7})$' then return n; end if;
 return null;
end $$;

create function public.member_login_link(p_customer uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare n text; previous studio_member.phone_logins; ticket text:=encode(extensions.gen_random_bytes(32),'hex');
begin
 perform studio_member.operator();
 select studio_member.normalize_phone(phone) into n from public.customers where id=p_customer for update;
 if not found then raise exception 'Client unavailable'; end if;
 select * into previous from studio_member.phone_logins where customer_id=p_customer for update;
 if previous.secret is not null then n:=previous.phone; end if;
 if n is null then raise exception 'Save a verified Malaysian or Singapore mobile number on the client profile first. Include +65 for Singapore.'; end if;
 insert into studio_member.phone_logins(customer_id,phone,invitation,expires)
 values(p_customer,n,extensions.digest(ticket,'sha256'),now()+interval '30 minutes')
 on conflict(customer_id) do update set phone=excluded.phone, invitation=excluded.invitation,expires=excluded.expires;
 return jsonb_build_object('phone',n,'ticket',ticket,'reset',previous.secret is not null);
exception when unique_violation then raise exception 'This number is already linked to another client. Check the client records.';
end $$;

create function public.member_set_password(p_ticket text,p_phone text,p_password text) returns boolean language plpgsql security definer set search_path='' as $$
declare account studio_member.phone_logins;
begin
 select * into account from studio_member.phone_logins where invitation=extensions.digest(p_ticket,'sha256') and expires>clock_timestamp() for update;
 if not found or studio_member.normalize_phone(p_phone) is distinct from account.phone then raise exception 'Check your phone number or ask the studio for a new link.'; end if;
 if p_password is null or length(p_password)<15 or octet_length(p_password)>72 then raise exception 'Use at least 15 characters and at most 72 bytes.'; end if;
 update studio_member.phone_logins set secret=extensions.crypt(p_password,extensions.gen_salt('bf',12)),invitation=null,expires=null,failures=0,retry_at=null where customer_id=account.customer_id;
 delete from studio_member.access where customer_id=account.customer_id;
 delete from studio_member.login_sessions where customer_id=account.customer_id;
 return true;
end $$;

create function public.member_password_login(p_phone text,p_password text) returns text language plpgsql security definer set search_path='' as $$
declare account studio_member.phone_logins; bearer text;
begin
 if p_password is null or octet_length(p_password)>72 then return null; end if;
 select * into account from studio_member.phone_logins where phone=studio_member.normalize_phone(p_phone) and secret is not null for update;
 if not found or account.retry_at>clock_timestamp() then return null; end if;
 if extensions.crypt(p_password,account.secret)<>account.secret then
  update studio_member.phone_logins set failures=(failures+1)%5,retry_at=case when failures>=4 then clock_timestamp()+interval '15 minutes' end where customer_id=account.customer_id;
  return null;
 end if;
 update studio_member.phone_logins set failures=0,retry_at=null where customer_id=account.customer_id;
 delete from studio_member.login_sessions where customer_id=account.customer_id and expires<=now();
 bearer:=encode(extensions.gen_random_bytes(32),'hex');
 insert into studio_member.login_sessions values(extensions.digest(bearer,'sha256'),account.customer_id,now()+interval '7 days');
 return bearer;
end $$;
create function public.member_end_session(p_key text) returns void language sql security definer set search_path='' as $$
 delete from studio_member.login_sessions where digest=extensions.digest(p_key,'sha256')
$$;
create or replace function studio_member.ident(k text) returns uuid language plpgsql set search_path='' as $$
declare cid uuid;
begin
 select customer_id into cid from studio_member.login_sessions where digest=extensions.digest(k,'sha256') and expires>now();
 if cid is null then
 select a.customer_id into cid from studio_member.access a where a.key_hash=extensions.digest(k,'sha256') and not exists(select 1 from studio_member.phone_logins p where p.customer_id=a.customer_id and p.secret is not null);
 end if;
 if cid is null then raise exception 'Invalid member login'; end if;
 return cid;
end $$;
revoke all on function public.member_login_link(uuid),public.member_set_password(text,text,text),public.member_password_login(text,text),public.member_end_session(text) from public,anon,authenticated;
grant execute on function public.member_login_link(uuid) to authenticated;
grant execute on function public.member_set_password(text,text,text),public.member_password_login(text,text),public.member_end_session(text) to anon,authenticated;
