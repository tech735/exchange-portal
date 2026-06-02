import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EVENT_LABELS, STAGE_LABELS, TicketEvent } from '@/types/database';
import { format } from 'date-fns';

interface AuditLogProps {
  events?: TicketEvent[];
}

const EVENT_COLORS: Record<string, string> = {
  CREATED: 'bg-blue-500',
  UPDATED: 'bg-yellow-500',
  RECEIVED: 'bg-purple-500',
  APPROVED: 'bg-green-500',
  DENIED: 'bg-red-500',
  EXCHANGE_DONE: 'bg-green-600',
  SENT_TO_INVOICE: 'bg-indigo-500',
  INVOICED: 'bg-indigo-600',
  REFUND_SENT: 'bg-orange-500',
  ESCALATED: 'bg-red-600',
  CLOSED: 'bg-gray-500',
};

function getPayloadDetail(event: TicketEvent): string | null {
  const p = event.event_payload;
  if (!p) return null;

  if (event.event_type === 'CREATED') {
    return p.reason_code ? `Reason: ${String(p.reason_code).replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}` : null;
  }

  const parts: string[] = [];
  if (p.stage) {
    parts.push(`→ ${STAGE_LABELS[p.stage as keyof typeof STAGE_LABELS] ?? p.stage}`);
  }
  if (Array.isArray(p.updated_fields) && p.updated_fields.length > 0) {
    const fields = (p.updated_fields as string[])
      .filter(f => f !== 'stage' && f !== 'updated_at')
      .map(f => f.replace(/_/g, ' '))
      .slice(0, 4);
    if (fields.length > 0) parts.push(fields.join(', '));
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}

export function AuditLog({ events }: AuditLogProps) {
  return (
    <Card>
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="text-base sm:text-lg">Audit Log</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0 sm:px-6 sm:pb-6">
        {!events || events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events recorded.</p>
        ) : (
          <div className="relative space-y-0 max-h-72 overflow-y-auto pr-1">
            {events.map((event, i) => {
              const detail = getPayloadDetail(event);
              const isLast = i === events.length - 1;
              return (
                <div key={event.id} className="flex gap-3">
                  <div className="flex flex-col items-center shrink-0">
                    <div className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${EVENT_COLORS[event.event_type] ?? 'bg-muted-foreground'}`} />
                    {!isLast && <div className="w-px flex-1 bg-border mt-1" />}
                  </div>
                  <div className={`pb-4 ${isLast ? 'pb-0' : ''}`}>
                    <p className="text-sm font-medium leading-tight">
                      {EVENT_LABELS[event.event_type as keyof typeof EVENT_LABELS] ?? event.event_type}
                    </p>
                    {detail && <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>}
                    <p className="text-xs text-muted-foreground/70 mt-0.5">
                      {format(new Date(event.event_at), 'MMM d, yyyy · HH:mm')}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
