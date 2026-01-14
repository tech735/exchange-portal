import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { STAGE_LABELS, type Ticket } from '@/types/database';
import { format } from 'date-fns';

interface InvoicingTableProps {
  tickets?: Ticket[];
  isLoading?: boolean;
  onInvoiceDone: (id: string) => Promise<void>;
  onClose: (id: string) => Promise<void>;
}

export function InvoicingTable({ tickets, isLoading, onInvoiceDone, onClose }: InvoicingTableProps) {
  return (
    <Card>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left py-3 px-4 font-medium">Order ID</th>
              <th className="text-left py-3 px-4 font-medium">Customer</th>
              <th className="text-left py-3 px-4 font-medium">Exchange Completed</th>
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
                  <td className="py-3 px-4 text-muted-foreground">
                    {ticket.exchange_completed_at ? format(new Date(ticket.exchange_completed_at), 'MMM d, HH:mm') : '-'}
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant="outline">{STAGE_LABELS[ticket.stage]}</Badge>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2">
                      {['EXCHANGE_COMPLETED', 'INVOICING_PENDING'].includes(ticket.stage) && (
                        <Button size="sm" onClick={() => onInvoiceDone(ticket.id)}>
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Invoice Done
                        </Button>
                      )}
                      {ticket.stage === 'INVOICED' && (
                        <Button size="sm" variant="outline" onClick={() => onClose(ticket.id)}>
                          Close Ticket
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
