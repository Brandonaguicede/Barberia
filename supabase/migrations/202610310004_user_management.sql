begin;
create function public.admin_manage_profile(p_actor uuid,p_id uuid,p_body jsonb) returns void language plpgsql security definer set search_path=public as $$
declare target_role text;begin
 if not exists(select 1 from user_roles r join profiles p on p.id=r.user_id where r.user_id=p_actor and r.role='admin' and p.active and (p.subscription_expires_at is null or p.subscription_expires_at>now())) or p_actor=p_id then raise exception 'Cambio de acceso no autorizado' using errcode='42501';end if;
 perform 1 from profiles where id=p_id for update;if not found then raise exception 'Usuario no encontrado';end if;
 update profiles set active=case when p_body?'active' then (p_body->>'active')::boolean else active end,
 subscription_expires_at=case when p_body?'subscription_expires_at' then (p_body->>'subscription_expires_at')::timestamptz else subscription_expires_at end where id=p_id;
 if p_body?'barber_id' then
 select role into target_role from user_roles where user_id=p_id;
 if target_role<>'barber' and p_body->>'barber_id' is not null then raise exception 'El usuario debe tener rol de barbero';end if;
 update barbers set user_id=null where user_id=p_id;
 if p_body->>'barber_id' is not null then
 update barbers set user_id=p_id where id=(p_body->>'barber_id')::uuid and (user_id is null or user_id=p_id);
 if not found then raise exception 'Barbero inválido o vinculado a otro usuario';end if;
 end if;
 end if;
end $$;
revoke execute on function public.admin_manage_profile(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.admin_manage_profile(uuid,uuid,jsonb) to service_role;
commit;
