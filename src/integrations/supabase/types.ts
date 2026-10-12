export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      tickets: {
        Row: {
          id: string;
          order_id: string;
          customer_name: string;
          customer_phone: string;
          student_name: string | null;
          student_grade: string | null;
          student_section: string | null;
          school_name: string | null;
          reason_code: string;
          reason_notes: string | null;
          stage: string;
          status: string;
          return_items: Json;
          exchange_items: Json;
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
        };
        Insert: Omit<Database['public']['Tables']['tickets']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['tickets']['Insert']>;
      };
      ticket_events: {
        Row: {
          id: string;
          ticket_id: string;
          event_type: string;
          event_by_user_id: string | null;
          event_at: string;
          event_payload: Json;
        };
        Insert: Omit<Database['public']['Tables']['ticket_events']['Row'], 'id' | 'event_at'>;
        Update: Partial<Database['public']['Tables']['ticket_events']['Insert']>;
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          role: string;
          password_hash: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      product_catalog: {
        Row: {
          id: string;
          sku: string;
          product_name: string;
          product_description: string | null;
          category: string | null;
          variants: Json;
          school_tags: string[] | null;
          price: number | null;
          active: boolean;
          shopify_product_id: number | null;
          shopify_variant_id: number | null;
          last_synced_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['product_catalog']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['product_catalog']['Insert']>;
      };
      order_shipments: {
        Row: {
          id: string;
          shipment_key: string;
          source: string;
          shopify_order_id: number | null;
          shopify_fulfillment_id: number | null;
          order_name: string;
          shipment_ref: string;
          order_date: string;
          customer_name: string | null;
          customer_phone: string | null;
          customer_email: string | null;
          city: string | null;
          state: string | null;
          pincode: string | null;
          delivery_zone: string;
          courier: string | null;
          awb_number: string | null;
          tracking_url: string | null;
          status: string;
          courier_status: string | null;
          pickup_date: string | null;
          expected_delivery_date: string | null;
          delivered_date: string | null;
          customer_notified: boolean;
          notified_on: string | null;
          notified_via: string | null;
          notes: string | null;
          resolution: string | null;
          resolved_on: string | null;
          pickup_alert_sent_at: string | null;
          delay_alert_sent_at: string | null;
          escalation_alert_sent_at: string | null;
          manual_overrides: string[];
          aggregator: string | null;
          tracking_error: string | null;
          tracking_error_at: string | null;
          last_synced_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Omit<Database['public']['Tables']['order_shipments']['Row'], 'order_name' | 'shipment_ref' | 'order_date'>> &
          Pick<Database['public']['Tables']['order_shipments']['Row'], 'order_name' | 'shipment_ref' | 'order_date'>;
        Update: Partial<Database['public']['Tables']['order_shipments']['Row']>;
      };
      order_special_cases: {
        Row: {
          id: string;
          order_name: string;
          case_type: string;
          issue: string;
          action_taken: string | null;
          awb_number: string | null;
          latest_update: string | null;
          status: string;
          resolved_on: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Omit<Database['public']['Tables']['order_special_cases']['Row'], 'order_name' | 'issue'>> &
          Pick<Database['public']['Tables']['order_special_cases']['Row'], 'order_name' | 'issue'>;
        Update: Partial<Database['public']['Tables']['order_special_cases']['Row']>;
      };
      order_shipment_settings: {
        Row: {
          id: number;
          ncr_delivery_days: number;
          outside_ncr_delivery_days: number;
          pickup_deadline_days: number;
          pickup_deadline_hour: number;
          skip_sundays: boolean;
          rto_escalation_days: number;
          ncr_cities: string[];
          ncr_pincode_prefixes: string[];
          team_alert_emails: string[];
          notify_customers_by_email: boolean;
          notify_customers_by_sms: boolean;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['order_shipment_settings']['Row']>;
        Update: Partial<Database['public']['Tables']['order_shipment_settings']['Row']>;
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
