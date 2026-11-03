begin;
create function public.appointment_stats() returns jsonb language sql stable security definer set search_path=public as $$
 select case when public.has_role('admin') then jsonb_build_object(
 'today',count(*) filter(where (starts_at at time zone 'America/Costa_Rica')::date=(now() at time zone 'America/Costa_Rica')::date and status<>'cancelled'),
 'pending',count(*) filter(where status='pending'),
 'upcoming',count(*) filter(where starts_at>=now() and status='confirmed'),
 'monthlyRevenue',coalesce(sum(service_price) filter(where status='completed' and date_trunc('month',starts_at at time zone 'America/Costa_Rica')=date_trunc('month',now() at time zone 'America/Costa_Rica')),0)) else null end from appointments;
$$;
grant execute on function public.appointment_stats() to authenticated,service_role;
revoke execute on function public.appointment_stats() from public,anon;

create table public.configuration_events (
 id bigint generated always as identity primary key, actor_id uuid, entity text not null, operation text not null,
 old_data jsonb,new_data jsonb,created_at timestamptz not null default now()
);
alter table public.configuration_events enable row level security;
revoke all on public.configuration_events from anon,authenticated;
grant select on public.configuration_events to authenticated;
grant all on public.configuration_events to service_role;
create policy admin_audit on public.configuration_events for select to authenticated using(has_role('admin'));
create function public.audit_configuration() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into configuration_events(actor_id,entity,operation,old_data,new_data) values(auth.uid(),tg_table_name,tg_op,case when tg_op<>'INSERT' then to_jsonb(old) end,case when tg_op<>'DELETE' then to_jsonb(new) end);
 if tg_op='DELETE' then return old; end if;return new;
end $$;
do $$ declare t text; begin foreach t in array array['profiles','user_roles','barbers','services','barber_services','barber_schedules','barber_breaks','barber_time_off','booking_settings'] loop
 execute format('create trigger audit_configuration after insert or update or delete on public.%I for each row execute function public.audit_configuration()',t);
end loop; end $$;
revoke execute on function public.audit_configuration() from public,anon,authenticated;
commit;
