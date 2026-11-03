begin;
create function public.consume_rate_limit(p_key text,p_limit integer,p_seconds integer) returns boolean language plpgsql security definer set search_path=public as $$
declare n integer; begin
 insert into rate_limits(key,window_start,hits) values(p_key,clock_timestamp(),1)
 on conflict(key) do update set hits=case when rate_limits.window_start<clock_timestamp()-make_interval(secs=>p_seconds) then 1 else rate_limits.hits+1 end,
 window_start=case when rate_limits.window_start<clock_timestamp()-make_interval(secs=>p_seconds) then clock_timestamp() else rate_limits.window_start end returning hits into n;
 return n<=p_limit;
end $$;

create function public.available_slots(p_service uuid,p_barber uuid,p_date date,p_exclude uuid default null,p_duration integer default null)
returns table(barber_id uuid,starts_at timestamptz) language sql stable security definer set search_path=public as $$
 with cfg as (select * from booking_settings where id), candidates as (
 select b.id, g.t, coalesce(p_duration,s.duration) duration, c.buffer_minutes,c.minimum_notice_minutes,c.horizon_days
 from barbers b
 join profiles staff on staff.id=b.user_id and staff.active and (staff.subscription_expires_at is null or staff.subscription_expires_at>now())
 join user_roles staff_role on staff_role.user_id=staff.id and staff_role.role='barber'
 join barber_services bs on bs.barber_id=b.id
 join services s on s.id=bs.service_id and s.active
 join barber_schedules h on h.barber_id=b.id and h.weekday=extract(dow from p_date)
 cross join cfg c
 cross join lateral generate_series((p_date+h.opens_at) at time zone c.timezone,
 ((p_date+h.closes_at) at time zone c.timezone)-make_interval(mins=>coalesce(p_duration,s.duration)+c.buffer_minutes),make_interval(mins=>c.slot_interval_minutes)) g(t)
 where b.active and s.id=p_service and (p_barber is null or b.id=p_barber)
 and p_date between (now() at time zone c.timezone)::date and (now() at time zone c.timezone)::date+c.horizon_days
 ) select distinct c.id,c.t from candidates c
 where c.t>=now()+make_interval(mins=>c.minimum_notice_minutes)
 and not exists(select 1 from barber_breaks br where br.barber_id=c.id and br.weekday=extract(dow from p_date)
 and tstzrange((p_date+br.starts_at) at time zone 'America/Costa_Rica',(p_date+br.ends_at) at time zone 'America/Costa_Rica','[)') && tstzrange(c.t,c.t+make_interval(mins=>c.duration+c.buffer_minutes),'[)'))
 and not exists(select 1 from barber_time_off o where o.barber_id=c.id and tstzrange(o.starts_at,o.ends_at,'[)') && tstzrange(c.t,c.t+make_interval(mins=>c.duration+c.buffer_minutes),'[)'))
 and not exists(select 1 from appointments a where a.barber_id=c.id and a.status<>'cancelled' and (p_exclude is null or a.id<>p_exclude) and tstzrange(a.starts_at,a.blocked_until,'[)') && tstzrange(c.t,c.t+make_interval(mins=>c.duration+c.buffer_minutes),'[)'))
 order by c.t,c.id;
$$;

create function public.appointment_receipt(p_id uuid) returns jsonb language sql stable security definer set search_path=public as $$
 select to_jsonb(a)||jsonb_build_object('barber_name',b.name,'shop_name',s.shop_name,
 'appointment_date',to_char(a.starts_at at time zone s.timezone,'YYYY-MM-DD'),
 'appointment_time',to_char(a.starts_at at time zone s.timezone,'HH24:MI'),
 'can_cancel',a.status='confirmed' and a.starts_at>=now()+make_interval(mins=>s.cancellation_notice_minutes),
 'can_reschedule',a.status='confirmed' and a.starts_at>=now()+make_interval(mins=>s.reschedule_notice_minutes))
 from appointments a join barbers b on b.id=a.barber_id cross join booking_settings s where a.id=p_id and s.id;
$$;

create function public.notify_appointment(p_id uuid,p_kind text,p_title text) returns void language plpgsql security definer set search_path=public as $$
begin
 insert into notifications(user_id,appointment_id,kind,title)
 select b.user_id,p_id,p_kind,p_title from appointments a join barbers b on b.id=a.barber_id where a.id=p_id and b.user_id is not null
 on conflict do nothing;
 insert into push_jobs(notification_id,subscription_id)
 select n.id,s.id from notifications n join push_subscriptions s on s.user_id=n.user_id where n.appointment_id=p_id and n.kind=p_kind on conflict do nothing;
