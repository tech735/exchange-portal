import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Clock, IndianRupee } from 'lucide-react';
import { type Ticket, TicketItem } from '@/types/database';
import { format } from 'date-fns';
import { useProductPrices } from '@/hooks/useProductPrices';

interface PaymentSummaryProps {
  ticket: Ticket;
}

export function PaymentSummary({ ticket }: PaymentSummaryProps) {
  const { data: productPrices } = useProductPrices();
  
  // Calculate item values using actual prices
  const calculateItemValue = (items: TicketItem[]): number => {
    return items.reduce((total, item) => {
      const itemPrice = productPrices?.[item.sku] || 1000; // Fallback to 1000 if price not found
      return total + (itemPrice * item.qty);
    }, 0);
  };

  const returnItemsValue = calculateItemValue(ticket.return_items || []);
  const exchangeItemsValue = calculateItemValue(ticket.exchange_items || []);
  const deliveryCharge = 150; // Default delivery charge
  const totalAmountToCollect = Math.max(0, exchangeItemsValue - returnItemsValue + deliveryCharge);

  const isPaymentCollected = ticket.sent_to_invoicing_at ? true : false;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IndianRupee className="h-5 w-5" />
          Payment Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Return Items Value:</span>
            <div className="font-medium text-red-600">-₹{returnItemsValue.toLocaleString()}</div>
          </div>
          <div>
            <span className="text-muted-foreground">Exchange Items Value:</span>
            <div className="font-medium text-green-600">+₹{exchangeItemsValue.toLocaleString()}</div>
          </div>
          <div>
            <span className="text-muted-foreground">Delivery Charge:</span>
            <div className="font-medium">₹{deliveryCharge.toLocaleString()}</div>
          </div>
          <div>
            <span className="text-muted-foreground">Total Amount:</span>
            <div className="font-bold text-primary">₹{totalAmountToCollect.toLocaleString()}</div>
          </div>
        </div>

        <div className="border-t pt-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Payment Status:</span>
            {isPaymentCollected ? (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-4 w-4" />
                <div>
                  <div className="font-medium">Collected</div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(ticket.sent_to_invoicing_at!), 'MMM d, yyyy HH:mm')}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-orange-500">
                <Clock className="h-4 w-4" />
                <div className="font-medium">Pending Collection</div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
