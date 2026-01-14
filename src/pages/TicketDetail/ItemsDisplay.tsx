import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { type TicketItem } from '@/types/database';

interface ItemsDisplayProps {
  title: string;
  items: TicketItem[];
}

export function ItemsDisplay({ title, items }: ItemsDisplayProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-muted-foreground">No items</p>
        ) : (
          <ul className="space-y-2">
            {items.map((item, i) => (
              <li key={i} className="flex justify-between text-sm">
                <span>{item.product_name}</span>
                <span className="text-muted-foreground">
                  {item.size} x{item.qty}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