end $$;
create function public.audit_appointment() returns trigger language plpgsql security definer set search_path=public as $$
declare k text; begin
 insert into appointment_events(appointment_id,actor_id,event,old_data,new_data) values(new.id,auth.uid(),lower(tg_op),case when tg_op='UPDATE' then to_jsonb(old) end,to_jsonb(new));
 k=case when tg_op='INSERT' then 'created' else 'changed:'||gen_random_uuid()::text end;
 perform notify_appointment(new.id,k,case when tg_op='INSERT' then 'Nueva reserva confirmada' when new.status='cancelled' then 'Cita cancelada' when tg_op='UPDATE' and new.starts_at<>old.starts_at then 'Cita reprogramada' else 'Cita actualizada' end);
 if tg_op='UPDATE' and old.barber_id<>new.barber_id then
 insert into notifications(user_id,appointment_id,kind,title) select user_id,new.id,k||':previous','Cita reasignada' from barbers where id=old.barber_id and user_id is not null;
 insert into push_jobs(notification_id,subscription_id) select n.id,s.id from notifications n join push_subscriptions s on s.user_id=n.user_id where n.appointment_id=new.id and n.kind=k||':previous' on conflict do nothing;
 end if;
 return new;
end $$;
create trigger appointment_audit after insert or update on public.appointments for each row execute function public.audit_appointment();

create function public.create_booking(p_body jsonb,p_hash text) returns jsonb language plpgsql security definer set search_path=public as $$
declare s services; c booking_settings; v_barber uuid; v_id uuid; v_customer uuid; v_start timestamptz; candidate record;
begin
 select * into strict c from booking_settings where id;
 select * into strict s from services where id=(p_body->>'service_id')::uuid and active;
 v_start=((p_body->>'appointment_date')::date+(p_body->>'appointment_time')::time) at time zone c.timezone;
 -- Lock candidates in stable order. For "any barber", try the next one if a
 -- concurrent transaction reserved the first candidate while we waited.
 for candidate in select x.barber_id from available_slots(s.id,nullif(p_body->>'barber_id','')::uuid,(p_body->>'appointment_date')::date) x where x.starts_at=v_start order by x.barber_id loop
 perform 1 from barbers where id=candidate.barber_id for update;
 if exists(select 1 from available_slots(s.id,candidate.barber_id,(p_body->>'appointment_date')::date) x where x.starts_at=v_start) then v_barber=candidate.barber_id;exit;end if;
 end loop;
 if v_barber is null then raise exception 'Horario no disponible' using errcode='P0001'; end if;
 if length(trim(coalesce(p_body->>'client_name',''))) not between 1 and 120 or coalesce(p_body->>'client_phone','') !~ '^\+?[0-9 ()-]{8,25}$' then raise exception 'Nombre o teléfono inválido'; end if;
 insert into customers(name,phone,email) values(trim(p_body->>'client_name'),p_body->>'client_phone',nullif(p_body->>'client_email','')) returning id into v_customer;
 insert into appointments(customer_id,barber_id,service_id,client_name,client_phone,client_email,service_name,service_duration,service_price,starts_at,ends_at,blocked_until,notes)
 values(v_customer,v_barber,s.id,trim(p_body->>'client_name'),p_body->>'client_phone',nullif(p_body->>'client_email',''),s.name,s.duration,s.price,v_start,v_start+make_interval(mins=>s.duration),v_start+make_interval(mins=>s.duration+c.buffer_minutes),p_body->>'notes') returning id into v_id;
 insert into booking_access_tokens(appointment_id,token_hash,expires_at) values(v_id,p_hash,v_start+interval '30 days');
 return appointment_receipt(v_id);
end $$;

