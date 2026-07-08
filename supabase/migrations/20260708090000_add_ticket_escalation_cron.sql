-- Runs the escalate-tickets Edge Function every hour to flag tickets that
-- have been open more than 2 days as SLA-breached and email the admin.
-- Reuses the same vault secrets as the ticket-change notification trigger
-- (see 20260707120000_add_ticket_notification_trigger.sql):
--   project_functions_url, service_role_key
-- Also needs these Edge Function secrets (in addition to the ones already
-- set for notify-team):
--   supabase secrets set ADMIN_NOTIFICATION_EMAIL=tech@kotu.co.in

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.unschedule(jobid) from cron.job where jobname = 'escalate-overdue-tickets';

select cron.schedule(
  'escalate-overdue-tickets',
  '0 * * * *', -- every hour, on the hour
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_functions_url') || '/escalate-tickets',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  )
  where exists (select 1 from vault.decrypted_secrets where name = 'project_functions_url')
  $$
);
