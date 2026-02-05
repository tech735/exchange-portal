import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ProductWithPrice {
  sku: string;
  price: number;
  product_name: string;
}

interface ProductWithoutPrice {
  sku: string;
  product_name: string;
}

export function useProductPrices() {
  return useQuery({
    queryKey: ['product-prices'],
    queryFn: async () => {
      console.log('Fetching product prices from database...');
      
      try {
        // Try to fetch with price column first
        const { data, error } = await supabase
          .from('product_catalog')
          .select('sku, price, product_name')
          .eq('active', true);
        
        if (error) {
          console.error('Error fetching product prices:', error);
          
          // If price column doesn't exist, fetch without it and use default prices
          if (error.message?.includes('column "price" does not exist')) {
            console.log('Price column not found, fetching products without prices...');
            const { data: productsWithoutPrice, error: fallbackError } = await supabase
              .from('product_catalog')
              .select('sku, product_name')
              .eq('active', true);
            
            if (fallbackError) {
              console.error('Error fetching products:', fallbackError);
              throw fallbackError;
            }
            
            // Use default prices based on product type
            const priceMap: Record<string, number> = {};
            if (productsWithoutPrice && Array.isArray(productsWithoutPrice)) {
              productsWithoutPrice.forEach((product: ProductWithoutPrice) => {
                priceMap[product.sku] = getDefaultPrice(product.sku);
              });
            }
            
            console.log('Price map created with default prices:', priceMap);
            return priceMap;
          }
          
          throw error;
        }
        
        console.log('Fetched products:', data);
        
        // Convert to price lookup map
        const priceMap: Record<string, number> = {};
        if (data && Array.isArray(data)) {
          data.forEach((product: ProductWithPrice) => {
            priceMap[product.sku] = Number(product.price) || getDefaultPrice(product.sku);
          });
        }
        
        console.log('Price map created:', priceMap);
        return priceMap;
        
      } catch (error) {
        console.error('Failed to fetch product prices:', error);
        throw error;
      }
    },
    staleTime: 1000 * 60 * 5, // 5 minutes for fresher data
    retry: 2,
  });
}

// Helper function to determine default price based on SKU
function getDefaultPrice(sku: string): number {
  const skuUpper = sku.toUpperCase();
  if (skuUpper.includes('SHIRT')) return 25.99;
  if (skuUpper.includes('SKIRT')) return 35.99;
  if (skuUpper.includes('PANT')) return 45.99;
  if (skuUpper.includes('BLZR')) return 89.99;
  if (skuUpper.includes('SHOE')) return 55.99;
  if (skuUpper.includes('SOCK')) return 12.99;
  if (skuUpper.includes('TIE')) return 15.99;
  if (skuUpper.includes('BELT')) return 18.99;
  if (skuUpper.includes('BAG')) return 42.99;
  if (skuUpper.includes('SPORT')) return 22.99;
  return 30.00; // Default fallback price
}
