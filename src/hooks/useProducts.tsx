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
      
      return (data || []).map(product => {
        let variants: string[] = [];
        if (Array.isArray(product.variants)) {
          variants = product.variants.map(v => String(v));
        }
        return {
          id: product.id,
          sku: product.sku,
          product_name: product.product_name,
          variants,
          school_tags: product.school_tags,
          active: product.active,
          created_at: product.created_at,
        } as ProductCatalog;
      });
    },
  });
}
