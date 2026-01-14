import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EVENT_LABELS } from '@/types/database';
import { format } from 'date-fns';

interface AuditLogProps {
  events?: any[];
}

export function AuditLog({ events }: AuditLogProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit Log</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {events?.map((event) => (
            <div key={event.id} className="text-sm border-l-2 border-muted pl-3">
              <p className="font-medium">{EVENT_LABELS[event.event_type as keyof typeof EVENT_LABELS] || event.event_type}</p>
              <p className="text-xs text-muted-foreground">{format(new Date(event.event_at), 'MMM d, HH:mm')}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
