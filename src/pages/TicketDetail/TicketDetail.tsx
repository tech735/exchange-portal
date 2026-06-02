import { useParams, Link, useLocation } from 'react-router-dom';
import Layout from '@/components/Layout';
import { useTicket, useTicketEvents } from '@/hooks/useTickets';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { STAGE_LABELS, STATUS_LABELS } from '@/types/database';
import { ExchangeDetails } from './ExchangeDetails';
import { ItemsDisplay } from './ItemsDisplay';
import { PaymentSummary } from './PaymentSummary';
import { Timeline } from './Timeline';
import { AuditLog } from './AuditLog';

const BACK_LABELS: Record<string, string> = {
  '/warehouse': 'Warehouse',
  '/exchange-lodging': 'Exchange Lodging',
};

export default function TicketDetail() {
  const { id } = useParams();
  const location = useLocation();
  const { data: ticket, isLoading } = useTicket(id);
  const { data: events } = useTicketEvents(id);

  const fromPath = (location.state as { from?: string } | null)?.from ?? '/exchange-lodging';
  const backLabel = BACK_LABELS[fromPath] ?? 'Back';

  if (!ticket) return <Layout><div className="page-shell">Ticket not found</div></Layout>;

  return (
    <Layout>
      <div className="page-shell animate-fade-in">
        <Link to={fromPath} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mt-3 mb-3">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to {backLabel}
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold flex flex-wrap items-center gap-2">
              Order {ticket.order_id}
              {ticket.sla_breached && (
                <span className="sla-breach-badge">
                  <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4" /> SLA Breach
                </span>
              )}
            </h1>
            <p className="text-sm text-muted-foreground mt-1 break-words">
              {ticket.customer_name}
              <span className="mx-1 text-muted-foreground/40">•</span>
              {ticket.customer_phone}
              {ticket.customer_email && (
                <>
                  <span className="mx-1 text-muted-foreground/40 hidden sm:inline">•</span>
                  <span className="block sm:inline text-xs sm:text-sm">{ticket.customer_email}</span>
                </>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5 shrink-0">
            <Badge variant="outline" className="text-xs sm:text-sm px-2 sm:px-3 py-0.5">
              {STAGE_LABELS[ticket.stage]}
            </Badge>
            <Badge className={`status-${ticket.status.toLowerCase().replace('_', '-')} text-xs sm:text-sm px-2 sm:px-3 py-0.5`}>
              {STATUS_LABELS[ticket.status]}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            <ExchangeDetails ticket={ticket} />
            <PaymentSummary ticket={ticket} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <ItemsDisplay title="Return Items" items={ticket.return_items} />
              <ItemsDisplay title="Exchange Items" items={ticket.exchange_items} />
            </div>
          </div>

          <div className="space-y-4 sm:space-y-6">
            <Timeline ticket={ticket} />
            <AuditLog events={events} />
          </div>
        </div>
      </div>
    </Layout>
  );
}
