import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { REASON_LABELS, STAGE_LABELS, type Ticket } from '@/types/database';
import { format } from 'date-fns';

interface TicketsTableProps {
  tickets?: Ticket[];
  isLoading?: boolean;
}

export function TicketsTable({ tickets, isLoading }: TicketsTableProps) {
  return (
    <Card>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left py-3 px-4 font-medium">Order ID</th>
              <th className="text-left py-3 px-4 font-medium">Customer</th>
              <th className="text-left py-3 px-4 font-medium">Reason</th>
              <th className="text-left py-3 px-4 font-medium">Stage</th>
              <th className="text-left py-3 px-4 font-medium">Created</th>
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
                  <td className="py-3 px-4">
                    <div>{ticket.customer_name}</div>
                    <div className="text-xs text-muted-foreground">{ticket.customer_phone}</div>
                  </td>
                  <td className="py-3 px-4">{REASON_LABELS[ticket.reason_code]}</td>
                  <td className="py-3 px-4">
                    <Badge variant="outline">{STAGE_LABELS[ticket.stage]}</Badge>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">{format(new Date(ticket.created_at), 'MMM d, HH:mm')}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
