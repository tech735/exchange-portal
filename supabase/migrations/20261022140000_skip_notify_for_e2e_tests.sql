-- End-to-end test records (order_id starting with E2E-TEST-) must never email the team.
CREATE OR REPLACE FUNCTION public.notify_team_on_ticket_change()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
declare
  functions_url text;
  service_key text;
begin
  if new.order_id like 'E2E-TEST-%' then
    return new;
  end if;

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
$function$;
