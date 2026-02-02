-- Add return_awb and exchange_awb columns to tickets table
-- Migration: 20260202123000_add_return_awb_field.sql

ALTER TABLE tickets 
ADD COLUMN return_awb TEXT,
ADD COLUMN exchange_awb TEXT;

-- Add indexes for better query performance if needed
CREATE INDEX idx_tickets_return_awb ON tickets(return_awb) WHERE return_awb IS NOT NULL;
CREATE INDEX idx_tickets_exchange_awb ON tickets(exchange_awb) WHERE exchange_awb IS NOT NULL;
