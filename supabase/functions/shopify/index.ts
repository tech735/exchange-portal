/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import * as redis from '../_shared/redis.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Cache TTLs (seconds)
const TTL_LOCATIONS = 3600;       // 1 hour  — locations almost never change
const TTL_RECENT_ORDERS = 120;    // 2 min   — orders update frequently
const TTL_PRODUCTS = 600;         // 10 min  — product list during sync
const TTL_INVENTORY = 600;        // 10 min  — inventory levels during sync

function stripHtml(html: string | null): string | null {
    if (!html) return null;
    return html.replace(/<[^>]*>/g, '').trim();
}

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

    const onlineStore = locations.find((l: any) => l.name.toLowerCase().includes('online store'));
    const primary = onlineStore || locations.find((l: any) => l.legacy_primary === true) || locations[0];
    return primary ? primary.id : null;
}

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
        const body = await req.json();
        const { action, orderId, forceRefresh = false } = body;

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

        const cleanStoreUrl = shopifyStoreUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
        // Use a short hash of the store URL as a safe cache key segment
        const storeKey = cleanStoreUrl.replace(/[^a-zA-Z0-9]/g, '_');

        // ─────────────────────────────────────────────
        // ACTION: getOrder  (not cached — each order is unique)
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
        // ACTION: getRecentOrders  — cached 2 min
        // ─────────────────────────────────────────────
        if (action === 'getRecentOrders') {
            const cacheKey = `shopify:recent_orders:${storeKey}`;

            if (!forceRefresh) {
                const cached = await redis.get<any[]>(cacheKey);
                if (cached) {
                    console.log('Cache HIT: getRecentOrders');
                    return new Response(JSON.stringify({ orders: cached, _cache: 'HIT' }), {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                        status: 200,
                    });
                }
            }

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
            const orders = data.orders || [];

            await redis.set(cacheKey, orders, TTL_RECENT_ORDERS);
            console.log(`Cache MISS: getRecentOrders — cached ${orders.length} orders for ${TTL_RECENT_ORDERS}s`);

            return new Response(JSON.stringify({ orders, _cache: 'MISS' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        // ─────────────────────────────────────────────
        // ACTION: getLocations  — cached 1 hour
        // ─────────────────────────────────────────────
        if (action === 'getLocations') {
            const cacheKey = `shopify:locations:${storeKey}`;

            if (!forceRefresh) {
                const cached = await redis.get<any[]>(cacheKey);
                if (cached) {
                    console.log('Cache HIT: getLocations');
                    return new Response(JSON.stringify({ locations: cached, _cache: 'HIT' }), {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                        status: 200,
                    });
                }
            }

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
            const locations = data.locations || [];

            await redis.set(cacheKey, locations, TTL_LOCATIONS);
            console.log(`Cache MISS: getLocations — cached ${locations.length} locations for ${TTL_LOCATIONS}s`);

            return new Response(JSON.stringify({ locations, _cache: 'MISS' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        // ─────────────────────────────────────────────
        // ACTION: syncProducts
        // Shopify API calls are cached to avoid hammering the API on repeat syncs.
        // The DB upsert still always runs so the catalog stays up to date.
        // Pass forceRefresh: true to bypass the Shopify cache.
        // ─────────────────────────────────────────────
        if (action === 'syncProducts') {
            console.log('Starting Shopify product catalogue sync...');

            const supabaseUrl = Deno.env.get('SUPABASE_URL');
            const supabaseServiceKey = Deno.env.get('SERVICE_ROLE_KEY');

            if (!supabaseUrl || !supabaseServiceKey) {
                return new Response(JSON.stringify({ error: 'Supabase service credentials not configured' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 500,
                });
            }

            const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

            const productsCacheKey = `shopify:products:${storeKey}`;
            const locationsCacheKey = `shopify:locations:${storeKey}`;

            // --- 1. Fetch products (cache-aware) ---
            let products: any[] | null = null;
            if (!forceRefresh) {
                products = await redis.get<any[]>(productsCacheKey);
                if (products) {
                    console.log(`Cache HIT: Shopify products (${products.length} items)`);
                }
            }
            if (!products) {
                products = await fetchAllShopifyProducts(cleanStoreUrl, shopifyAccessToken);
                console.log(`Cache MISS: Fetched ${products.length} products from Shopify`);
                await redis.set(productsCacheKey, products, TTL_PRODUCTS);
            }

            // --- 2. Fetch primary location (cache-aware) ---
            let primaryLocationId: number | null = null;
            const cachedLocations = forceRefresh ? null : await redis.get<any[]>(locationsCacheKey);
            if (cachedLocations) {
                const onlineStore = cachedLocations.find((l: any) => l.name.toLowerCase().includes('online store'));
                const primary = onlineStore || cachedLocations.find((l: any) => l.legacy_primary === true) || cachedLocations[0];
                primaryLocationId = primary ? primary.id : null;
                console.log(`Cache HIT: locations, using location ${primaryLocationId}`);
            } else {
                primaryLocationId = await getPrimaryLocationId(cleanStoreUrl, shopifyAccessToken);
            }

            // --- 3. Fetch inventory (cache-aware, keyed by location) ---
            let inventoryMap: Map<number, number> | null = null;
            if (primaryLocationId) {
                const inventoryCacheKey = `shopify:inventory:${storeKey}:${primaryLocationId}`;
                const cachedInventory = forceRefresh ? null : await redis.get<Record<string, number>>(inventoryCacheKey);
                if (cachedInventory) {
                    // Reconstruct Map from plain object (JSON keys are strings)
                    inventoryMap = new Map(
                        Object.entries(cachedInventory).map(([k, v]) => [Number(k), v])
                    );
                    console.log(`Cache HIT: inventory (${inventoryMap.size} levels)`);
                } else {
                    console.log(`Fetching inventory levels for location: ${primaryLocationId}`);
                    inventoryMap = await fetchInventoryMapForLocation(cleanStoreUrl, shopifyAccessToken, primaryLocationId);
                    console.log(`Cache MISS: fetched ${inventoryMap.size} inventory levels`);
                    // Store as plain object for JSON serialization
                    const inventoryObj: Record<string, number> = {};
                    inventoryMap.forEach((qty, id) => { inventoryObj[String(id)] = qty; });
                    await redis.set(inventoryCacheKey, inventoryObj, TTL_INVENTORY);
                }
            } else {
                console.warn('Could not resolve primary location ID, falling back to global inventory');
            }

            // --- 4. Map Shopify products → product_catalog rows and upsert ---
            const now = new Date().toISOString();
            const syncedSkus: string[] = [];
            let synced = 0;
            let errors = 0;

            for (const product of products) {
                const variants = product.variants || [];
                if (variants.length === 0) continue;

                const sku = product.handle;
                const productName = product.title || 'Untitled Product';

                const sizes = variants.map(v => v.title === 'Default Title' ? 'Standard' : v.title);
                const allVariantSkus = variants.map(v => v.sku || '');

                const variantPrices: Record<string, number> = {};
                const variantInventory: Record<string, number> = {};
                variants.forEach(v => {
                    if (v.sku) {
                        variantPrices[v.sku] = parseFloat(v.price) || 0;
                        const locationStock = inventoryMap ? inventoryMap.get(v.inventory_item_id) : null;
                        variantInventory[v.sku] = locationStock !== null && locationStock !== undefined
                            ? locationStock
                            : (parseInt(v.inventory_quantity) || 0);
                    }
                });

                const row = {
                    sku,
                    product_name: productName,
                    product_description: stripHtml(product.body_html),
                    category: product.product_type || null,
                    variants: sizes,
                    variant_skus: allVariantSkus,
                    variant_prices: variantPrices,
                    variant_inventory: variantInventory,
                    school_tags: product.tags
                        ? product.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
                        : null,
                    price: parseFloat(variants[0].price) || 0,
                    active: product.status === 'active',
                    shopify_product_id: product.id,
                    shopify_variant_id: null,
                    last_synced_at: now,
                };

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

            // --- 5. Deactivate products removed from Shopify ---
            let deactivated = 0;
            if (syncedSkus.length > 0) {
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

            console.log(`Sync complete: ${synced} synced, ${deactivated} deactivated, ${errors} errors`);

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
