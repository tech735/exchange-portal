import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * SKU → price lookup, covering both the product handle and every variant SKU.
 * SKUs without a real price are left out so the UI can flag them as missing.
 */
export function useProductPrices() {
  return useQuery({
    queryKey: ['product-prices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_catalog')
        .select('sku, price, variant_skus, variant_prices')
        .eq('active', true);
      if (error) throw error;

      const priceMap: Record<string, number> = {};
      for (const product of data ?? []) {
        const basePrice = Number(product.price) || 0;
        if (basePrice > 0) priceMap[product.sku] = basePrice;

        const variantPrices = (product.variant_prices ?? {}) as Record<string, unknown>;
        const variantSkus = Array.isArray(product.variant_skus) ? product.variant_skus.map(String) : [];
        for (const vSku of variantSkus) {
          const vPrice = Number(variantPrices[vSku]) || basePrice;
          if (vPrice > 0) priceMap[vSku] = vPrice;
        }
      }
      return priceMap;
    },
    staleTime: 1000 * 60 * 5,
    retry: 2,
  });
}
