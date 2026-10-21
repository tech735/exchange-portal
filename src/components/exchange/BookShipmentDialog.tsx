import { useEffect, useState } from 'react';
import { Check, ExternalLink, Truck } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export type Aggregator = 'SHIPDELIGHT' | 'ITHINK' | 'SHIPROCKET';

const AGGREGATORS: { id: Aggregator; name: string; url: string }[] = [
  { id: 'SHIPROCKET', name: 'Shiprocket', url: 'https://app.shiprocket.in/newlogin?routestate=seller%2Forders' },
  { id: 'ITHINK', name: 'iThink Logistics', url: 'https://my.ithinklogistics.com/v4/order/store-order' },
  { id: 'SHIPDELIGHT', name: 'ShipDelight', url: 'https://app.shipdelight.com/shipments/manage' },
];

/**
 * Courier booking. Phase 1 still books on the courier's site (no API yet), so
 * the flow is: pick courier → it opens in a new tab → paste the AWB back.
 */
export function BookShipmentDialog({
  open,
  onOpenChange,
  kind,
  orderLabel,
  context,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  kind: 'return' | 'replacement';
  orderLabel: string;
  context?: string | null;
  onSubmit: (aggregator: Aggregator, awb: string) => Promise<unknown>;
}) {
  const [agg, setAgg] = useState<Aggregator | null>(null);
  const [awb, setAwb] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { if (!open) { setAgg(null); setAwb(''); setErr(''); } }, [open]);

  const submit = async () => {
    if (!agg || awb.trim().length < 6) return;
    setBusy(true); setErr('');
    try { await onSubmit(agg, awb.trim()); onOpenChange(false); }
    catch (e) { setErr((e as Error).message || 'Could not save the booking'); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{kind === 'return' ? 'Book return pickup' : 'Ship replacement'} · {orderLabel}</DialogTitle>
          <DialogDescription>
            {kind === 'return' ? 'Book the pickup with a courier, then paste the AWB here.' : 'Book the forward shipment for the new item, then paste the AWB here.'}
          </DialogDescription>
        </DialogHeader>

        {context && context !== 'Order not yet fulfilled.' && (
          <div className="rounded-lg bg-muted/60 px-3 py-2.5 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Original delivery:</span> {context}
          </div>
        )}

        <div className="space-y-2">
          <Label>1 · Courier</Label>
          <div className="grid gap-2">
            {AGGREGATORS.map((a) => {
              const on = agg === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => { setAgg(a.id); window.open(a.url, '_blank', 'noopener'); }}
                  className={cn('flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors duration-150',
                    on ? 'border-primary bg-accent text-accent-foreground' : 'border-input hover:bg-muted')}
                >
                  <span className={cn('grid size-8 place-items-center rounded-md', on ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                    {on ? <Check className="size-4" /> : <Truck className="size-4" />}
                  </span>
                  <span className="flex-1 font-medium">{a.name}</span>
                  <ExternalLink className="size-4 text-faint" />
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">Opens the courier’s booking page in a new tab.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="awb">2 · AWB number</Label>
          <Input id="awb" value={awb} disabled={!agg} onChange={(e) => setAwb(e.target.value.toUpperCase().replace(/\s/g, ''))}
            placeholder={agg ? 'Paste the AWB from the courier' : 'Pick a courier first'} className="font-mono tracking-wide" autoComplete="off" />
          {err && <p className="text-xs text-destructive">{err}</p>}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={!agg || awb.trim().length < 6 || busy}>{busy ? 'Saving…' : 'Save booking'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
