import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ProductCatalog } from '@/types/database';

export function useProducts(search?: string) {
  return useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_catalog')
        .select('*')
        .eq('active', true)
        .order('product_name');

      if (error) throw error;
      
        return (data || []).map((product: any) => {
          let variants: string[] = [];
          if (Array.isArray(product.variants)) {
            variants = product.variants.map(v => String(v));
          }
          let variant_skus: string[] = [];
          if (Array.isArray(product.variant_skus)) {
            variant_skus = product.variant_skus.map(v => String(v));
          }
          let variant_inventory: Record<string, number> = {};
          if (product.variant_inventory && typeof product.variant_inventory === 'object') {
            variant_inventory = product.variant_inventory;
          }
          let variant_prices: Record<string, number> = {};
          if (product.variant_prices && typeof product.variant_prices === 'object') {
            variant_prices = product.variant_prices;
          }
          
          return {
            id: product.id,
            sku: product.sku,
            product_name: product.product_name,
            variants,
            variant_skus,
            variant_inventory,
            variant_prices,
            school_tags: product.school_tags,
            active: product.active,
            created_at: product.created_at,
          } as ProductCatalog;
        });
    },
  });
}
