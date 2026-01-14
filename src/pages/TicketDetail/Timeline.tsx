import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { type Ticket } from '@/types/database';
import { format } from 'date-fns';

interface TimelineProps {
  ticket: Ticket;
}

export function Timeline({ ticket }: TimelineProps) {
  const milestones = [
    { label: 'Created', date: ticket.created_at },
    { label: 'Lodged', date: ticket.lodged_at },
    { label: 'Warehouse Received', date: ticket.warehouse_received_at },
    { label: 'Approved', date: ticket.warehouse_approved_at },
    { label: 'Denied', date: ticket.warehouse_denied_at },
    { label: 'Exchange Completed', date: ticket.exchange_completed_at },
    { label: 'Sent to Invoicing', date: ticket.sent_to_invoicing_at },
    { label: 'Invoiced', date: ticket.invoicing_done_at },
    { label: 'Closed', date: ticket.closed_at },
  ].filter((m) => m.date);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {milestones.map((m, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <div className="flex-1">
                <p className="text-sm font-medium">{m.label}</p>
                <p className="text-xs text-muted-foreground">{format(new Date(m.date!), 'MMM d, yyyy HH:mm')}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
