-- Add school_name column to tickets table
ALTER TABLE public.tickets 
ADD COLUMN school_name TEXT;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_tickets_school_name ON public.tickets(school_name);

-- Update existing tickets to have a default school name if needed
UPDATE public.tickets 
SET school_name = 'Unknown School' 
WHERE school_name IS NULL;
