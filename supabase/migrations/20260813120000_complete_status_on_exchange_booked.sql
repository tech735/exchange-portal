-- Booking the exchange ends the support workflow, so the ticket status settles
-- at COMPLETED. The app now writes this at booking time (see the exchange branch
-- of handleAggregatorSubmit in src/pages/Warehouse/Warehouse.tsx), but tickets
-- booked before that change kept whatever status they had — usually NEW.
--
-- Backfill anything at or past EXCHANGE_BOOKED. DENIED and ESCALATED tickets are
-- deliberately left alone: those are terminal states of their own, not
-- unfinished work.

update public.tickets
set    status = 'COMPLETED',
       updated_at = now()
where  stage in (
         'EXCHANGE_BOOKED',
         'EXCHANGE_COMPLETED',
         'INVOICING_PENDING',
         'INVOICED',
         'CLOSED'
       )
and    status in ('NEW', 'IN_PROCESS');
