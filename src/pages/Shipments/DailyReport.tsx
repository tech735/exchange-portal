import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDay, type DailyReportRow } from '@/lib/shipmentTracking';
import { cn } from '@/lib/utils';

export function DailyReport({ rows }: { rows: DailyReportRow[] }) {
  if (rows.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No orders in this period.</p>;
  }

  const totals = rows.reduce(
    (t, r) => ({
      placed: t.placed + r.placed,
      pickedUp: t.pickedUp + r.pickedUp,
      pickedUpLate: t.pickedUpLate + r.pickedUpLate,
      delivered: t.delivered + r.delivered,
      deliveredLate: t.deliveredLate + r.deliveredLate,
    }),
    { placed: 0, pickedUp: 0, pickedUpLate: 0, delivered: 0, deliveredLate: 0 }
  );

  const late = (n: number) => (n ? <span className="text-destructive"> ({n} late)</span> : null);

  return (
    <Card className="border shadow-card overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Placed</TableHead>
            <TableHead className="text-right">Picked up</TableHead>
            <TableHead className="text-right">Delivered</TableHead>
            <TableHead className="text-right hidden sm:table-cell">On-time</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.date}>
              <TableCell className="whitespace-nowrap font-medium">{formatDay(r.date, 'EEE, dd MMM')}</TableCell>
              <TableCell className="text-right">{r.placed}</TableCell>
              <TableCell className="text-right whitespace-nowrap">{r.pickedUp}{late(r.pickedUpLate)}</TableCell>
              <TableCell className="text-right whitespace-nowrap">{r.delivered}{late(r.deliveredLate)}</TableCell>
              <TableCell className={cn('text-right hidden sm:table-cell', r.deliveredLate && 'text-warning')}>
                {r.delivered ? `${Math.round((r.deliveredOnTime / r.delivered) * 100)}%` : '—'}
              </TableCell>
            </TableRow>
          ))}
          <TableRow className="bg-muted/30 font-semibold">
            <TableCell>Total</TableCell>
            <TableCell className="text-right">{totals.placed}</TableCell>
            <TableCell className="text-right whitespace-nowrap">{totals.pickedUp}{late(totals.pickedUpLate)}</TableCell>
            <TableCell className="text-right whitespace-nowrap">{totals.delivered}{late(totals.deliveredLate)}</TableCell>
            <TableCell className="text-right hidden sm:table-cell">
              {totals.delivered ? `${Math.round(((totals.delivered - totals.deliveredLate) / totals.delivered) * 100)}%` : '—'}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </Card>
  );
}
