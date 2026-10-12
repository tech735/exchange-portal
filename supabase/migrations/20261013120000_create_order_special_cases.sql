-- Special cases log — replaces the "Special Cases – Exchanges, Returns & RTO"
-- tab of the old Google Sheet. One row per order that needs special handling
-- (a stuck RTO, an exchange sent by hand, a refund owed …), kept and updated
-- by the team from the Shipments page → Special cases. Free text on purpose:
-- these are the cases that don't fit the tracker or the ticket workflow.

CREATE TABLE public.order_special_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_name TEXT NOT NULL,          -- as written by the team, e.g. K-2627-3232-R1
  case_type TEXT NOT NULL DEFAULT 'OTHER' CHECK (case_type IN ('EXCHANGE', 'RETURN', 'RTO', 'OTHER')),
  issue TEXT NOT NULL,               -- "Issue / Current Status"
  action_taken TEXT,                 -- "Action Taken / Exchange Details"
  awb_number TEXT,
  latest_update TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'RESOLVED')),
  resolved_on DATE,
  updated_by TEXT,                   -- name of whoever saved it last
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX order_special_cases_status_idx ON public.order_special_cases (status, updated_at DESC);

CREATE OR REPLACE FUNCTION public.touch_order_special_case()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER touch_order_special_case
  BEFORE UPDATE ON public.order_special_cases
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_order_special_case();

-- Same access model as order_shipments.
ALTER TABLE public.order_special_cases DISABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_special_cases TO authenticated, anon, service_role;
