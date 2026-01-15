import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ProductCatalog } from '@/types/database';

export function useProducts(search?: string) {
  return useQuery({
    queryKey: ['products', search],
    queryFn: async () => {
      let query = supabase
        .from('product_catalog')
        .select('*')
        .eq('active', true)
        .order('product_name');

      if (search) {
        const searchLower = search.toLowerCase();
        query = query.or(`sku.ilike.%${search}%,product_name.ilike.%${search}%,school_tags.cs.{${searchLower}}`);
      }

      const { data, error } = await query;
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