create function public.private_booking(p_hash text,p_action text,p_body jsonb default '{}',p_new_hash text default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare a appointments; c booking_settings; v_start timestamptz; begin
 select x.* into a from appointments x join booking_access_tokens t on t.appointment_id=x.id where t.token_hash=p_hash and t.revoked_at is null and t.expires_at>now() for update of x;
 if a.id is null then raise exception 'Enlace inválido o vencido' using errcode='P0002'; end if;
 if p_action='get' then return appointment_receipt(a.id); end if;
 select * into strict c from booking_settings where id;
 if a.status<>'confirmed' then raise exception 'Esta cita ya no se puede modificar'; end if;
 if p_action='cancel' then
 if a.starts_at<now()+make_interval(mins=>c.cancellation_notice_minutes) then raise exception 'El plazo de cancelación ha vencido'; end if;
 update appointments set status='cancelled' where id=a.id;
 elsif p_action='reschedule' then
 if a.starts_at<now()+make_interval(mins=>c.reschedule_notice_minutes) then raise exception 'El plazo de reprogramación ha vencido'; end if;
 v_start=((p_body->>'appointment_date')::date+(p_body->>'appointment_time')::time) at time zone c.timezone;
 perform 1 from barbers where id=a.barber_id for update;
 if not exists(select 1 from available_slots(a.service_id,a.barber_id,(p_body->>'appointment_date')::date,a.id,a.service_duration) x where x.starts_at=v_start) then raise exception 'Horario no disponible'; end if;
 update appointments set starts_at=v_start,ends_at=v_start+make_interval(mins=>a.service_duration),blocked_until=v_start+make_interval(mins=>a.service_duration+c.buffer_minutes) where id=a.id;
 if p_new_hash is null then raise exception 'Se requiere rotación del enlace'; end if;
 update booking_access_tokens set revoked_at=now() where appointment_id=a.id and revoked_at is null;
 insert into booking_access_tokens(appointment_id,token_hash,expires_at) values(a.id,p_new_hash,v_start+interval '30 days');
 else raise exception 'Acción inválida'; end if;
 return appointment_receipt(a.id);
end $$;

create function public.staff_update_appointment(p_id uuid,p_body jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare a appointments; c booking_settings; s services; v_start timestamptz; v_barber uuid; v_status text; begin
 select * into strict a from appointments where id=p_id for update;
 if not (has_role('admin') or owns_barber(a.barber_id)) then raise exception 'Sin autorización' using errcode='42501'; end if;
 v_status=coalesce(p_body->>'status',a.status);
 if not has_role('admin') then
 if (p_body-'status')<>'{}'::jsonb or a.status not in ('pending','confirmed') or v_status not in ('confirmed','completed','cancelled','no_show') then raise exception 'Cambio no permitido' using errcode='42501'; end if;
 if v_status in ('completed','no_show') and a.starts_at>now() then raise exception 'La cita aún no ha comenzado'; end if;
 update appointments set status=v_status where id=p_id;
 return appointment_receipt(p_id);
 end if;
 select * into strict c from booking_settings where id;
 select * into strict s from services where id=coalesce((p_body->>'service_id')::uuid,a.service_id);
 v_barber=coalesce((p_body->>'barber_id')::uuid,a.barber_id);
 v_start=case when p_body ? 'appointment_date' then ((p_body->>'appointment_date')::date+(p_body->>'appointment_time')::time) at time zone c.timezone else a.starts_at end;
 if s.id=a.service_id then s.duration=a.service_duration; s.price=a.service_price; s.name=a.service_name; end if;
 perform 1 from barbers where id=v_barber for update;
 if (v_start<>a.starts_at or v_barber<>a.barber_id or s.id<>a.service_id or (a.status='cancelled' and v_status<>'cancelled')) and v_status<>'cancelled' then
 if not exists(select 1 from available_slots(s.id,v_barber,(v_start at time zone c.timezone)::date,a.id,s.duration) x where x.starts_at=v_start) then raise exception 'Horario no disponible'; end if;
 end if;
 update appointments set barber_id=v_barber,service_id=s.id,starts_at=v_start,ends_at=v_start+make_interval(mins=>s.duration),blocked_until=v_start+make_interval(mins=>s.duration+c.buffer_minutes),
 service_name=s.name,service_duration=s.duration,service_price=s.price,status=v_status,client_name=coalesce(p_body->>'client_name',a.client_name),client_phone=coalesce(p_body->>'client_phone',a.client_phone),client_email=coalesce(p_body->>'client_email',a.client_email),notes=coalesce(p_body->>'notes',a.notes) where id=p_id;
 return appointment_receipt(p_id);
end $$;

-- Availability changes take the same lock as booking and reject collisions with existing appointments.
create function public.guard_availability() returns trigger language plpgsql security definer set search_path=public as $$
declare bid uuid; begin
 bid=case when tg_op='DELETE' then old.barber_id else new.barber_id end;
 perform 1 from barbers where id=bid for update;
 if tg_table_name='barber_time_off' and tg_op<>'DELETE' then
 if exists(select 1 from appointments where barber_id=bid and status in ('pending','confirmed') and tstzrange(starts_at,blocked_until,'[)') && tstzrange(new.starts_at,new.ends_at,'[)')) then raise exception 'Existen citas en ese período'; end if;
 end if;
 if tg_op='DELETE' then return old; end if; return new;
end $$;
create trigger guard_time_off before insert or update or delete on public.barber_time_off for each row execute function public.guard_availability();
create trigger guard_schedules before insert or update or delete on public.barber_schedules for each row execute function public.guard_availability();
create trigger guard_breaks before insert or update or delete on public.barber_breaks for each row execute function public.guard_availability();

create function public.claim_push_jobs() returns setof public.push_jobs language sql security definer set search_path=public as $$
 update push_jobs set locked_at=now(),attempts=attempts+1 where id in (
 select id from push_jobs where delivered_at is null and failed_at is null and available_at<=now() and (locked_at is null or locked_at<now()-interval '5 minutes') and attempts<6 order by available_at limit 50 for update skip locked
 ) returning *;
$$;
create function public.enqueue_reminders() returns void language plpgsql security definer set search_path=public as $$
declare a record; begin
 for a in select x.id,x.starts_at from appointments x cross join booking_settings c where c.id and x.status='confirmed' and x.starts_at>now() and x.starts_at<=now()+make_interval(mins=>c.reminder_minutes) loop
 perform notify_appointment(a.id,'reminder:'||floor(extract(epoch from a.starts_at))::bigint::text,'Próxima cita');
 end loop;
 delete from rate_limits where window_start<now()-interval '1 day';
 update push_jobs set failed_at=now(),last_error='Intentos agotados' where attempts>=6 and delivered_at is null and failed_at is null and locked_at<now()-interval '5 minutes';
end $$;
revoke execute on all functions in schema public from public,anon,authenticated;
grant execute on function public.has_role(text),public.owns_barber(uuid),public.staff_update_appointment(uuid,jsonb) to authenticated;
grant execute on all functions in schema public to service_role;
commit;
