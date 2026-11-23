create function studio_member.home_for(cid uuid) returns jsonb language plpgsql security invoker set search_path='' as $$

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

create or replace function public.member_home(p_key text) returns jsonb language sql security definer set search_path='' as $$
 select studio_member.home_for(studio_member.ident(p_key))
$$;
create function public.member_preview(p_customer uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform studio_member.operator();
 if not exists(select 1 from public.customers where id=p_customer) then raise exception 'Client unavailable'; end if;
 return studio_member.home_for(p_customer);
end $$;
revoke all on function public.member_preview(uuid) from public,anon,authenticated;
grant execute on function public.member_preview(uuid) to authenticated;