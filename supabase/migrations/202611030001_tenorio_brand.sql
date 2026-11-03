begin;
-- Update only the original placeholder name, preserving any custom shop name.
update public.booking_settings
set shop_name = 'TENORIO BARBER'
where id = true and shop_name = 'ANGEL BARBER SHOP';
commit;
