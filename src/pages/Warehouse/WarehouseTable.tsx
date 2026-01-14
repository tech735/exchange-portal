import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, Check, Package, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { STAGE_LABELS, type Ticket } from '@/types/database';

interface WarehouseTableProps {
  tickets?: Ticket[];
  isLoading?: boolean;
  onReceive: (id: string) => Promise<void>;
  onApprove: (id: string) => Promise<void>;
  onDeny: (id: string) => Promise<void>;
  onExchangeComplete: (id: string) => Promise<void>;
  onSendToInvoicing: (id: string) => Promise<void>;
}

export function WarehouseTable({
  tickets,
  isLoading,
  onReceive,
  onApprove,
  onDeny,
  onExchangeComplete,
  onSendToInvoicing,
}: WarehouseTableProps) {
  return (
    <Card>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left py-3 px-4 font-medium">Order ID</th>
              <th className="text-left py-3 px-4 font-medium">Customer</th>
              <th className="text-left py-3 px-4 font-medium">Items</th>
              <th className="text-left py-3 px-4 font-medium">Stage</th>
              <th className="text-left py-3 px-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tickets?.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-muted-foreground">
                  No tickets found
                </td>
              </tr>
            ) : (
              tickets?.map((ticket) => (
                <tr key={ticket.id} className="data-table-row">
                  <td className="py-3 px-4">
                    <Link to={`/ticket/${ticket.id}`} className="text-primary hover:underline font-medium">
                      {ticket.order_id}
                    </Link>
                    {ticket.sla_breached && (
                      <span className="sla-breach-badge ml-2">
                        <AlertTriangle className="h-3 w-3" />
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4">{ticket.customer_name}</td>
                  <td className="py-3 px-4">
                    {ticket.return_items.length} return / {ticket.exchange_items.length} exchange
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant="outline">{STAGE_LABELS[ticket.stage]}</Badge>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2">
                      {ticket.stage === 'LODGED' && (
                        <Button size="sm" variant="outline" onClick={() => onReceive(ticket.id)}>
                          <Package className="h-4 w-4 mr-1" />
                          Receive
                        </Button>
                      )}
                      {ticket.stage === 'WAREHOUSE_PENDING' && (
                        <>
                          <Button size="sm" variant="default" onClick={() => onApprove(ticket.id)}>
                            <Check className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => onDeny(ticket.id)}>
                            <X className="h-4 w-4 mr-1" />
                            Deny
                          </Button>
                        </>
                      )}
                      {ticket.stage === 'WAREHOUSE_APPROVED' && (
                        <Button size="sm" onClick={() => onExchangeComplete(ticket.id)}>
                          Exchange Done
                        </Button>
                      )}
                      {ticket.stage === 'EXCHANGE_COMPLETED' && (
                        <Button size="sm" variant="outline" onClick={() => onSendToInvoicing(ticket.id)}>
                          Send to Invoicing
                        </Button>
                      )}
                      {ticket.stage === 'INVOICING_PENDING' && (
                        <Button size="sm" variant="secondary" disabled>
                          Sent to Invoicing
                        </Button>
                      )}
                      {ticket.stage === 'INVOICED' && (
                        <Button size="sm" variant="secondary" disabled>
                          Invoiced
                        </Button>
                      )}
                      {ticket.stage === 'CLOSED' && (
                        <Button size="sm" variant="secondary" disabled>
                          Closed
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
