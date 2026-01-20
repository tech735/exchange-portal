-- Run these commands in your Supabase SQL Editor to add the missing enum values

-- Step 1: Add TO_BE_REFUNDED to ticket_stage enum
ALTER TYPE ticket_stage ADD VALUE 'TO_BE_REFUNDED';

-- Step 2: Add REFUND_SENT to event_type enum  
ALTER TYPE event_type ADD VALUE 'REFUND_SENT';

-- Step 3: Add refund_sent_at column to tickets table
ALTER TABLE tickets 
ADD COLUMN refund_sent_at TIMESTAMPTZ;

-- Step 4: Add refund_amount column if it doesn't exist
ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS refund_amount NUMERIC DEFAULT 0;

-- Step 5: Add refund_status column if it doesn't exist
ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS refund_status TEXT DEFAULT 'NONE' CHECK (refund_status IN ('NONE', 'PENDING', 'PROCESSED'));

-- Step 6: Add amount_collected column if it doesn't exist
ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS amount_collected NUMERIC DEFAULT 0;
