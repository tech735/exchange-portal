import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useUpdateShipmentSettings } from '@/hooks/useShipments';
import type { ShipmentSettings } from '@/lib/shipmentTracking';

const toList = (text: string) =>
  Array.from(new Set(text.split(/[\n,]/).map((v) => v.trim()).filter(Boolean)));

function NumberField({
  id,
  label,
  value,
  onChange,
  min = 0,
  max = 30,
  suffix,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  suffix: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-[13px] font-medium text-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="number"
          min={min}
          max={max}
          required
          className="w-24"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <span className="text-sm text-muted-foreground">{suffix}</span>
      </div>
    </div>
  );
}

export function ShipmentSettingsDialog({
  open,
  onOpenChange,
  settings,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: ShipmentSettings;
}) {
  const { toast } = useToast();
  const updateSettings = useUpdateShipmentSettings();
  const [draft, setDraft] = useState(settings);
  const [cities, setCities] = useState(settings.ncr_cities.join('\n'));
  const [prefixes, setPrefixes] = useState(settings.ncr_pincode_prefixes.join(', '));
  const [emails, setEmails] = useState(settings.team_alert_emails.join(', '));

  useEffect(() => {
    if (!open) return;
    setDraft(settings);
    setCities(settings.ncr_cities.join('\n'));
    setPrefixes(settings.ncr_pincode_prefixes.join(', '));
    setEmails(settings.team_alert_emails.join(', '));
  }, [open, settings]);

  const set = <K extends keyof ShipmentSettings>(key: K, value: ShipmentSettings[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings.mutate(
      {
        ...draft,
        ncr_cities: toList(cities).map((c) => c.toLowerCase()),
        ncr_pincode_prefixes: toList(prefixes),
        team_alert_emails: toList(emails),
      },
      {
        onSuccess: () => {
          toast({ title: 'Tracker rules saved' });
          onOpenChange(false);
        },
        onError: (error: Error) => toast({ title: 'Could not save settings', description: error.message, variant: 'destructive' }),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tracker rules</DialogTitle>
          <DialogDescription>Deadlines, the Delhi NCR list and alerts. Changes apply to every shipment straight away.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-1">
          <section className="space-y-3 border-t border-border pt-5 first:border-t-0 first:pt-0">
            <h3 className="font-heading text-sm font-semibold text-foreground">Pickup deadline</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <NumberField id="pickup-days" label="Picked up within" value={draft.pickup_deadline_days} onChange={(v) => set('pickup_deadline_days', v)} suffix="day(s) of the order" />
              <NumberField id="pickup-hour" label="By (24h, IST)" value={draft.pickup_deadline_hour} onChange={(v) => set('pickup_deadline_hour', v)} max={23} suffix=":00" />
            </div>
          </section>

          <section className="space-y-3 border-t border-border pt-5 first:border-t-0 first:pt-0">
            <h3 className="font-heading text-sm font-semibold text-foreground">Delivery deadline (from pickup)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <NumberField id="ncr-days" label="Delhi NCR" value={draft.ncr_delivery_days} onChange={(v) => set('ncr_delivery_days', v)} suffix="days" />
              <NumberField id="outside-days" label="Outside NCR" value={draft.outside_ncr_delivery_days} onChange={(v) => set('outside_ncr_delivery_days', v)} suffix="days" />
            </div>
            <label htmlFor="skip-sundays" className="flex items-center gap-2 text-sm">
              <Checkbox id="skip-sundays" checked={draft.skip_sundays} onCheckedChange={(c) => set('skip_sundays', c === true)} />
              Don't count Sundays towards pickup or delivery deadlines
            </label>
          </section>

          <section className="space-y-3 border-t border-border pt-5 first:border-t-0 first:pt-0">
            <h3 className="font-heading text-sm font-semibold text-foreground">RTO escalation</h3>
            <NumberField
              id="rto-days"
              label="Flag for RTO review when still undelivered"
              value={draft.rto_escalation_days}
              onChange={(v) => set('rto_escalation_days', v)}
              min={1}
              suffix="day(s) past the delivery deadline"
            />
            <p className="text-xs text-muted-foreground">Flagged shipments get a "Mark RTO" button. Shipments the courier reports as RTO move there automatically.</p>
          </section>

          <section className="space-y-3 border-t border-border pt-5 first:border-t-0 first:pt-0">
            <h3 className="font-heading text-sm font-semibold text-foreground">Delhi NCR</h3>
            <div className="space-y-1.5">
              <Label htmlFor="ncr-cities" className="text-[13px] font-medium text-foreground">Cities (one per line — matches any city or state containing the name)</Label>
              <Textarea id="ncr-cities" rows={5} value={cities} onChange={(e) => setCities(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ncr-prefixes" className="text-[13px] font-medium text-foreground">PIN code prefixes</Label>
              <Input id="ncr-prefixes" value={prefixes} onChange={(e) => setPrefixes(e.target.value)} placeholder="110, 1220, 2013" />
            </div>
          </section>

          <section className="space-y-3 border-t border-border pt-5 first:border-t-0 first:pt-0">
            <h3 className="font-heading text-sm font-semibold text-foreground">Alerts</h3>
            <div className="space-y-1.5">
              <Label htmlFor="team-emails" className="text-[13px] font-medium text-foreground">Team alert emails (late pickups and delayed orders, hourly)</Label>
              <Input id="team-emails" value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="Blank = the logistics and admin notification lists" />
            </div>
            <div className="space-y-2">
              <p className="text-sm">Apologise to customers automatically when their order passes the delivery deadline:</p>
              <label htmlFor="notify-sms" className="flex items-start gap-2 text-sm">
                <Checkbox id="notify-sms" className="mt-0.5" checked={draft.notify_customers_by_sms} onCheckedChange={(c) => set('notify_customers_by_sms', c === true)} />
                <span>
                  By SMS (MSG91)
                  <span className="block text-xs text-muted-foreground">Needs the MSG91 auth key and a DLT-approved template set up as function secrets.</span>
                </span>
              </label>
              <label htmlFor="notify-email" className="flex items-center gap-2 text-sm">
                <Checkbox id="notify-email" checked={draft.notify_customers_by_email} onCheckedChange={(c) => set('notify_customers_by_email', c === true)} />
                By email
              </label>
              <p className="text-xs text-muted-foreground">Sent once per shipment, between 9 AM and 9 PM; the shipment is then marked as notified.</p>
            </div>
          </section>

          <DialogFooter className="border-t border-border pt-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={updateSettings.isPending}>{updateSettings.isPending ? 'Saving…' : 'Save rules'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
