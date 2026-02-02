import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Ticket, TicketItem, ReasonCode, TicketStage, TicketStatus, EventType } from '@/types/database';
import { useAuth } from './useAuth';

interface CreateTicketData {
  order_id: string;
  customer_name: string;
  customer_phone: string;
  student_name?: string;
  student_grade?: string;
  student_section?: string;
  school_name?: string;
  reason_code: ReasonCode;
  reason_notes?: string;
  return_items: TicketItem[];
  exchange_items: TicketItem[];
  notes?: string;
}

interface UpdateTicketData {
  id: string;
  stage?: TicketStage;
  status?: TicketStatus;
  warehouse_received_at?: string;
  warehouse_approved_at?: string;
  warehouse_denied_at?: string;
  exchange_completed_at?: string;
  sent_to_invoicing_at?: string;
  invoicing_done_at?: string;
  refund_sent_at?: string;
  refund_amount?: number;
  refund_status?: 'NONE' | 'PENDING' | 'PROCESSED';
  amount_collected?: number;
  closed_at?: string;
  sla_breached?: boolean;
  sla_breached_at?: string;
  notes?: string;
  return_awb?: string;
  exchange_awb?: string;
  assigned_team?: string;
  eventType?: EventType;
}

function parseTicketItems(items: unknown): TicketItem[] {
  if (!items) return [];
  if (Array.isArray(items)) {
    return items.map(item => ({
      sku: String(item?.sku || ''),
      product_name: String(item?.product_name || ''),
      size: String(item?.size || ''),
      qty: Number(item?.qty || 0),
    }));
  }
  return [];
}

function mapTicket(data: Record<string, unknown>): Ticket {
  return {
    id: String(data.id),
    order_id: String(data.order_id),
    customer_name: String(data.customer_name),
    customer_phone: String(data.customer_phone),
    student_name: data.student_name ? String(data.student_name) : null,
    student_grade: data.student_grade ? String(data.student_grade) : null,
    student_section: data.student_section ? String(data.student_section) : null,
    school_name: data.school_name ? String(data.school_name) : null,
    reason_code: data.reason_code as ReasonCode,
    reason_notes: data.reason_notes ? String(data.reason_notes) : null,
    stage: data.stage as TicketStage,
    status: data.status as TicketStatus,
    return_items: parseTicketItems(data.return_items),
    exchange_items: parseTicketItems(data.exchange_items),
    notes: data.notes ? String(data.notes) : null,
    return_awb: data.return_awb ? String(data.return_awb) : null,
    exchange_awb: data.exchange_awb ? String(data.exchange_awb) : null,
    sla_breached: Boolean(data.sla_breached),
    sla_breached_at: data.sla_breached_at ? String(data.sla_breached_at) : null,
    assigned_team: String(data.assigned_team || 'support'),
    created_by_user_id: data.created_by_user_id ? String(data.created_by_user_id) : null,
    created_at: String(data.created_at),
    lodged_at: data.lodged_at ? String(data.lodged_at) : null,
    warehouse_received_at: data.warehouse_received_at ? String(data.warehouse_received_at) : null,
    warehouse_approved_at: data.warehouse_approved_at ? String(data.warehouse_approved_at) : null,
    warehouse_denied_at: data.warehouse_denied_at ? String(data.warehouse_denied_at) : null,
    exchange_completed_at: data.exchange_completed_at ? String(data.exchange_completed_at) : null,
    sent_to_invoicing_at: data.sent_to_invoicing_at ? String(data.sent_to_invoicing_at) : null,
    invoicing_done_at: data.invoicing_done_at ? String(data.invoicing_done_at) : null,
    refund_sent_at: data.refund_sent_at ? String(data.refund_sent_at) : null,
    refund_amount: Number(data.refund_amount || 0),
    refund_status: (data.refund_status as 'NONE' | 'PENDING' | 'PROCESSED') || 'NONE',
    amount_collected: Number(data.amount_collected || 0),
    closed_at: data.closed_at ? String(data.closed_at) : null,
    updated_at: String(data.updated_at),
  };
}

