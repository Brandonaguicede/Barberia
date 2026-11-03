begin;
-- Public invalidation metadata only: no service, staff or customer data.
create table public.catalog_revision (
 id boolean primary key default true check(id),
 revision bigint not null default 1 check(revision > 0),
 updated_at timestamptz not null default now()
);
insert into public.catalog_revision(id) values(true);
alter table public.catalog_revision enable row level security;
revoke all on public.catalog_revision from public,anon,authenticated;
grant select on public.catalog_revision to anon,authenticated;
grant all on public.catalog_revision to service_role;
create policy public_catalog_revision_read on public.catalog_revision
 for select to anon,authenticated using(id = true);

create function public.bump_catalog_revision() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 update public.catalog_revision set revision=revision+1,updated_at=clock_timestamp() where id=true;
 return null;
end $$;
revoke execute on function public.bump_catalog_revision() from public,anon,authenticated;

do $$ declare target text; begin
 foreach target in array array['services','barbers','barber_services','booking_settings','barber_schedules','barber_breaks','barber_time_off','profiles','user_roles'] loop
  execute format('create trigger catalog_changed after insert or update or delete on public.%I for each statement execute function public.bump_catalog_revision()',target);
 end loop;
end $$;
alter publication supabase_realtime add table public.catalog_revision;

-- Save service details and its providers together; preserve all existing bookings.
create function public.admin_save_service(p_id uuid,p_body jsonb,p_barber_ids uuid[])
returns jsonb language plpgsql security invoker set search_path=public as $$
declare saved public.services;
begin
 if not public.has_role('admin') then raise exception 'Sin autorización' using errcode='42501';end if;
 if jsonb_typeof(p_body)<>'object' or p_barber_ids is null then raise exception 'Datos de servicio inválidos';end if;
 if exists(select 1 from unnest(p_barber_ids) chosen(id) left join public.barbers b on b.id=chosen.id where b.id is null) then raise exception 'Uno de los barberos seleccionados ya no existe';end if;
 if p_id is null then
  insert into public.services(name,description,duration,price,category,active)
  values(trim(p_body->>'name'),p_body->>'description',(p_body->>'duration')::integer,(p_body->>'price')::numeric,coalesce(p_body->>'category','general'),coalesce((p_body->>'active')::boolean,true)) returning * into saved;
 else
  update public.services set
   name=case when p_body?'name' then trim(p_body->>'name') else name end,
   description=case when p_body?'description' then p_body->>'description' else description end,
   duration=case when p_body?'duration' then (p_body->>'duration')::integer else duration end,
   price=case when p_body?'price' then (p_body->>'price')::numeric else price end,
   category=case when p_body?'category' then p_body->>'category' else category end,
   active=case when p_body?'active' then (p_body->>'active')::boolean else active end
  where id=p_id returning * into saved;
  if not found then raise exception 'Servicio no encontrado';end if;
 end if;
 delete from public.barber_services where service_id=saved.id and not(barber_id=any(p_barber_ids));
 insert into public.barber_services(service_id,barber_id) select saved.id,id from (select distinct unnest(p_barber_ids) id) chosen on conflict do nothing;
 return to_jsonb(saved);
end $$;
revoke execute on function public.admin_save_service(uuid,jsonb,uuid[]) from public,anon;
grant execute on function public.admin_save_service(uuid,jsonb,uuid[]) to authenticated;
commit;
