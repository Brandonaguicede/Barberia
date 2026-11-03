-- MANUAL ONLY. Execute against the authorized development project after configuring
-- Vault secrets push_worker_url and push_worker_secret. Never put values in this file.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
do $$
declare job record;
begin
 if not exists(select 1 from vault.decrypted_secrets where name='push_worker_url') or not exists(select 1 from vault.decrypted_secrets where name='push_worker_secret') then
 raise exception 'Configure push_worker_url y push_worker_secret en Vault antes de habilitar el envío';
 end if;
 for job in select jobid from cron.job where jobname='angel-barber-push' loop perform cron.unschedule(job.jobid); end loop;
 perform cron.schedule('angel-barber-push','* * * * *', $job$
 select net.http_post(
 url:=(select decrypted_secret from vault.decrypted_secrets where name='push_worker_url' limit 1),
 headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='push_worker_secret' limit 1)),
 body:='{}'::jsonb,timeout_milliseconds:=10000
 );
 $job$);
end $$;
