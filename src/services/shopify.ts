import { supabase } from '@/integrations/supabase/client';

export interface ShopifyOrderLineItem {
    id: number;
    product_id: number;
    variant_id: number;
    title: string;
    quantity: number;
    price: string;
    sku: string;
    variant_title: string;
    name: string;
    fulfillable_quantity: number;
    tax_lines: Array<{
        title: string;
        price: string;
        rate: number;
    }>;
}

export interface ShopifyOrder {
    id: number;
    name: string;
    email: string;
    phone: string | null;
    customer: {
        first_name: string;
        last_name: string;
        email: string;
        phone: string | null;
    };
    shipping_address?: {
        first_name: string;
        last_name: string;
        address1: string;
        address2?: string;
        city: string;
        province: string;
        zip: string;
        country: string;
        phone?: string;
    };
    billing_address?: {
        first_name: string;
        last_name: string;
        address1: string;
        address2?: string;
        city: string;
        province: string;
        zip: string;
        country: string;
        phone?: string;
    };
    line_items: ShopifyOrderLineItem[];
    total_price: string;
    subtotal_price: string;
    total_tax: string;
    currency: string;
    financial_status: string;
    fulfillment_status: string | null;
    created_at: string;
    fulfillments?: Array<{
        tracking_company: string;
        tracking_number: string;
        tracking_url: string;
        status: string;
        location_id: number;
        name?: string;
        created_at?: string;
        line_items?: Array<{
            id: number;
            quantity: number;
        }>;
    }>;
}

export interface SyncResult {
    success: boolean;
    synced: number;
    deactivated: number;
    errors: number;
    totalShopifyProducts: number;
}

export const shopifyService = {
    /**
     * Fetch a Shopify order by its name/ID (e.g., KO-1256)
     */
    async getOrder(orderId: string): Promise<ShopifyOrder> {
        const { data, error } = await supabase.functions.invoke('shopify', {
            body: { action: 'getOrder', orderId },
        });

        if (error) {
            console.error('Error invoking shopify function:', error);
            throw new Error(error.message || 'Failed to fetch order');
        }

        if (data?.error) {
            throw new Error(data.error);
        }

        return data.order as ShopifyOrder;
    },

    /**
     * Fetch a list of the 50 most recent orders
     */
    async getRecentOrders(): Promise<ShopifyOrder[]> {
        const { data, error } = await supabase.functions.invoke('shopify', {
            body: { action: 'getRecentOrders' },
        });

        if (error) {
            console.error('Error invoking shopify function:', error);
            throw new Error(error.message || 'Failed to fetch recent orders');
        }

        if (data?.error) {
            throw new Error(data.error);
        }

        return (data.orders || []) as ShopifyOrder[];
    },

    /**
     * Sync the entire Shopify product catalogue into the product_catalog table.
     * Returns a summary of how many products were synced/deactivated.
     */
    async syncProducts(): Promise<SyncResult> {
        const { data, error } = await supabase.functions.invoke('shopify', {
            body: { action: 'syncProducts' },
        });

        if (error) {
            console.error('Error invoking shopify sync:', error);
            throw new Error(error.message || 'Failed to sync products');
        }

        if (data?.error) {
            throw new Error(data.error);
        }

        return data as SyncResult;
    },
};
