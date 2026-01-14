import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { type Ticket } from '@/types/database';
import { REASON_LABELS } from '@/types/database';

interface ExchangeDetailsProps {
  ticket: Ticket;
}

export function ExchangeDetails({ ticket }: ExchangeDetailsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Exchange Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <span className="text-sm text-muted-foreground">Reason:</span>{' '}
          <span className="font-medium">{REASON_LABELS[ticket.reason_code]}</span>
        </div>
        {ticket.reason_notes && (
          <div>
            <span className="text-sm text-muted-foreground">Notes:</span> <p>{ticket.reason_notes}</p>
          </div>
        )}
        {ticket.student_name && (
          <div>
            <span className="text-sm text-muted-foreground">Student:</span> {ticket.student_name}{' '}
            {ticket.student_grade && `(${ticket.student_grade}`}
            {ticket.student_section && `-${ticket.student_section})`}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
