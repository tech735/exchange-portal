import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { 
  Calculator, 
  IndianRupee, 
  Plus, 
  Minus, 
  CheckCircle,
  Package,
  ArrowLeft
} from 'lucide-react';
import { type TicketItem } from '@/types/database';
import { useNavigate } from 'react-router-dom';
import { useUpdateTicket } from '@/hooks/useTickets';
import { useToast } from '@/hooks/use-toast';
import { useProductPrices } from '@/hooks/useProductPrices';

interface ExchangeCalculatorProps {
  ticket?: {
    id: string;
    return_items: TicketItem[];
    exchange_items: TicketItem[];
  };
}

export function ExchangeCalculator({ ticket }: ExchangeCalculatorProps) {
  const [deliveryCharge, setDeliveryCharge] = useState(150);
  const [isProcessed, setIsProcessed] = useState(false);
  const navigate = useNavigate();
  const updateTicket = useUpdateTicket();
  const { toast } = useToast();
  const { data: productPrices } = useProductPrices();

  // Calculate total value for items using actual prices
  const calculateItemValue = (items: TicketItem[]): number => {
    return items.reduce((total, item) => {
      const itemPrice = productPrices?.[item.sku] || 1000; // Fallback to 1000 if price not found
      return total + (itemPrice * item.qty);
    }, 0);
  };

  const returnItemsValue = calculateItemValue(ticket?.return_items || []);
  const exchangeItemsValue = calculateItemValue(ticket?.exchange_items || []);
  // Exchange value = exchange items value - return items value + delivery charge
  const totalExchangeValue = Math.max(0, exchangeItemsValue - returnItemsValue + deliveryCharge);

  const handleProcessExchange = async () => {
    if (!ticket?.id) return;
    
    try {
      // Update ticket status and move to warehouse
      await updateTicket.mutateAsync({
        id: ticket.id,
        stage: 'WAREHOUSE_PENDING',
        status: 'IN_PROCESS',
        exchange_completed_at: new Date().toISOString(),
        sent_to_invoicing_at: new Date().toISOString(),
        eventType: 'SENT_TO_INVOICE'
      });
      
      setIsProcessed(true);
      toast({ 
        title: totalExchangeValue === 0 ? 'Refund sent to invoicing team' : 'Amount Collected', 
        description: 'Ticket moved to warehouse for processing' 
      });
      
      // Automatically navigate to warehouse page
      setTimeout(() => {
        navigate('/warehouse');
      }, 1500);
      
    } catch (error) {
      toast({ 
        title: 'Error', 
        description: 'Failed to process exchange',
        variant: 'destructive'
      });
    }
  };

  const handleDeliveryChargeChange = (value: number) => {
    setDeliveryCharge(value);
  };

  if (!ticket) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            Select a ticket to calculate exchange amount
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Exchange Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Exchange Calculation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Return Items */}
          <div>
            <Label className="text-sm font-medium">Return Items (Deduction)</Label>
            <div className="mt-2 space-y-2">
              {ticket.return_items.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/20 rounded">
                  <div className="flex items-center gap-3">
                    <Package className="h-4 w-4 text-red-600" />
                    <div>
                      <div className="font-medium">{item.product_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {item.sku} • {item.size} • Qty: {item.qty}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm font-medium text-red-600">
                    -₹{((productPrices?.[item.sku] || 1000) * item.qty).toLocaleString()}
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between p-3 bg-red-100 dark:bg-red-950/30 rounded font-medium">
                <span>Total Return Value:</span>
                <span className="text-red-600">-₹{returnItemsValue.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Exchange Items */}
          <div>
            <Label className="text-sm font-medium">Exchange Items (Addition)</Label>
            <div className="mt-2 space-y-2">
              {ticket.exchange_items.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/20 rounded">
                  <div className="flex items-center gap-3">
                    <Package className="h-4 w-4 text-green-600" />
                    <div>
                      <div className="font-medium">{item.product_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {item.sku} • {item.size} • Qty: {item.qty}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm font-medium text-green-600">
                    +₹{((productPrices?.[item.sku] || 1000) * item.qty).toLocaleString()}
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between p-3 bg-green-100 dark:bg-green-950/30 rounded font-medium">
                <span>Total Exchange Value:</span>
                <span className="text-green-600">+₹{exchangeItemsValue.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Calculation Summary */}
          <div className="border-t pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-medium">Exchange Items Value:</span>
              <span className="font-bold text-green-600">+₹{exchangeItemsValue.toLocaleString()}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="font-medium">Return Items Value:</span>
              <span className="font-bold text-red-600">-₹{returnItemsValue.toLocaleString()}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="font-medium">Delivery Charge:</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeliveryChargeChange(deliveryCharge - 50)}
                  disabled={deliveryCharge <= 0}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="font-bold">₹{deliveryCharge.toLocaleString()}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeliveryChargeChange(deliveryCharge + 50)}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between text-lg font-bold border-t pt-3">
              {totalExchangeValue === 0 ? (
                <>
                  <span>Refund Amount:</span>
                  <span className="text-orange-600">₹{(returnItemsValue - exchangeItemsValue - deliveryCharge).toLocaleString()}</span>
                </>
              ) : (
                <>
                  <span>Final Amount to Collect:</span>
                  <span className="text-primary">₹{totalExchangeValue.toLocaleString()}</span>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <Card>
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            {totalExchangeValue === 0 ? (
              <>
                <div className="text-lg font-medium">
                  Refund Amount: <span className="text-orange-600 font-bold">₹{(returnItemsValue - exchangeItemsValue - deliveryCharge).toLocaleString()}</span>
                </div>
                {isProcessed ? (
                  <div className="flex items-center justify-center gap-2 text-green-600">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">Refund Processed - Sent to Warehouse</span>
                  </div>
                ) : (
                  <Button 
                    onClick={handleProcessExchange}
                    className="w-full"
                    size="lg"
                    variant="outline"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Process Refund
                  </Button>
                )}
              </>
            ) : (
              <>
                <div className="text-lg font-medium">
                  Amount to be collected: <span className="text-primary font-bold">₹{totalExchangeValue.toLocaleString()}</span>
                </div>
                {isProcessed ? (
                  <div className="flex items-center justify-center gap-2 text-green-600">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">Amount Collected - Sent to Warehouse</span>
                  </div>
                ) : (
                  <Button 
                    onClick={handleProcessExchange}
                    className="w-full"
                    size="lg"
                  >
                    <IndianRupee className="h-4 w-4 mr-2" />
                    Mark as Collected
                  </Button>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
