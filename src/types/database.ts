export type TicketStage =
  | 'LODGED'
  | 'RETURN_PENDING'
  | 'RETURN_RECEIVED'
  | 'WAREHOUSE_APPROVED'
  | 'WAREHOUSE_DENIED'
  | 'EXCHANGE_BOOKED'
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
  price?: number; // Captures price at the time of ticket creation
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
  customer_email: string | null;
  student_name: string | null;
  student_grade: string | null;
  student_section: string | null;
  school_name: string | null;
  reason_code: ReasonCode;
  reason_notes: string | null;
  stage: TicketStage;
  status: TicketStatus;
  is_paid: boolean;

  // New fields for strict flow
  return_aggregator: 'SHIPDELIGHT' | 'ITHINK' | 'SHIPROCKET' | null;
  exchange_aggregator: 'SHIPDELIGHT' | 'ITHINK' | 'SHIPROCKET' | null;
  return_booked_at: string | null;
  return_received_at: string | null;
  qc_decision: 'APPROVED' | 'DENIED' | null;
  qc_notes: string | null;
  exchange_booked_at: string | null;

  return_items: TicketItem[];
  exchange_items: TicketItem[];
  notes: string | null;
  return_awb: string | null;
  exchange_awb: string | null;
  sla_breached: boolean;
  sla_breached_at: string | null;
  sla_2day_warning_sent_at: string | null;
  sla_warehouse_breach_sent_at: string | null;
  sla_tech_breach_sent_at: string | null;
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

  // Revamp phase 1 (all optional in the DB)
  request_source: 'EMAIL' | 'WHATSAPP' | 'CALL' | 'HELPDESK' | 'OTHER' | null;
  request_ref: string | null;
  request_received_at: string | null;
  assigned_to: string | null;
  delivery_charge: number | null;
  qc_checklist: Record<string, boolean> | null;
  qc_photos: string[];
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
  product_description: string | null;
  category: string | null;
  variants: string[];
  variant_skus: string[];
  variant_prices: Record<string, number>;
  variant_inventory: Record<string, number>;
  school_tags: string[] | null;
  price: number | null;
  active: boolean;
  shopify_product_id: number | null;
  shopify_variant_id: number | null;
  image_url?: string | null;
  variant_images?: Record<string, string>;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ShipmentStatus =
  | 'AWAITING_PICKUP'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'RTO'
  | 'CANCELLED';

export type DeliveryZone = 'DELHI_NCR' | 'OUTSIDE_NCR';

export type NotificationChannel = 'EMAIL' | 'WHATSAPP' | 'SMS' | 'CALL';

export type ShipmentAggregator = 'ITHINK' | 'SHIPDELIGHT';

export interface Shipment {
  id: string;
  shipment_key: string;
  source: 'SHOPIFY' | 'MANUAL';
  shopify_order_id: number | null;
  shopify_fulfillment_id: number | null;
  order_name: string;
  shipment_ref: string;
  order_date: string; // yyyy-MM-dd
  raised_date: string | null; // exchanges / returns: day raised; deadlines count from it
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  delivery_zone: DeliveryZone;
  courier: string | null;
  awb_number: string | null;
  tracking_url: string | null;
  status: ShipmentStatus;
  courier_status: string | null;
  pickup_date: string | null;
  expected_delivery_date: string | null; // courier override; null = derived from SLA
  delivered_date: string | null;
  customer_notified: boolean;
  notified_on: string | null;
  notified_via: NotificationChannel | null;
  notes: string | null;
  resolution: string | null;
  resolved_on: string | null;
  pickup_alert_sent_at: string | null;
  delay_alert_sent_at: string | null;
  escalation_alert_sent_at: string | null;
  manual_overrides: string[];
  aggregator: ShipmentAggregator | null;
  tracking_error: string | null;
  tracking_error_at: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export type SpecialCaseType = 'EXCHANGE' | 'RETURN' | 'RTO' | 'OTHER';
export type SpecialCaseStatus = 'OPEN' | 'RESOLVED';

export interface SpecialCase {
  id: string;
  order_name: string;
  case_type: SpecialCaseType;
  issue: string;
  action_taken: string | null;
  awb_number: string | null;
  latest_update: string | null;
  status: SpecialCaseStatus;
  resolved_on: string | null; // yyyy-MM-dd
  updated_by: string | null;
  owner_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CaseUpdate {
  id: string;
  case_id: string;
  body: string;
  author_id: string | null;
  author_name: string | null;
  created_at: string;
}

export interface ExchangePolicySettings {
  window_days: number;
  max_per_order: number;
  block_final_sale: boolean;
  final_sale_tag: string;
  allow_different_product: boolean;
}

export interface FeeSettings {
  delivery_charge: number;
  free_reasons: ReasonCode[];
  payment_provider: string;
}

export interface QcChecklistSettings {
  items: string[];
}

export interface AppSettings {
  exchange_policy: ExchangePolicySettings;
  fees: FeeSettings;
  qc_checklist: QcChecklistSettings;
}

export const SPECIAL_CASE_TYPE_LABELS: Record<SpecialCaseType, string> = {
  EXCHANGE: 'Exchange',
  RETURN: 'Return',
  RTO: 'RTO',
  OTHER: 'Other',
};

export const AGGREGATOR_LABELS: Record<ShipmentAggregator, string> = {
  ITHINK: 'iThink',
  SHIPDELIGHT: 'ShipDelight',
};

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  AWAITING_PICKUP: 'Awaiting Pickup',
  PICKED_UP: 'Picked Up',
  IN_TRANSIT: 'In Transit',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered',
  RTO: 'RTO',
  CANCELLED: 'Cancelled',
};

export const DELIVERY_ZONE_LABELS: Record<DeliveryZone, string> = {
  DELHI_NCR: 'Delhi NCR',
  OUTSIDE_NCR: 'Outside NCR',
};

export const NOTIFICATION_CHANNEL_LABELS: Record<NotificationChannel, string> = {
  EMAIL: 'Email',
  WHATSAPP: 'WhatsApp',
  SMS: 'SMS',
  CALL: 'Phone call',
};

export const REASON_LABELS: Record<ReasonCode, string> = {
  WRONG_SIZE: 'Wrong size',
  DEFECTIVE: 'Defective',
  WRONG_ITEM: 'Wrong item received',
  CHANGED_MIND: 'Changed mind',
  QUALITY_ISSUE: 'Quality issue',
  OTHER: 'Other',
};

export const STAGE_LABELS: Record<TicketStage, string> = {
  LODGED: 'Lodged',
  RETURN_PENDING: 'Return Pending',
  RETURN_RECEIVED: 'Return Received',
  WAREHOUSE_APPROVED: 'Warehouse Approved',
  WAREHOUSE_DENIED: 'Warehouse Denied',
  EXCHANGE_BOOKED: 'Exchange Booked',
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
