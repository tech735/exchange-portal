import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { type TicketItem } from '@/types/database';
import { IndianRupee } from 'lucide-react';
import { useProductPrices } from '@/hooks/useProductPrices';

interface ItemsDisplayProps {
  title: string;
  items: TicketItem[];
}

export function ItemsDisplay({ title, items }: ItemsDisplayProps) {
  const { data: productPrices } = useProductPrices();
  
  // Calculate total value for items using actual prices
  const calculateItemValue = (item: TicketItem): number => {
    const itemPrice = productPrices?.[item.sku] || 1000; // Fallback to 1000 if price not found
    return itemPrice * item.qty;
  };

  const totalValue = items.reduce((sum, item) => sum + calculateItemValue(item), 0);

  return (
    <Card>
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="flex items-center justify-between text-base sm:text-lg">
          {title}
          <div className="text-xs sm:text-sm font-normal">
            Total: <span className="text-primary font-bold">₹{totalValue.toLocaleString()}</span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0 sm:px-6 sm:pb-6">
        {items.length === 0 ? (
          <p className="text-muted-foreground">No items</p>
        ) : (
          <ul className="space-y-2.5">
            {items.map((item, i) => (
              <li key={i} className="flex justify-between items-start gap-2 text-sm">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{item.product_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {item.sku} • {item.size} x{item.qty}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-medium">₹{calculateItemValue(item).toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">
                    ₹{(productPrices?.[item.sku] || 1000).toLocaleString()} ×{item.qty}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
