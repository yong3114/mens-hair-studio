create or replace function public.log_opening_inventory() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_table_name='consumables' then
   if new.qty <= 0 then return new; end if;
   insert into public.inventory_movements(item_type,item_id,movement_type,qty,reason,created_by) values('consumable',new.id,'stock_in',new.qty,'Opening stock',auth.uid());
 elsif tg_table_name='hair_systems' then
   insert into public.inventory_movements(item_type,item_id,movement_type,qty,reason,created_by) values('hair_system',new.id,'stock_in',1,'New hair system received',auth.uid());
 end if;
 return new;
end $$;
