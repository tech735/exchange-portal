-- Add refund functionality to the database
-- Run this in your Supabase SQL Editor

-- Step 1: Add TO_BE_REFUNDED to ticket_stage enum
ALTER TYPE ticket_stage ADD VALUE 'TO_BE_REFUNDED';

-- Step 2: Add REFUND_SENT to event_type enum  
ALTER TYPE event_type ADD VALUE 'REFUND_SENT';

-- Step 3: Add refund_sent_at column to tickets table
ALTER TABLE tickets 
ADD COLUMN refund_sent_at TIMESTAMPTZ;
