/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { action, orderId } = await req.json();

        if (!action) {
            return new Response(JSON.stringify({ error: 'Action is required' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            });
        }

        const shopifyStoreUrl = Deno.env.get('SHOPIFY_STORE_URL');
        const shopifyAccessToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN');

        if (!shopifyStoreUrl || !shopifyAccessToken) {
            return new Response(JSON.stringify({ error: 'Shopify credentials not configured' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 500,
            });
        }

        // Ensure the store URL does not contain protocol and path, just the myshopify.com domain or custom domain
        const cleanStoreUrl = shopifyStoreUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '');

        if (action === 'getOrder') {
            if (!orderId) {
                return new Response(JSON.stringify({ error: 'Order ID is required' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 400,
                });
            }

            // We'll search for the order by name (e.g., #1001) or by ID.
            // Usually, users enter the order name (like KO-1256), so we use the orders.json endpoint with the name: parameter.
            const searchUrl = `https://${cleanStoreUrl}/admin/api/2024-01/orders.json?name=${encodeURIComponent(orderId)}&status=any`;

            const response = await fetch(searchUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Shopify-Access-Token': shopifyAccessToken,
                },
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Shopify API error:', response.status, errorText);
                return new Response(JSON.stringify({ error: 'Failed to fetch from Shopify API' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: response.status,
                });
            }

            const data = await response.json();

            if (!data.orders || data.orders.length === 0) {
                return new Response(JSON.stringify({ error: 'Order not found' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 404,
                });
            }

            const order = data.orders[0];
            return new Response(JSON.stringify({ order }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        if (action === 'getRecentOrders') {
            const listUrl = `https://${cleanStoreUrl}/admin/api/2024-01/orders.json?status=any&limit=50`;

            const response = await fetch(listUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Shopify-Access-Token': shopifyAccessToken,
                },
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Shopify API error:', response.status, errorText);
                return new Response(JSON.stringify({ error: 'Failed to fetch recent orders from Shopify API' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: response.status,
                });
            }

            const data = await response.json();

            return new Response(JSON.stringify({ orders: data.orders || [] }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        return new Response(JSON.stringify({ error: 'Invalid action' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });

    } catch (error) {
        console.error('Error in shopify function:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        });
    }
});
