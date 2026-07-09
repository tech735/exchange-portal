import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { useTickets } from '@/hooks/useTickets';
import { STAGE_LABELS } from '@/types/database';
import { format } from 'date-fns';

export function SlaBreachedTable() {
  const { data: breachedTickets } = useTickets({ sla_breached: true });

  return (
    <Card>
      <CardHeader>
        <CardTitle>SLA Breached Tickets</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="max-h-[300px] overflow-y-auto overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[500px] text-sm">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b">
                <th className="text-left py-3 px-2 sm:px-4 font-medium whitespace-nowrap">Order ID</th>
                <th className="text-left py-3 px-2 sm:px-4 font-medium">Customer</th>
                <th className="text-left py-3 px-2 sm:px-4 font-medium">Stage</th>
                <th className="text-left py-3 px-2 sm:px-4 font-medium whitespace-nowrap">Breached At</th>
              </tr>
            </thead>
            <tbody>
              {(!breachedTickets || breachedTickets.length === 0) && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-muted-foreground">
                    No tickets have breached SLA
                  </td>
                </tr>
              )}
              {breachedTickets?.map((ticket) => (
                <tr key={ticket.id} className="data-table-row">
                  <td className="py-3 px-2 sm:px-4 whitespace-nowrap">
                    <Link to={`/ticket/${ticket.id}`} className="text-primary hover:underline font-medium text-sm sm:text-base">
                      {ticket.order_id}
                    </Link>
                  </td>
                  <td className="py-3 px-2 sm:px-4">
                    <div className="max-w-[120px] sm:max-w-none truncate">
                      {ticket.customer_name}
                    </div>
                  </td>
                  <td className="py-3 px-2 sm:px-4">
                    <Badge variant="outline" className="text-xs">{STAGE_LABELS[ticket.stage]}</Badge>
                  </td>
                  <td className="py-3 px-2 sm:px-4 text-muted-foreground whitespace-nowrap text-xs sm:text-sm">
                    {ticket.sla_breached_at ? format(new Date(ticket.sla_breached_at), 'MMM d, yyyy') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
