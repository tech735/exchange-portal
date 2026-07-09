import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { EventType } from '@/types/database';

export interface ActivityItem {
  id: string;
  ticketId: string;
  eventType: EventType;
  eventAt: string;
  orderId: string | null;
  customerName: string | null;
}

const RECENT_ACTIVITY_LIMIT = 15;

export function useRecentActivity() {
  return useQuery({
    queryKey: ['recent-activity'],
    queryFn: async (): Promise<ActivityItem[]> => {
      const { data: events, error } = await supabase
        .from('ticket_events')
        .select('*')
        .order('event_at', { ascending: false })
        .limit(RECENT_ACTIVITY_LIMIT);

      if (error) throw error;
      if (!events || events.length === 0) return [];

      const rawEvents = events as Array<Record<string, unknown>>;
      const ticketIds = Array.from(new Set(rawEvents.map((e) => String(e.ticket_id))));
      const { data: tickets, error: ticketsError } = await supabase
        .from('tickets')
        .select('*')
        .in('id', ticketIds);

      if (ticketsError) throw ticketsError;
      const rawTickets = (tickets ?? []) as Array<Record<string, unknown>>;
      const ticketById = new Map(rawTickets.map((t) => [String(t.id), t]));

      return rawEvents.map((event) => {
        const ticket = ticketById.get(String(event.ticket_id));
        return {
          id: String(event.id),
          ticketId: String(event.ticket_id),
          eventType: event.event_type as EventType,
          eventAt: String(event.event_at),
          orderId: ticket ? String(ticket.order_id) : null,
          customerName: ticket ? String(ticket.customer_name) : null,
        };
      });
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}
