-- Add missing refund-related columns to tickets table
-- Run this in your Supabase SQL Editor if these columns don't exist

-- Add refund_amount column (numeric)
ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS refund_amount NUMERIC DEFAULT 0;

-- Add refund_status column (text with default)
ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS refund_status TEXT DEFAULT 'NONE' CHECK (refund_status IN ('NONE', 'PENDING', 'PROCESSED'));

-- Add amount_collected column (numeric)
ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS amount_collected NUMERIC DEFAULT 0;
