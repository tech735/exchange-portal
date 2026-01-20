-- Fixed migration - run this step by step in Supabase SQL Editor

-- Step 1: First check if TO_BE_REFUNDED already exists, then add it if needed
-- (This will fail if it already exists, but that's okay)
ALTER TYPE ticket_stage ADD VALUE 'TO_BE_REFUNDED';

-- Step 2: Add refund_sent_at column to tickets table
ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS refund_sent_at TIMESTAMPTZ;

-- Step 3: Add refund_amount column if it doesn't exist
ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS refund_amount NUMERIC DEFAULT 0;

-- Step 4: Add refund_status column if it doesn't exist
ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS refund_status TEXT DEFAULT 'NONE' CHECK (refund_status IN ('NONE', 'PENDING', 'PROCESSED'));

-- Step 5: Add amount_collected column if it doesn't exist
ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS amount_collected NUMERIC DEFAULT 0;

-- Note: We're skipping the event_type enum since it doesn't exist in your database
-- The ticket_events table might be using a TEXT column instead of an enum