export function useTickets(filters?: {
  stage?: TicketStage[];
  status?: TicketStatus[];
  search?: string;
  sla_breached?: boolean;
}) {
  return useQuery({
    queryKey: ['tickets', filters],
    queryFn: async () => {
      let query = supabase
        .from('tickets')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.stage && filters.stage.length > 0) {
        query = query.in('stage', filters.stage);
      }
      if (filters?.status && filters.status.length > 0) {
        query = query.in('status', filters.status);
      }
      if (filters?.sla_breached !== undefined) {
        query = query.eq('sla_breached', filters.sla_breached);
      }
      if (filters?.search) {
        query = query.or(
          `order_id.ilike.%${filters.search}%,customer_name.ilike.%${filters.search}%,customer_phone.ilike.%${filters.search}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(d => mapTicket(d as unknown as Record<string, unknown>));
    },
  });
}

export function useTicket(id: string | undefined) {
  return useQuery({
    queryKey: ['ticket', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase.from('tickets').select('*').eq('id', id).single();
      if (error) throw error;
      return mapTicket(data as unknown as Record<string, unknown>);
    },
    enabled: !!id,
  });
}

export function useTicketEvents(ticketId: string | undefined) {
  return useQuery({
    queryKey: ['ticket-events', ticketId],
    queryFn: async () => {
      if (!ticketId) return [];
      const { data, error } = await supabase.from('ticket_events').select('*').eq('ticket_id', ticketId).order('event_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!ticketId,
  });
}

export function useCreateTicket() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: CreateTicketData) => {
      try {
        const { data: tickets, error } = await supabase.from('tickets').insert({
          order_id: data.order_id,
          customer_name: data.customer_name,
          customer_phone: data.customer_phone,
          student_name: data.student_name || null,
          student_grade: data.student_grade || null,
          student_section: data.student_section || null,
          school_name: data.school_name || null,
          reason_code: data.reason_code,
          reason_notes: data.reason_notes || null,
          return_items: data.return_items as any,
          exchange_items: data.exchange_items as any,
          notes: data.notes || null,
          created_by_user_id: user?.id || null,
          stage: 'LODGED',
          status: 'NEW',
          assigned_team: 'support',
        }).select();

        if (error) {
          console.error('Ticket creation error:', error);
          throw new Error(error.message || 'Failed to create ticket');
        }

        const ticket = tickets?.[0];
        if (!ticket) {
          throw new Error('Failed to create ticket: No data returned');
        }

        try {
          await supabase.from('ticket_events').insert({
            ticket_id: ticket.id,
            event_type: 'CREATED' as const,
            event_by_user_id: user?.id || null,
            event_payload: { 
              order_id: data.order_id,
              customer_name: data.customer_name,
              reason_code: data.reason_code
            },
          });
        } catch (eventError) {
          console.warn('Failed to create ticket event:', eventError);
          // Don't fail if event creation fails
        }

        return ticket;
      } catch (error) {
        console.error('Error in useCreateTicket:', error);
        throw error;
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tickets'] }); },
  });
}

export function useUpdateTicket() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, eventType, ...updates }: UpdateTicketData & { eventType?: EventType }) => {
      const { data: ticket, error } = await supabase.from('tickets').update(updates).eq('id', id).select().single();
      if (error) throw error;

      if (eventType) {
        await supabase.from('ticket_events').insert({
          ticket_id: id,
          event_type: eventType,
          event_by_user_id: user?.id || null,
          event_payload: { 
            stage: updates.stage,
            updated_fields: Object.keys(updates)
          },
        });
      }
      return ticket;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      queryClient.invalidateQueries({ queryKey: ['ticket'] });
      queryClient.invalidateQueries({ queryKey: ['ticket-events'] });
    },
  });
}

export function useTicketStats() {
  return useQuery({
    queryKey: ['ticket-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tickets').select('stage, status, sla_breached, created_at');
      if (error) throw error;
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return {
        totalOpen: data.filter(t => !['CLOSED', 'INVOICED'].includes(t.stage)).length,
        pendingWarehouse: data.filter(t => ['LODGED', 'WAREHOUSE_PENDING'].includes(t.stage)).length,
        pendingInvoicing: data.filter(t => ['EXCHANGE_COMPLETED', 'INVOICING_PENDING'].includes(t.stage)).length,
        slaBreached: data.filter(t => t.sla_breached).length,
        completedThisWeek: data.filter(t => t.status === 'COMPLETED' && new Date(t.created_at) >= weekAgo).length,
        denied: data.filter(t => t.status === 'DENIED').length,
      };
    },
  });
}
