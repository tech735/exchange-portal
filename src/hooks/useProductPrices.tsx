import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useProductPrices() {
  return useQuery({
    queryKey: ['product-prices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_catalog')
        .select('sku, price')
        .eq('active', true);
      
      if (error) throw error;
      
      // Convert to price lookup map
      const priceMap: Record<string, number> = {};
      data?.forEach(product => {
        priceMap[product.sku] = Number(product.price);
      });
      
      return priceMap;
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}
