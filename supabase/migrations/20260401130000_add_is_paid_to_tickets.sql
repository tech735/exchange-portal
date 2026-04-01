-- Migration to add payment confirmation tracking and item prices
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT false;

-- Note: We are not migrating existing return_items/exchange_items JSON data
-- because the code will be updated to handle missing price fields gracefully.
