export type TicketStage = 
  | 'LODGED'
  | 'WAREHOUSE_PENDING'
  | 'WAREHOUSE_APPROVED'
  | 'WAREHOUSE_DENIED'
  | 'EXCHANGE_COMPLETED'
  | 'INVOICING_PENDING'
  | 'INVOICED'
  | 'TO_BE_REFUNDED'
  | 'CLOSED'
  | 'ESCALATED';

export type TicketStatus = 'NEW' | 'IN_PROCESS' | 'COMPLETED' | 'DENIED' | 'ESCALATED';

export type ReasonCode = 
  | 'WRONG_SIZE'
  | 'DEFECTIVE'
  | 'WRONG_ITEM'
  | 'CHANGED_MIND'
  | 'QUALITY_ISSUE'
  | 'OTHER';

export type EventType = 
  | 'CREATED'
  | 'UPDATED'
  | 'RECEIVED'
  | 'APPROVED'
  | 'DENIED'
  | 'EXCHANGE_DONE'
  | 'SENT_TO_INVOICE'
  | 'INVOICED'
  | 'REFUND_SENT'
  | 'ESCALATED'
  | 'CLOSED';

export type UserRole = 'SUPPORT' | 'WAREHOUSE' | 'INVOICING' | 'ADMIN';

export interface TicketItem {
  sku: string;
  product_name: string;
  size: string;
  qty: number;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Ticket {
  id: string;
  order_id: string;
  customer_name: string;
  customer_phone: string;
  student_name: string | null;
  student_grade: string | null;
  student_section: string | null;
  school_name: string | null;
  reason_code: ReasonCode;
  reason_notes: string | null;
  stage: TicketStage;
  status: TicketStatus;
  return_items: TicketItem[];
  exchange_items: TicketItem[];
  notes: string | null;
  return_awb: string | null;
  exchange_awb: string | null;
  sla_breached: boolean;
  sla_breached_at: string | null;
  assigned_team: string;
  created_by_user_id: string | null;
  created_at: string;
  lodged_at: string | null;
  warehouse_received_at: string | null;
  warehouse_approved_at: string | null;
  warehouse_denied_at: string | null;
  exchange_completed_at: string | null;
  sent_to_invoicing_at: string | null;
  invoicing_done_at: string | null;
  refund_sent_at: string | null;
  refund_amount: number;
  refund_status: 'NONE' | 'PENDING' | 'PROCESSED';
  amount_collected: number;
  closed_at: string | null;
  updated_at: string;
}

export interface TicketEvent {
  id: string;
  ticket_id: string;
  event_type: EventType;
  event_by_user_id: string | null;
  event_at: string;
  event_payload: Record<string, unknown>;
}

export interface ProductCatalog {
  id: string;
  sku: string;
  product_name: string;
  variants: string[];
  school_tags: string[] | null;
  active: boolean;
  created_at: string;
}

export const REASON_LABELS: Record<ReasonCode, string> = {
  WRONG_SIZE: 'Wrong Size',
  DEFECTIVE: 'Defective Product',
  WRONG_ITEM: 'Wrong Item Received',
  CHANGED_MIND: 'Changed Mind',
  QUALITY_ISSUE: 'Quality Issue',
  OTHER: 'Other',
};

export const STAGE_LABELS: Record<TicketStage, string> = {
  LODGED: 'Lodged',
  WAREHOUSE_PENDING: 'Warehouse Pending',
  WAREHOUSE_APPROVED: 'Warehouse Approved',
  WAREHOUSE_DENIED: 'Warehouse Denied',
  EXCHANGE_COMPLETED: 'Exchange Completed',
  INVOICING_PENDING: 'Invoicing Pending',
  INVOICED: 'Invoiced',
  TO_BE_REFUNDED: 'To Be Refunded',
  CLOSED: 'Closed',
  ESCALATED: 'Escalated',
};

export const STATUS_LABELS: Record<TicketStatus, string> = {
  NEW: 'New',
  IN_PROCESS: 'In Process',
  COMPLETED: 'Completed',
  DENIED: 'Denied',
  ESCALATED: 'Escalated',
};

export const EVENT_LABELS: Record<EventType, string> = {
  CREATED: 'Ticket Created',
  UPDATED: 'Ticket Updated',
  RECEIVED: 'Received at Warehouse',
  APPROVED: 'Return Approved',
  DENIED: 'Return Denied',
  EXCHANGE_DONE: 'Exchange Completed',
  SENT_TO_INVOICE: 'Sent to Invoicing',
  INVOICED: 'Invoicing Done',
  REFUND_SENT: 'Refund Sent',
  ESCALATED: 'SLA Escalated',
  CLOSED: 'Ticket Closed',
};
