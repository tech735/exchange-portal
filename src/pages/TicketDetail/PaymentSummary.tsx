import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Clock, IndianRupee, CreditCard } from 'lucide-react';
import { type Ticket, TicketItem } from '@/types/database';
import { format } from 'date-fns';
import { useProductPrices } from '@/hooks/useProductPrices';
import { useUpdateTicket } from '@/hooks/useTickets';
import { useToast } from '@/hooks/use-toast';

interface PaymentSummaryProps {
  ticket: Ticket;
}

export function PaymentSummary({ ticket }: PaymentSummaryProps) {
  const { data: productPrices } = useProductPrices();
  const updateTicket = useUpdateTicket();
  const { toast } = useToast();

  // Calculate item values using stored prices or lookup
  const calculateItemValue = (items: TicketItem[]): number => {
    return items.reduce((total, item) => {
      // Priority: 1. Item's stored price, 2. Catalog price, 3. 0
      const itemPrice = item.price ?? productPrices?.[item.sku] ?? 0;
      return total + (itemPrice * item.qty);
    }, 0);
  };

  const returnItemsValue = calculateItemValue(ticket.return_items || []);
  const exchangeItemsValue = calculateItemValue(ticket.exchange_items || []);
  const deliveryCharge = 150; // Default delivery charge
  const netAmount = exchangeItemsValue - returnItemsValue + deliveryCharge;

  const handleConfirmPayment = async () => {
    try {
      await updateTicket.mutateAsync({
        id: ticket.id,
        is_paid: true,
        status: 'IN_PROCESS',
        assigned_team: 'warehouse',
        eventType: 'UPDATED',
      });
      toast({
        title: 'Payment Confirmed',
        description: 'Ticket has been marked as paid and moved to Warehouse team.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to confirm payment',
        variant: 'destructive',
      });
    }
  };

  const isRefunded = (ticket.refund_amount || 0) > 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-lg font-bold">
          <IndianRupee className="h-5 w-5" />
          Payment Summary
        </CardTitle>
        {!ticket.is_paid && (
          <Button 
            size="sm" 
            onClick={handleConfirmPayment}
            disabled={updateTicket.isPending}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <CreditCard className="h-4 w-4 mr-2" />
            {updateTicket.isPending ? 'Processing...' : 'Confirm Payment'}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm mt-4">
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
            <div className={`font-bold ${netAmount < 0 ? 'text-orange-600' : 'text-primary'}`}>
              {netAmount < 0 ? '-' : ''}₹{Math.abs(netAmount).toLocaleString()}
            </div>
          </div>
        </div>

        <div className="border-t pt-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Payment Status:</span>
            {isRefunded ? (
              <div className="flex items-center gap-2 text-orange-600">
                <CheckCircle className="h-4 w-4" />
                <div>
                  <div className="font-medium">Refunded</div>
                </div>
              </div>
            ) : ticket.is_paid ? (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-4 w-4" />
                <div className="font-medium">Paid / Confirmed</div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-orange-500">
                <Clock className="h-4 w-4" />
                <div className="font-medium">Pending Confirmation</div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
