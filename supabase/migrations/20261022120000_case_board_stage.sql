-- Back-office board for cases: where an open case is sitting.
-- Closed stays as status = 'RESOLVED'; board_stage only applies while OPEN.
ALTER TABLE public.order_special_cases
  ADD COLUMN IF NOT EXISTS board_stage TEXT NOT NULL DEFAULT 'NEW'
    CHECK (board_stage IN ('NEW', 'ON_US', 'ON_CUSTOMER', 'ON_HOLD'));

-- Existing open cases with any update or action already count as being worked on.
UPDATE public.order_special_cases
SET board_stage = 'ON_US'
WHERE status = 'OPEN' AND (latest_update IS NOT NULL OR action_taken IS NOT NULL);
