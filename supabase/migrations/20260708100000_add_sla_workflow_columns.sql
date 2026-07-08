-- Tracks each SLA milestone independently so the escalate-tickets function can
-- run its 3 time-based checks (2-day progress warning, 5-day warehouse
-- breach, 7-day tech breach) exactly once per ticket instead of re-notifying
-- every hour. The existing sla_breached/sla_breached_at columns are kept as
-- the general "has this ticket breached SLA at all" flag the UI already
-- renders a badge for — they get set true by the 5-day and 7-day breach
-- checks, but NOT by the 2-day warning (a warning isn't a breach yet).

ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS sla_2day_warning_sent_at TIMESTAMPTZ;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS sla_warehouse_breach_sent_at TIMESTAMPTZ;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS sla_tech_breach_sent_at TIMESTAMPTZ;
