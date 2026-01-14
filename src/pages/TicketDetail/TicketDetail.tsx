import { useParams, Link } from 'react-router-dom';
import Layout from '@/components/Layout';
import { useTicket, useTicketEvents } from '@/hooks/useTickets';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { STAGE_LABELS, STATUS_LABELS } from '@/types/database';
import { ExchangeDetails } from './ExchangeDetails';
import { ItemsDisplay } from './ItemsDisplay';
import { Timeline } from './Timeline';
import { AuditLog } from './AuditLog';

export default function TicketDetail() {
  const { id } = useParams();
  const { data: ticket, isLoading } = useTicket(id);
  const { data: events } = useTicketEvents(id);

  if (!ticket) return <Layout><div className="p-8">Ticket not found</div></Layout>;

  return (
    <Layout>
      <div className="p-8 animate-fade-in">
        <Link to="/exchange-lodging" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to tickets
        </Link>

        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              Order {ticket.order_id}
              {ticket.sla_breached && (
                <span className="sla-breach-badge">
                  <AlertTriangle className="h-4 w-4" /> SLA Breach
                </span>
              )}
            </h1>
            <p className="text-muted-foreground mt-1">
              {ticket.customer_name} • {ticket.customer_phone}
            </p>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline" className="text-base px-4 py-1">
              {STAGE_LABELS[ticket.stage]}
            </Badge>
            <Badge className={`status-${ticket.status.toLowerCase().replace('_', '-')} text-base px-4 py-1`}>
              {STATUS_LABELS[ticket.status]}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <ExchangeDetails ticket={ticket} />

            <div className="grid grid-cols-2 gap-6">
              <ItemsDisplay title="Return Items" items={ticket.return_items} />
              <ItemsDisplay title="Exchange Items" items={ticket.exchange_items} />
            </div>
          </div>

          <div className="space-y-6">
            <Timeline ticket={ticket} />
            <AuditLog events={events} />
          </div>
        </div>
      </div>
    </Layout>
  );
}
