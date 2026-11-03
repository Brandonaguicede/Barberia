begin;
alter table public.appointments add constraint appointment_name_valid check(length(trim(client_name)) between 1 and 120);
alter table public.appointments add constraint appointment_phone_valid check(client_phone ~ '^\+?[0-9 ()-]{8,25}$');
alter table public.appointments add constraint appointment_email_length check(client_email is null or length(client_email)<=254);
alter table public.customers add constraint customer_email_length check(email is null or length(email)<=254);
commit;
