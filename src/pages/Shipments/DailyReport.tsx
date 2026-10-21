import { AlertTriangle, CalendarDays } from 'lucide-react';
import { EmptyState, RowSkeleton } from '@/components/app';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDay, type DailyReportRow } from '@/lib/shipmentTracking';
import { cn } from '@/lib/utils';

const onTime = (delivered: number, late: number) =>
  delivered ? `${Math.round(((delivered - late) / delivered) * 100)}%` : '—';

function Late({ n }: { n: number }) {
  return n ? <span className="ml-1 text-xs font-medium text-destructive">({n} late)</span> : null;
}

export function DailyReport({
  rows,
  isLoading,
  isError,
  onRetry,
}: {
  rows: DailyReportRow[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const totals = rows.reduce(
    (t, r) => ({
      placed: t.placed + r.placed,
      pickedUp: t.pickedUp + r.pickedUp,
      pickedUpLate: t.pickedUpLate + r.pickedUpLate,
      delivered: t.delivered + r.delivered,
      deliveredLate: t.deliveredLate + r.deliveredLate,
      returns: t.returns + r.returns,
    }),
    { placed: 0, pickedUp: 0, pickedUpLate: 0, delivered: 0, deliveredLate: 0, returns: 0 }
  );

  if (isError) {
    return (
      <div className="rounded-xl border border-border bg-card">
        <EmptyState
          icon={AlertTriangle}
          title="Couldn't load the report"
          description="Check your connection and try again."
          action={<Button variant="secondary" size="sm" onClick={onRetry}>Try again</Button>}
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <RowSkeleton rows={7} />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card">
        <EmptyState icon={CalendarDays} title="No orders in this period" description="Pick a longer period to see more days." />
      </div>
    );
  }

  return (
    <>
      {/* Phone: one card per day */}
      <div className="md:hidden overflow-hidden rounded-xl border border-border bg-card">
        <ul className="divide-y divide-border">
          {rows.map((r) => (
            <li key={r.date} className="px-4 py-3">
              <p className="text-sm font-medium text-foreground">{formatDay(r.date, 'EEE, dd MMM')}</p>
              <dl className="mt-2 grid grid-cols-4 gap-2 text-xs">
                <Stat label="Placed" value={r.placed} />
                <Stat label="Picked up" value={r.pickedUp} late={r.pickedUpLate} />
                <Stat label="Delivered" value={r.delivered} late={r.deliveredLate} />
                <Stat label="Returns" value={r.returns} />
              </dl>
            </li>
          ))}
        </ul>
        <div className="border-t border-border bg-muted/50 px-4 py-3">
          <p className="text-sm font-semibold text-foreground">
            Total · {onTime(totals.delivered, totals.deliveredLate)} on time
          </p>
          <dl className="mt-2 grid grid-cols-4 gap-2 text-xs">
            <Stat label="Placed" value={totals.placed} />
            <Stat label="Picked up" value={totals.pickedUp} late={totals.pickedUpLate} />
            <Stat label="Delivered" value={totals.delivered} late={totals.deliveredLate} />
            <Stat label="Returns" value={totals.returns} />
          </dl>
        </div>
      </div>

      {/* md+: table */}
      <div className="hidden md:block overflow-hidden rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Placed</TableHead>
              <TableHead className="text-right">Picked up</TableHead>
              <TableHead className="text-right">Delivered</TableHead>
              <TableHead className="text-right">On time</TableHead>
              <TableHead className="text-right">Returns</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.date}>
                <TableCell className="whitespace-nowrap font-medium text-foreground">{formatDay(r.date, 'EEE, dd MMM')}</TableCell>
                <TableCell className="text-right tabular">{r.placed}</TableCell>
                <TableCell className="whitespace-nowrap text-right tabular">{r.pickedUp}<Late n={r.pickedUpLate} /></TableCell>
                <TableCell className="whitespace-nowrap text-right tabular">{r.delivered}<Late n={r.deliveredLate} /></TableCell>
                <TableCell className={cn('text-right tabular', r.deliveredLate ? 'text-warning' : 'text-muted-foreground')}>
                  {onTime(r.delivered, r.deliveredLate)}
                </TableCell>
                <TableCell className="text-right tabular">{r.returns}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow className="hover:bg-transparent">
              <TableCell className="font-semibold">Total</TableCell>
              <TableCell className="text-right font-semibold tabular">{totals.placed}</TableCell>
              <TableCell className="whitespace-nowrap text-right font-semibold tabular">{totals.pickedUp}<Late n={totals.pickedUpLate} /></TableCell>
              <TableCell className="whitespace-nowrap text-right font-semibold tabular">{totals.delivered}<Late n={totals.deliveredLate} /></TableCell>
              <TableCell className="text-right font-semibold tabular">{onTime(totals.delivered, totals.deliveredLate)}</TableCell>
              <TableCell className="text-right font-semibold tabular">{totals.returns}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </>
  );
}

function Stat({ label, value, late }: { label: string; value: number; late?: number }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium text-foreground tabular">
        {value}
        {late ? <span className="ml-1 text-destructive">({late})</span> : null}
      </dd>
    </div>
  );
}
