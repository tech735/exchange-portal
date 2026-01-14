import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { STAGE_LABELS, STATUS_LABELS, type Ticket } from '@/types/database';
import { format } from 'date-fns';

interface RecentTicklesTableProps {
  tickets?: Ticket[];
}

export function RecentTicketsTable({ tickets }: RecentTicklesTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Tickets</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4 font-medium">Order ID</th>
                <th className="text-left py-3 px-4 font-medium">Customer</th>
                <th className="text-left py-3 px-4 font-medium">Stage</th>
                <th className="text-left py-3 px-4 font-medium">Status</th>
                <th className="text-left py-3 px-4 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {tickets?.slice(0, 10).map((ticket) => (
                <tr key={ticket.id} className="data-table-row">
                  <td className="py-3 px-4">
                    <Link to={`/ticket/${ticket.id}`} className="text-primary hover:underline font-medium">
                      {ticket.order_id}
                    </Link>
                  </td>
                  <td className="py-3 px-4">{ticket.customer_name}</td>
                  <td className="py-3 px-4">
                    <Badge variant="outline">{STAGE_LABELS[ticket.stage]}</Badge>
                    {ticket.sla_breached && <span className="sla-breach-badge ml-2"><AlertTriangle className="h-3 w-3" /> SLA</span>}
                  </td>
                  <td className="py-3 px-4">
                    <Badge className={`status-${ticket.status.toLowerCase().replace('_', '-')}`}>{STATUS_LABELS[ticket.status]}</Badge>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">{format(new Date(ticket.created_at), 'MMM d, yyyy')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
