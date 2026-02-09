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
          sku: string;
          product_name: string;
          price: number | null;
          active: boolean;
        };
        Insert: Database['public']['Tables']['product_catalog']['Row'];
        Update: Partial<Database['public']['Tables']['product_catalog']['Insert']>;
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
