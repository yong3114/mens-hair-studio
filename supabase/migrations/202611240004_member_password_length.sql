create or replace function public.member_set_password(p_ticket text,p_phone text,p_password text) returns boolean language plpgsql security definer set search_path='' as $$
declare account studio_member.phone_logins;
begin
 select * into account from studio_member.phone_logins where invitation=extensions.digest(p_ticket,'sha256') and expires>clock_timestamp() for update;
 if not found or studio_member.normalize_phone(p_phone) is distinct from account.phone then raise exception 'Check your phone number or ask the studio for a new link.'; end if;
 if p_password is null or length(p_password)<6 or octet_length(p_password)>72 then raise exception 'Use at least 6 characters and at most 72 bytes.'; end if;
 update studio_member.phone_logins set secret=extensions.crypt(p_password,extensions.gen_salt('bf',12)),invitation=null,expires=null,failures=0,retry_at=null where customer_id=account.customer_id;
 delete from studio_member.access where customer_id=account.customer_id;
 delete from studio_member.login_sessions where customer_id=account.customer_id;
 return true;
end $$;

