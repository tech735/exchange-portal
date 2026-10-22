import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toDateInput } from '@/lib/shipmentTracking';
import { DEFAULT_LOOKBACK_DAYS, LOOKBACK_LABELS } from './constants';

/** What period the tracker shows: a rolling window, or an exact from–to range. */
export type Period = { kind: 'days'; days: number | null } | { kind: 'range'; from: string; to: string };

export const DEFAULT_PERIOD: Period = { kind: 'days', days: DEFAULT_LOOKBACK_DAYS };

export function isDefaultPeriod(p: Period) {
  return p.kind === 'days' && p.days === DEFAULT_LOOKBACK_DAYS;
}

export function periodLabel(p: Period) {
  if (p.kind === 'range') {
    const f = parseISO(p.from), t = parseISO(p.to);
    return p.from === p.to ? format(f, 'd MMM yyyy') : `${format(f, 'd MMM')} – ${format(t, 'd MMM yyyy')}`;
  }
  return LOOKBACK_LABELS[p.days === null ? 'all' : String(p.days)] ?? `Last ${p.days} days`;
}

/** Days to load from the server so the period is covered (null = everything). */
export function periodLoadDays(p: Period, today = new Date()): number | null {
  if (p.kind === 'days') return p.days;
  return Math.max(1, differenceInCalendarDays(today, parseISO(p.from)) + 1);
}

/** For a custom range, keep only rows ordered / raised inside it. */
export function inPeriod(p: Period, s: { order_date: string; raised_date: string | null }) {
  if (p.kind !== 'range') return true;
  const d = s.raised_date ?? s.order_date;
  return d >= p.from && d <= p.to;
}

export function periodSince(p: Period): string | null {
  if (p.kind === 'range') return p.from;
  return p.days === null ? null : toDateInput(new Date(Date.now() - p.days * 864e5));
}

// How far back the tracker loads; open shipments always show for rolling windows.
export function LookbackSelect({
  value,
  onChange,
  className,
}: {
  value: Period;
  onChange: (p: Period) => void;
  className?: string;
}) {
  const today = toDateInput(new Date());
  const selectValue = value.kind === 'range' ? 'custom' : value.days === null ? 'all' : String(value.days);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={selectValue}
        onValueChange={(v) => {
          if (v === 'custom') onChange({ kind: 'range', from: toDateInput(new Date(Date.now() - 6 * 864e5)), to: today });
          else onChange({ kind: 'days', days: v === 'all' ? null : Number(v) });
        }}
      >
        <SelectTrigger className={cn(className)} aria-label="Period">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(LOOKBACK_LABELS).map(([v, label]) => (
            <SelectItem key={v} value={v}>{label}</SelectItem>
          ))}
          <SelectItem value="custom">Custom range…</SelectItem>
        </SelectContent>
      </Select>
      {value.kind === 'range' && (
        <div className="flex items-center gap-1.5 animate-fade-in">
          <Input type="date" aria-label="From" className="h-9 w-[140px]" value={value.from} max={value.to}
            onChange={(e) => e.target.value && onChange({ ...value, from: e.target.value })} />
          <span className="text-xs text-muted-foreground">to</span>
          <Input type="date" aria-label="To" className="h-9 w-[140px]" value={value.to} min={value.from} max={today}
            onChange={(e) => e.target.value && onChange({ ...value, to: e.target.value })} />
        </div>
      )}
    </div>
  );
}
