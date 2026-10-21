import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { LOOKBACK_LABELS } from './constants';

// How far back the tracker loads; open shipments always show regardless.
export function LookbackSelect({
  value,
  onChange,
  className,
}: {
  value: number | null;
  onChange: (days: number | null) => void;
  className?: string;
}) {
  return (
    <Select value={value === null ? 'all' : String(value)} onValueChange={(v) => onChange(v === 'all' ? null : Number(v))}>
      <SelectTrigger className={cn(className)} aria-label="Period">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(LOOKBACK_LABELS).map(([v, label]) => (
          <SelectItem key={v} value={v}>{label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
