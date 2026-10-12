import { useState } from 'react';
import { Link } from 'react-router-dom';
import { differenceInCalendarDays, formatDistanceToNow, parseISO } from 'date-fns';
import { ChevronRight, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useSpecialCases } from '@/hooks/useShipments';
import { useTickets } from '@/hooks/useTickets';
import { formatDay, type TrackedShipment } from '@/lib/shipmentTracking';
import { cn } from '@/lib/utils';
import { SPECIAL_CASE_TYPE_LABELS, STAGE_LABELS, type SpecialCase } from '@/types/database';
import { SpecialCaseSheet } from './SpecialCaseSheet';

// The team's own case log (the old sheet's Special Cases tab), opened and
// edited in a side panel.
function CaseLog() {
  const { data: cases = [], isLoading } = useSpecialCases();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<SpecialCase | null>(null);
  const openCount = cases.filter((c) => c.status === 'OPEN').length;

  const openSheet = (specialCase: SpecialCase | null) => {
    setEditing(specialCase);
    setSheetOpen(true);
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Case log ({openCount} open)</h2>
        <Button size="sm" className="gap-1.5" onClick={() => openSheet(null)}>
          <Plus className="h-4 w-4" />
          Log a case
        </Button>
      </div>
      <Card className="border shadow-card divide-y divide-border">
        {isLoading ? (
          <div className="flex justify-center py-10"><div className="loader" /></div>
        ) : cases.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No cases yet. Log any order that needs special handling and update it as it progresses.
          </p>
        ) : (
          cases.map((c) => {
            const resolved = c.status === 'RESOLVED';
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => openSheet(c)}
                className={cn('w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted/50', resolved && 'bg-success/5')}
              >
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{c.order_name}</span>
                    <Badge variant="secondary">{SPECIAL_CASE_TYPE_LABELS[c.case_type]}</Badge>
                    {resolved ? (
                      <Badge variant="success">Resolved{c.resolved_on ? ` ${formatDay(c.resolved_on)}` : ''}</Badge>
                    ) : (
                      <Badge variant="destructive">Open</Badge>
                    )}
                    {c.awb_number && <span className="text-xs text-muted-foreground">AWB {c.awb_number}</span>}
                  </div>
                  <p className="text-sm truncate">{c.issue}</p>
                  {(c.latest_update || c.action_taken) && (
                    <p className="text-sm text-muted-foreground truncate">{c.latest_update || c.action_taken}</p>
                  )}
                </div>
                <span className="hidden sm:block text-xs text-muted-foreground whitespace-nowrap">
                  {formatDistanceToNow(parseISO(c.updated_at), { addSuffix: true })}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
              </button>
            );
          })
        )}
      </Card>

      <SpecialCaseSheet open={sheetOpen} specialCase={editing} onOpenChange={setSheetOpen} />
    </section>
  );
}

// RTO parcels stay here until a resolved date is set on the shipment;
// exchange / return tickets until their own workflow completes them.
export function SpecialCases({
  rtoShipments,
  onOpenShipment,
}: {
  rtoShipments: TrackedShipment[];
  onOpenShipment: (id: string) => void;
}) {
  const { data: tickets = [], isLoading } = useTickets({ status: ['NEW', 'IN_PROCESS', 'ESCALATED'] });
  const openRto = rtoShipments.filter((s) => !s.resolved_on);
  const resolvedRto = rtoShipments.filter((s) => s.resolved_on);

  const ageDays = (iso: string) => differenceInCalendarDays(new Date(), parseISO(iso));

  return (
    <div className="space-y-8">
      <CaseLog />

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold">RTO ({openRto.length} open)</h2>
          <span className="text-xs text-muted-foreground">Set a resolved date on the shipment to close a case</span>
        </div>
        <Card className="border shadow-card divide-y divide-border">
          {rtoShipments.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No RTO shipments.</p>
          ) : (
            [...openRto, ...resolvedRto].map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onOpenShipment(s.id)}
                className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted/50"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{s.shipment_ref}</span>
                    {s.resolved_on ? (
                      <Badge variant="success">Resolved {formatDay(s.resolved_on)}</Badge>
                    ) : (
                      <Badge variant="destructive">Open</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {s.customer_name || '—'} · {s.city || '—'} · {s.courier || '—'} {s.awb_number || ''}
                    {s.resolution ? ` · ${s.resolution}` : ''}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
              </button>
            ))
          )}
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Open exchanges &amp; returns ({tickets.length})</h2>
        <Card className="border shadow-card divide-y divide-border">
          {isLoading ? (
            <div className="flex justify-center py-10"><div className="loader" /></div>
          ) : tickets.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No open exchange or return tickets.</p>
          ) : (
            tickets.map((t) => (
              <Link key={t.id} to={`/ticket/${t.id}`} className="px-4 py-3 flex items-center gap-3 hover:bg-muted/50">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{t.order_id}</span>
                    <Badge variant="secondary">{STAGE_LABELS[t.stage] ?? t.stage}</Badge>
                    {t.sla_breached && <Badge variant="destructive">SLA breached</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {t.customer_name} · open {ageDays(t.created_at)} day(s)
                    {t.return_awb ? ` · Return AWB ${t.return_awb}` : ''}
                    {t.exchange_awb ? ` · Exchange AWB ${t.exchange_awb}` : ''}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
              </Link>
            ))
          )}
        </Card>
      </section>
    </div>
  );
}
