begin;
create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;
set local search_path = public, extensions;

create table public.profiles (
 id uuid primary key references auth.users on delete cascade,
 email text not null, full_name text not null default '', active boolean not null default true,
 subscription_expires_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.user_roles (
 user_id uuid primary key references public.profiles on delete cascade,
 role text not null check (role in ('admin','barber')), created_at timestamptz not null default now()
);
create function public.has_role(wanted text) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from user_roles r join profiles p on p.id=r.user_id where r.user_id=auth.uid() and r.role=wanted and p.active and (p.subscription_expires_at is null or p.subscription_expires_at>now()));
$$;
create table public.barbers (
 id uuid primary key default gen_random_uuid(), user_id uuid unique references public.profiles,
 name text not null check(length(trim(name)) between 1 and 120), specialty text, phone text, email text,
 active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create function public.owns_barber(target uuid) returns boolean language sql stable security definer set search_path=public as $$
 select public.has_role('barber') and exists(select 1 from barbers where id=target and user_id=auth.uid() and active);
$$;
create table public.services (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 1 and 120), description text,
 duration integer not null check(duration between 5 and 480), price numeric(12,2) not null check(price>=0), category text not null default 'general',
 active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.barber_services (
 barber_id uuid references public.barbers on delete cascade, service_id uuid references public.services on delete cascade,
 primary key(barber_id,service_id)
);
create table public.barber_schedules (
 id uuid primary key default gen_random_uuid(), barber_id uuid not null references public.barbers on delete cascade,
 weekday integer not null check(weekday between 0 and 6), opens_at time not null, closes_at time not null,
 check(opens_at<closes_at), unique(barber_id,weekday,opens_at)
);
create table public.barber_breaks (
 id uuid primary key default gen_random_uuid(), barber_id uuid not null references public.barbers on delete cascade,
 weekday integer not null check(weekday between 0 and 6), starts_at time not null, ends_at time not null, check(starts_at<ends_at)
);
create table public.barber_time_off (
 id uuid primary key default gen_random_uuid(), barber_id uuid not null references public.barbers on delete cascade,
 starts_at timestamptz not null, ends_at timestamptz not null, reason text, check(starts_at<ends_at)
);
create index on public.barber_time_off(barber_id,starts_at,ends_at);
create table public.customers (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 1 and 120),
 phone text not null check(length(phone) between 8 and 25), email text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.booking_settings (
 id boolean primary key default true check(id), shop_name text not null default 'ANGEL BARBER SHOP',
 timezone text not null default 'America/Costa_Rica' check(timezone='America/Costa_Rica'),
 minimum_notice_minutes integer not null default 30 check(minimum_notice_minutes>=0),
 cancellation_notice_minutes integer not null default 120 check(cancellation_notice_minutes>=0),
 reschedule_notice_minutes integer not null default 120 check(reschedule_notice_minutes>=0),
 slot_interval_minutes integer not null default 15 check(slot_interval_minutes between 5 and 120),
 buffer_minutes integer not null default 0 check(buffer_minutes between 0 and 120),
 horizon_days integer not null default 90 check(horizon_days between 1 and 365),
 barber_can_manage_availability boolean not null default false,
 reminder_minutes integer not null default 60 check(reminder_minutes between 5 and 1440), updated_at timestamptz not null default now()
);
insert into public.booking_settings(id) values(true);
create table public.appointments (
 id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.customers,
 barber_id uuid not null references public.barbers, service_id uuid not null references public.services,
 client_name text not null, client_phone text not null, client_email text,
 service_name text not null, service_duration integer not null check(service_duration>0), service_price numeric(12,2) not null check(service_price>=0),
 starts_at timestamptz not null, ends_at timestamptz not null, blocked_until timestamptz not null,
 status text not null default 'confirmed' check(status in ('pending','confirmed','completed','cancelled','no_show')),
 notes text check(length(notes)<=2000), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(starts_at<ends_at and ends_at<=blocked_until),
 exclude using gist (barber_id with =, tstzrange(starts_at,blocked_until,'[)') with &&) where (status<>'cancelled')
);
create index on public.appointments(starts_at,status);
create index on public.appointments(customer_id);
create table public.appointment_events (
 id bigint generated always as identity primary key, appointment_id uuid not null references public.appointments,
 actor_id uuid references auth.users, event text not null, old_data jsonb, new_data jsonb, created_at timestamptz not null default now()
);
create index on public.appointment_events(appointment_id,created_at);
create table public.booking_access_tokens (
 id uuid primary key default gen_random_uuid(), appointment_id uuid not null references public.appointments,
 token_hash text not null unique check(length(token_hash)=64), expires_at timestamptz not null,
 revoked_at timestamptz, created_at timestamptz not null default now()
);
create index on public.booking_access_tokens(appointment_id);
create table public.notifications (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles on delete cascade,
 appointment_id uuid not null references public.appointments, kind text not null, title text not null,
 read_at timestamptz, created_at timestamptz not null default now(), unique(user_id,appointment_id,kind)
);
create index on public.notifications(user_id,created_at desc);
create table public.push_subscriptions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles on delete cascade,
 endpoint text not null unique check(length(endpoint)<=2048 and endpoint like 'https://%'),
 p256dh text not null check(length(p256dh) between 40 and 200), auth text not null check(length(auth) between 16 and 100),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index on public.push_subscriptions(user_id);
create table public.push_jobs (
 id uuid primary key default gen_random_uuid(), notification_id uuid not null references public.notifications on delete cascade,
 subscription_id uuid not null references public.push_subscriptions on delete cascade,
 attempts integer not null default 0, available_at timestamptz not null default now(), locked_at timestamptz,
 delivered_at timestamptz, failed_at timestamptz, last_error text, unique(notification_id,subscription_id)
);
create index on public.push_jobs(available_at) where delivered_at is null and failed_at is null;
create table public.rate_limits (
 key text primary key, window_start timestamptz not null, hits integer not null
);

create function public.touch_updated_at() returns trigger language plpgsql set search_path=public as $$ begin new.updated_at=now(); return new; end $$;
do $$ declare t text; begin
 foreach t in array array['profiles','barbers','services','customers','appointments','booking_settings','push_subscriptions'] loop
 execute format('create trigger touch_updated_at before update on public.%I for each row execute function public.touch_updated_at()',t);
 end loop;
end $$;
create function public.new_auth_profile() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into profiles(id,email) values(new.id,coalesce(new.email,'')); return new; end $$;
create trigger new_auth_profile after insert on auth.users for each row execute function public.new_auth_profile();

-- No anonymous table grants. Catalog and booking functions are behind the Edge gateway.
do $$ declare t text; begin
 foreach t in array array['profiles','user_roles','barbers','services','barber_services','barber_schedules','barber_breaks','barber_time_off','customers','appointments','appointment_events','booking_access_tokens','notifications','push_subscriptions','booking_settings','push_jobs','rate_limits'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 if t not in ('booking_access_tokens','push_jobs','rate_limits','notifications','push_subscriptions','appointments','appointment_events','customers') then
 execute format('grant select,insert,update,delete on public.%I to authenticated',t);
 execute format('create policy admin_all on public.%I for all to authenticated using (public.has_role(''admin'')) with check (public.has_role(''admin''))',t);
 end if;
 end loop;
end $$;
grant select on public.appointments,public.appointment_events,public.customers to authenticated;
create policy appointments_staff on public.appointments for select to authenticated using(has_role('admin') or owns_barber(barber_id));
create policy events_staff on public.appointment_events for select to authenticated using(exists(select 1 from appointments a where a.id=appointment_id));
create policy customers_admin on public.customers for select to authenticated using(has_role('admin'));
create policy own_profile on public.profiles for select to authenticated using(id=auth.uid());
create policy own_role on public.user_roles for select to authenticated using(user_id=auth.uid());
create policy staff_barbers on public.barbers for select to authenticated using(has_role('barber'));
create policy staff_services on public.services for select to authenticated using(has_role('barber'));
create policy staff_settings on public.booking_settings for select to authenticated using(has_role('barber'));
create policy staff_barber_services on public.barber_services for select to authenticated using(has_role('barber'));
do $$ declare t text; begin
 foreach t in array array['barber_schedules','barber_breaks','barber_time_off'] loop
 execute format('create policy own_availability_read on public.%I for select to authenticated using (public.owns_barber(barber_id))',t);
 execute format('create policy own_availability_write on public.%I for all to authenticated using (public.owns_barber(barber_id) and (select barber_can_manage_availability from public.booking_settings where id)) with check (public.owns_barber(barber_id) and (select barber_can_manage_availability from public.booking_settings where id))',t);
 end loop;
end $$;
grant select on public.notifications to authenticated;
grant update(read_at) on public.notifications to authenticated;
create policy own_notifications_read on public.notifications for select to authenticated using(user_id=auth.uid() and (has_role('admin') or has_role('barber')));
create policy own_notifications_update on public.notifications for update to authenticated using(user_id=auth.uid() and (has_role('admin') or has_role('barber'))) with check(user_id=auth.uid());
grant select,insert,update,delete on public.push_subscriptions to authenticated;
create policy own_subscriptions on public.push_subscriptions for all to authenticated using(user_id=auth.uid() and (has_role('admin') or has_role('barber'))) with check(user_id=auth.uid() and (has_role('admin') or has_role('barber')));
alter publication supabase_realtime add table public.notifications;
revoke execute on all functions in schema public from public,anon,authenticated;
grant execute on function public.has_role(text), public.owns_barber(uuid) to authenticated,service_role;
commit;
