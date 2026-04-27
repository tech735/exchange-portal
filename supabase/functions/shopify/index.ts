/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Strip HTML tags from a string for plain-text product descriptions.
 */
function stripHtml(html: string | null): string | null {
    if (!html) return null;
    return html.replace(/<[^>]*>/g, '').trim();
}

/**
 * Fetch all pages of Shopify products using Link-header pagination.
 * Returns an array of all product objects.
 */
async function fetchAllShopifyProducts(
    storeUrl: string,
    accessToken: string,
): Promise<any[]> {
    const allProducts: any[] = [];
    let url: string | null =
        `https://${storeUrl}/admin/api/2024-01/products.json?limit=250&status=active`;

    while (url) {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': accessToken,
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Shopify products API error:', response.status, errorText);
            throw new Error(`Shopify API error ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        if (data.products && Array.isArray(data.products)) {
            allProducts.push(...data.products);
        }

        // Follow pagination via the Link header
        url = null;
        const linkHeader = response.headers.get('link');
        if (linkHeader) {
            const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
            if (nextMatch) {
                url = nextMatch[1];
            }
        }
    }

    return allProducts;
}

/**
 * Fetch all locations and find the primary one.
 */
async function getPrimaryLocationId(storeUrl: string, accessToken: string): Promise<number | null> {
    const url = `https://${storeUrl}/admin/api/2024-01/locations.json`;
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': accessToken,
        },
    });

    if (!response.ok) return null;
    const data = await response.json();
    const locations = data.locations || [];
    
    // Try to find the primary location or one named "Online Store"
    const onlineStore = locations.find((l: any) => l.name.toLowerCase().includes('online store'));
    const primary = onlineStore || locations.find((l: any) => l.legacy_primary === true) || locations[0];
    return primary ? primary.id : null;
}

/**
 * Fetch all inventory levels for a specific location.
 * Returns a map of inventory_item_id -> available quantity.
 */
