-- Notifies the team by email when a ticket is lodged, and again whenever its
-- stage changes (LODGED -> RETURN_PENDING -> INVOICING_PENDING -> ...).
-- Does NOT fire on other field edits (notes, refund_amount, awb numbers, etc.)
-- so the team isn't spammed on every minor update to a ticket.
--
-- Uses pg_net to fire an async HTTP call to the notify-team Edge Function,
-- so the ticket write itself is never blocked or slowed down by the email send.
--
-- Manual setup required after this migration runs (values are secrets, so
-- they are not committed to SQL):
--   1. Set Edge Function secrets:
--        supabase secrets set RESEND_API_KEY=... RESEND_FROM_EMAIL=team@yourdomain.com \
--          TEAM_NOTIFICATION_EMAILS=ops@yourdomain.com,warehouse@yourdomain.com
--   2. Store the project URL + service role key for the trigger to call the function:
--        select vault.create_secret('https://<project-ref>.functions.supabase.co', 'project_functions_url');
--        select vault.create_secret('<service-role-key>', 'service_role_key');

create extension if not exists pg_net with schema extensions;

create or replace function public.notify_team_on_ticket_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  functions_url text;
  service_key text;
begin
  select decrypted_secret into functions_url from vault.decrypted_secrets where name = 'project_functions_url';
  select decrypted_secret into service_key from vault.decrypted_secrets where name = 'service_role_key';

  if functions_url is null or service_key is null then
    -- Secrets not configured yet; skip silently rather than failing the ticket write.
    return new;
  end if;

  perform net.http_post(
    url := functions_url || '/notify-team',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := jsonb_build_object(
      'type', tg_op,
      'table', tg_table_name,
      'record', to_jsonb(new),
      'old_record', case when tg_op = 'UPDATE' then to_jsonb(old) else null end
    )
  );

  return new;
end;
$$;

drop trigger if exists tickets_notify_team on public.tickets;
drop trigger if exists tickets_notify_team_insert on public.tickets;
drop trigger if exists tickets_notify_team_stage_change on public.tickets;

-- Fires once when a new ticket is lodged.
create trigger tickets_notify_team_insert
after insert on public.tickets
for each row
execute function public.notify_team_on_ticket_change();

-- Fires only when the stage column actually changes value — not on every
-- update to the row (e.g. editing notes or refund_amount stays silent).
create trigger tickets_notify_team_stage_change
after update of stage on public.tickets
for each row
when (old.stage is distinct from new.stage)
execute function public.notify_team_on_ticket_change();
