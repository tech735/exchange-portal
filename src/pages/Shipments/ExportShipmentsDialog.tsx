import { useEffect, useState } from 'react';
import { endOfMonth, format, startOfMonth, subDays, subMonths } from 'date-fns';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { exportShipmentsToExcel, type ShipmentSheet } from '@/utils/exportUtils';
import { dailyReport, shipmentKind, summarizeShipments, toDateInput, type TrackedShipment } from '@/lib/shipmentTracking';
import { cn } from '@/lib/utils';

type Scope = 'view' | 'selected' | 'range';

const PRESETS: { label: string; range: () => [Date, Date] }[] = [
  { label: 'Today', range: () => [new Date(), new Date()] },
  { label: 'Yesterday', range: () => [subDays(new Date(), 1), subDays(new Date(), 1)] },
  { label: 'Last 7 days', range: () => [subDays(new Date(), 6), new Date()] },
  { label: 'This month', range: () => [startOfMonth(new Date()), new Date()] },
  { label: 'Last month', range: () => [startOfMonth(subMonths(new Date(), 1)), endOfMonth(subMonths(new Date(), 1))] },
];

function Choice({ on, onClick, disabled, title, hint }: { on: boolean; onClick: () => void; disabled?: boolean; title: string; hint: string }) {
  return (
    <button type="button" role="radio" aria-checked={on} disabled={disabled} onClick={onClick}
      className={cn('flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50',
        on ? 'border-primary bg-accent' : 'border-input hover:bg-muted')}>
      <span className={cn('mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border', on ? 'border-primary' : 'border-input')}>{on && <span className="size-2 rounded-full bg-primary" />}</span>
      <span><span className="block text-sm font-medium">{title}</span><span className="block text-xs text-muted-foreground">{hint}</span></span>
    </button>
  );
}

export function ExportShipmentsDialog({
  open,
  onOpenChange,
  variant,
  viewRows,
  selectedRows,
  today,
  loadRange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  variant: 'forward' | 'reverse';
  viewRows: TrackedShipment[];
  selectedRows: TrackedShipment[];
  today: string;
  loadRange: (from: string, to: string) => Promise<TrackedShipment[]>;
}) {
  const { toast } = useToast();
  const [scope, setScope] = useState<Scope>('view');
  const [from, setFrom] = useState(toDateInput(subDays(new Date(), 6)));
  const [to, setTo] = useState(toDateInput(new Date()));
  const [sheets, setSheets] = useState<ShipmentSheet[]>(['shipments', 'daily', 'summary']);
  const [fileFormat, setFileFormat] = useState<'xlsx' | 'csv'>('xlsx');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) setScope(selectedRows.length ? 'selected' : 'view'); }, [open, selectedRows.length]);

  const toggleSheet = (s: ShipmentSheet, on: boolean) => setSheets((cur) => (on ? [...new Set([...cur, s])] : cur.filter((x) => x !== s)));

  const run = async () => {
    setBusy(true);
    try {
      let rows: TrackedShipment[];
      let since: string | null = null;
      let label: string;
      if (scope === 'selected') { rows = selectedRows; label = 'selected'; }
      else if (scope === 'range') {
        const all = await loadRange(from, to);
        rows = all.filter((s) => (variant === 'forward' ? shipmentKind(s.shipment_ref) === 'FORWARD' : shipmentKind(s.shipment_ref) !== 'FORWARD'));
        since = from;
        label = from === to ? from : `${from}_to_${to}`;
      } else { rows = viewRows; label = 'view'; }
      if (!rows.length) { toast({ title: 'Nothing to export', description: 'No shipments match that choice.' }); return; }
      await exportShipmentsToExcel({
        shipments: rows,
        daily: dailyReport(rows.filter((s) => shipmentKind(s.shipment_ref) !== 'EXCHANGE'), since),
        stats: summarizeShipments(rows, today),
        sheets,
        fileFormat,
        filename: `shipments-${variant === 'forward' ? 'forward' : 'exchanges-returns'}-${label}`,
      });
      toast({ title: `Exported ${rows.length} shipment${rows.length === 1 ? '' : 's'}` });
      onOpenChange(false);
    } catch (e) {
      toast({ title: 'Export failed', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Export shipments</DialogTitle>
          <DialogDescription>{variant === 'forward' ? 'Forward orders' : 'Exchanges & returns'} — pick what to include.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2" role="radiogroup" aria-label="What to export">
          <Choice on={scope === 'view'} onClick={() => setScope('view')} title={`Shipments shown (${viewRows.length})`} hint="Current tab with your search and filters" />
          <Choice on={scope === 'selected'} onClick={() => setScope('selected')} disabled={!selectedRows.length} title={`Selected rows (${selectedRows.length})`} hint={selectedRows.length ? 'Only the rows you ticked' : 'Tick rows in the table to use this'} />
          <Choice on={scope === 'range'} onClick={() => setScope('range')} title="A date range" hint="Every shipment ordered or raised between two dates" />
        </div>

        {scope === 'range' && (
          <div className="space-y-3 rounded-lg bg-muted/50 p-3 animate-fade-in">
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => {
                const [f, t] = p.range().map(toDateInput);
                const on = f === from && t === to;
                return (
                  <button key={p.label} type="button" onClick={() => { setFrom(f); setTo(t); }}
                    className={cn('rounded-full border px-2.5 py-1 text-xs font-medium transition-colors', on ? 'border-primary bg-accent text-accent-foreground' : 'border-input bg-card hover:bg-muted')}>
                    {p.label}
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label htmlFor="ex-from">From</Label><Input id="ex-from" type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="ex-to">To</Label><Input id="ex-to" type="date" value={to} min={from} max={today} onChange={(e) => e.target.value && setTo(e.target.value)} /></div>
            </div>
            <p className="text-xs text-muted-foreground">{format(new Date(from), 'd MMM yyyy')} – {format(new Date(to), 'd MMM yyyy')}</p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Format</Label>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="radiogroup">
              {([['xlsx', 'Excel', FileSpreadsheet], ['csv', 'CSV', FileText]] as const).map(([k, l, Icon]) => (
                <button key={k} type="button" role="radio" aria-checked={fileFormat === k} onClick={() => setFileFormat(k)}
                  className={cn('flex h-8 items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-all', fileFormat === k ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                  <Icon className="size-4" />{l}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Sheets</Label>
            {fileFormat === 'csv' ? (
              <p className="text-xs text-muted-foreground pt-1.5">CSV contains the shipment rows only.</p>
            ) : (
              <div className="space-y-1.5">
                {([['shipments', 'Shipments'], ['daily', 'Daily report'], ['summary', 'Summary']] as [ShipmentSheet, string][]).map(([k, l]) => (
                  <label key={k} className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox checked={sheets.includes(k)} onCheckedChange={(v) => toggleSheet(k, v === true)} />{l}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={run} disabled={busy || (fileFormat === 'xlsx' && sheets.length === 0)}>
            {busy ? <><Loader2 className="animate-spin" /> Preparing…</> : <><Download /> Download</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