async function fetchInventoryMapForLocation(
    storeUrl: string,
    accessToken: string,
    locationId: number,
): Promise<Map<number, number>> {
    const inventoryMap = new Map<number, number>();
    let url: string | null = `https://${storeUrl}/admin/api/2024-01/locations/${locationId}/inventory_levels.json?limit=250`;

    while (url) {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': accessToken,
            },
        });

        if (!response.ok) {
            console.error('Error fetching inventory levels:', response.status);
            break;
        }

        const data = await response.json();
        if (data.inventory_levels && Array.isArray(data.inventory_levels)) {
            data.inventory_levels.forEach((level: any) => {
                inventoryMap.set(level.inventory_item_id, level.available || 0);
            });
        }

        url = null;
        const linkHeader = response.headers.get('link');
        if (linkHeader) {
            const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
            if (nextMatch) url = nextMatch[1];
        }
    }

    return inventoryMap;
}

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

        // ─────────────────────────────────────────────
        // ACTION: getOrder
        // ─────────────────────────────────────────────
        if (action === 'getOrder') {
            if (!orderId) {
                return new Response(JSON.stringify({ error: 'Order ID is required' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 400,
                });
            }

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

        // ─────────────────────────────────────────────
        // ACTION: getRecentOrders
        // ─────────────────────────────────────────────
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

        // ─────────────────────────────────────────────
        // ACTION: getLocations
        // ─────────────────────────────────────────────
        if (action === 'getLocations') {
            const locationsUrl = `https://${cleanStoreUrl}/admin/api/2024-01/locations.json`;

            const response = await fetch(locationsUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Shopify-Access-Token': shopifyAccessToken,
                },
            });

            if (!response.ok) {
                const errorText = await response.text();
                return new Response(JSON.stringify({ error: `Shopify API error: ${errorText}` }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: response.status,
                });
            }

            const data = await response.json();
            return new Response(JSON.stringify({ locations: data.locations || [] }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        // ─────────────────────────────────────────────
        // ACTION: syncProducts (Updated Strategy: Group by Product)
        // ─────────────────────────────────────────────
        if (action === 'syncProducts') {
            console.log('Starting Shopify product catalogue sync (Grouped Strategy)...');

            // Create a Supabase client with the service-role key to bypass RLS
            const supabaseUrl = Deno.env.get('SUPABASE_URL');
            const supabaseServiceKey = Deno.env.get('SERVICE_ROLE_KEY');

            if (!supabaseUrl || !supabaseServiceKey) {
                return new Response(JSON.stringify({ error: 'Supabase service credentials not configured' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 500,
                });
            }

            const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

            // 1. Fetch all products from Shopify
            const products = await fetchAllShopifyProducts(cleanStoreUrl, shopifyAccessToken);
            console.log(`Fetched ${products.length} products from Shopify`);

            // 1b. Fetch inventory map for primary location
            const primaryLocationId = await getPrimaryLocationId(cleanStoreUrl, shopifyAccessToken);
            let inventoryMap = null;
            if (primaryLocationId) {
                console.log(`Fetching inventory levels for primary location: ${primaryLocationId}`);
                inventoryMap = await fetchInventoryMapForLocation(cleanStoreUrl, shopifyAccessToken, primaryLocationId);
                console.log(`Fetched ${inventoryMap.size} inventory levels`);
            } else {
                console.warn('Could not find primary location ID, falling back to global inventory quantity');
            }

            // 2. Map each Shopify product to a product_catalog row
            //    (Variants are grouped within the row)
            const now = new Date().toISOString();
            const syncedSkus: string[] = [];
            let synced = 0;
            let errors = 0;

            for (const product of products) {
                const variants = product.variants || [];
                if (variants.length === 0) continue;

                // Group Strategy: Use the product handle as the SKU for the catalog row
                const sku = product.handle;
                const productName = product.title || 'Untitled Product';

                // Align titles and SKUs by index
                const sizes = variants.map(v => v.title === 'Default Title' ? 'Standard' : v.title);
                const allVariantSkus = variants.map(v => v.sku || '');
                
                // Build maps of variant SKU -> price & inventory
                const variantPrices: Record<string, number> = {};
                const variantInventory: Record<string, number> = {};
                variants.forEach(v => {
                    if (v.sku) {
                        variantPrices[v.sku] = parseFloat(v.price) || 0;
                        
                        // Use location-specific inventory if available, otherwise fallback to global quantity
                        const locationStock = inventoryMap ? inventoryMap.get(v.inventory_item_id) : null;
                        variantInventory[v.sku] = locationStock !== null ? (locationStock || 0) : (parseInt(v.inventory_quantity) || 0);
                    }
                });

                const row = {
                    sku,
                    product_name: productName,
                    product_description: stripHtml(product.body_html),
                    category: product.product_type || null,
                    variants: sizes, // CRITICAL: Send as JS array for JSONB column
                    variant_skus: allVariantSkus,
                    variant_prices: variantPrices,
                    variant_inventory: variantInventory,
                    school_tags: product.tags
                        ? product.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
                        : null,
                    price: parseFloat(variants[0].price) || 0,
                    active: product.status === 'active',
                    shopify_product_id: product.id,
                    shopify_variant_id: null, // No longer specific to one variant-row
                    last_synced_at: now,
                };

                // Upsert by SKU (handle)
                if (synced === 0) {
                    console.log(`Sample data for SKU ${sku}: ` + JSON.stringify({
                        product_name: productName,
                        variant_skus: allVariantSkus,
                        variant_prices: variantPrices
                    }));
                }

                const { error: upsertError } = await supabaseAdmin
                    .from('product_catalog')
                    .upsert(row, { onConflict: 'sku' });

                if (upsertError) {
                    console.error(`Error upserting SKU ${sku}:`, upsertError);
                    errors++;
                } else {
                    synced++;
                    syncedSkus.push(sku);
                }
            }

            // 3. Deactivate products that were not in the Shopify response
            //    (only deactivate those that were previously synced from Shopify)
            let deactivated = 0;
            if (syncedSkus.length > 0) {
                // We're deactivating rows that are marked active but weren't in this sync batch
                // AND have a Shopify Product ID (ensuring we don't deactivate manually added items)
                const { data: staleProducts, error: staleError } = await supabaseAdmin
                    .from('product_catalog')
                    .update({ active: false, last_synced_at: now })
                    .not('shopify_product_id', 'is', null)
                    .not('sku', 'in', `(${syncedSkus.map(s => `"${s}"`).join(',')})`)
                    .eq('active', true)
                    .select('sku');

                if (staleError) {
                    console.error('Error deactivating stale products:', staleError);
                } else {
                    deactivated = staleProducts?.length || 0;
                }
            }

            console.log(`Sync complete: ${synced} products synced, ${deactivated} deactivated, ${errors} errors`);

            return new Response(JSON.stringify({
                success: true,
                synced,
                deactivated,
                errors,
                totalShopifyProducts: products.length,
            }), {
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
