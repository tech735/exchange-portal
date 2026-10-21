import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2, Truck, RefreshCw } from 'lucide-react';
import Layout from '@/components/Layout';
import { PageHeader, SectionCard, KV } from '@/components/app';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ProductSyncButton } from '@/components/ProductSyncButton';
import { ShipmentSettingsDialog } from '@/pages/Shipments/ShipmentSettingsDialog';
import { useAppSettings, useSaveSetting, DEFAULT_SETTINGS } from '@/hooks/useAppData';
import { useShipmentSettings } from '@/hooks/useShipments';
import { useToast } from '@/hooks/use-toast';
import { REASON_LABELS, type AppSettings, type ReasonCode } from '@/types/database';
import { cn } from '@/lib/utils';

const SECTIONS = [
  { id: 'policy', label: 'Exchange policy' },
  { id: 'fees', label: 'Fees & payments' },
  { id: 'qc', label: 'Quality check' },
  { id: 'shipping', label: 'Shipping rules' },
  { id: 'integrations', label: 'Integrations' },
] as const;

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 py-1.5">
      <Checkbox className="mt-0.5" checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      <span><span className="block text-sm font-medium">{label}</span>{hint && <span className="block text-xs text-muted-foreground">{hint}</span>}</span>
    </label>
  );
}

function SaveBar({ dirty, saving, onSave, onReset }: { dirty: boolean; saving: boolean; onSave: () => void; onReset: () => void }) {
  return (
    <div className="mt-4 flex items-center justify-end gap-2 border-t border-border pt-4">
      {dirty && <span className="mr-auto text-xs text-warning">Unsaved changes</span>}
      <Button variant="ghost" size="sm" onClick={onReset} disabled={!dirty || saving}>Reset</Button>
      <Button size="sm" onClick={onSave} disabled={!dirty || saving}>{saving ? 'Saving…' : 'Save'}</Button>
    </div>
  );
}

function useDraft<K extends keyof AppSettings>(key: K, server: AppSettings | undefined) {
  const [draft, setDraft] = useState<AppSettings[K]>(server?.[key] ?? DEFAULT_SETTINGS[key]);
  useEffect(() => { if (server) setDraft(server[key]); }, [server, key]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(server?.[key] ?? DEFAULT_SETTINGS[key]);
  return { draft, setDraft, dirty, reset: () => setDraft(server?.[key] ?? DEFAULT_SETTINGS[key]) };
}

export default function Settings() {
  const { data: settings, isLoading } = useAppSettings();
  const save = useSaveSetting();
  const { toast } = useToast();
  const { data: shipSettings } = useShipmentSettings();
  const [shipOpen, setShipOpen] = useState(false);
  const [active, setActive] = useState<(typeof SECTIONS)[number]['id']>('policy');
  const policy = useDraft('exchange_policy', settings);
  const fees = useDraft('fees', settings);
  const qc = useDraft('qc_checklist', settings);
  const [newItem, setNewItem] = useState('');

  const persist = async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    try { await save.mutateAsync({ key, value }); toast({ title: 'Settings saved' }); }
    catch (e) { toast({ title: 'Couldn’t save', description: (e as Error).message.includes('app_settings') ? 'The settings table hasn’t been created yet — apply the revamp migration.' : (e as Error).message, variant: 'destructive' }); }
  };

  const go = (id: (typeof SECTIONS)[number]['id']) => {
    setActive(id);
    document.getElementById(`s-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const moveQc = (i: number, d: -1 | 1) => qc.setDraft((q) => {
    const items = [...q.items]; const j = i + d; if (j < 0 || j >= items.length) return q;
    [items[i], items[j]] = [items[j], items[i]]; return { ...q, items };
  });

  return (
    <Layout>
      <div className="space-y-5">
        <PageHeader title="Settings" description="These rules drive eligibility, fees, quality checks and shipping deadlines across the portal." />
        <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
          <nav className="flex gap-1 overflow-x-auto scrollbar-hide lg:sticky lg:top-24 lg:flex-col lg:self-start" aria-label="Settings sections">
            {SECTIONS.map((s) => (
              <button key={s.id} onClick={() => go(s.id)} className={cn('shrink-0 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors', active === s.id ? 'bg-card text-foreground shadow-card ring-1 ring-border' : 'text-muted-foreground hover:text-foreground hover:bg-muted')}>
                {s.label}
              </button>
            ))}
          </nav>

          <div className={cn('min-w-0 space-y-5', isLoading && 'opacity-60 pointer-events-none')}>
            <SectionCard title="Exchange policy" description="Used to show eligibility on orders and when lodging an exchange." className="scroll-mt-24" >
              <div id="s-policy" className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5"><Label htmlFor="win">Exchange window (days after delivery)</Label>
                  <Input id="win" type="number" min={1} max={90} value={policy.draft.window_days} onChange={(e) => policy.setDraft({ ...policy.draft, window_days: Number(e.target.value) || 0 })} /></div>
                <div className="space-y-1.5"><Label htmlFor="max">Max exchanges per order</Label>
                  <Input id="max" type="number" min={1} max={10} value={policy.draft.max_per_order} onChange={(e) => policy.setDraft({ ...policy.draft, max_per_order: Number(e.target.value) || 1 })} /></div>
              </div>
              <div className="mt-3">
                <Toggle checked={policy.draft.block_final_sale} onChange={(v) => policy.setDraft({ ...policy.draft, block_final_sale: v })} label="Block final-sale items" hint={`Shopify products tagged “${policy.draft.final_sale_tag}”`} />
                <Toggle checked={policy.draft.allow_different_product} onChange={(v) => policy.setDraft({ ...policy.draft, allow_different_product: v })} label="Allow exchanging for a different product" hint="Otherwise only a different size of the same product" />
              </div>
              <SaveBar dirty={policy.dirty} saving={save.isPending} onReset={policy.reset} onSave={() => persist('exchange_policy', policy.draft)} />
            </SectionCard>

            <SectionCard title="Fees & payments" description="The delivery charge pre-fills on new exchanges and can be changed per exchange." className="scroll-mt-24">
              <div id="s-fees" className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5"><Label htmlFor="fee">Delivery charge (₹)</Label>
                  <Input id="fee" type="number" min={0} step={10} value={fees.draft.delivery_charge} onChange={(e) => fees.setDraft({ ...fees.draft, delivery_charge: Number(e.target.value) || 0 })} /></div>
                <div className="space-y-1.5"><Label>Payment links</Label>
                  <Select value={fees.draft.payment_provider} onValueChange={(v) => fees.setDraft({ ...fees.draft, payment_provider: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="RAZORPAY">Razorpay</SelectItem></SelectContent>
                  </Select></div>
              </div>
              <p className="mt-4 mb-1 text-sm font-medium">No delivery charge when the reason is…</p>
              <div className="grid gap-x-6 sm:grid-cols-2">
                {(Object.keys(REASON_LABELS) as ReasonCode[]).map((r) => (
                  <Toggle key={r} label={REASON_LABELS[r]} checked={fees.draft.free_reasons.includes(r)}
                    onChange={(v) => fees.setDraft({ ...fees.draft, free_reasons: v ? [...fees.draft.free_reasons, r] : fees.draft.free_reasons.filter((x) => x !== r) })} />
                ))}
              </div>
              <SaveBar dirty={fees.dirty} saving={save.isPending} onReset={fees.reset} onSave={() => persist('fees', fees.draft)} />
            </SectionCard>

            <SectionCard title="Quality check" description="Every item must be ticked before a return can be approved." className="scroll-mt-24">
              <ol id="s-qc" className="space-y-2">
                {qc.draft.items.map((it, i) => (
                  <li key={`${it}-${i}`} className="flex items-center gap-2">
                    <span className="w-5 text-center text-xs text-faint tabular">{i + 1}</span>
                    <Input value={it} onChange={(e) => qc.setDraft({ items: qc.draft.items.map((x, j) => (j === i ? e.target.value : x)) })} />
                    <Button variant="ghost" size="icon-sm" aria-label="Move up" disabled={i === 0} onClick={() => moveQc(i, -1)}><ArrowUp /></Button>
                    <Button variant="ghost" size="icon-sm" aria-label="Move down" disabled={i === qc.draft.items.length - 1} onClick={() => moveQc(i, 1)}><ArrowDown /></Button>
                    <Button variant="ghost" size="icon-sm" aria-label="Remove" onClick={() => qc.setDraft({ items: qc.draft.items.filter((_, j) => j !== i) })}><Trash2 /></Button>
                  </li>
                ))}
              </ol>
              <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (newItem.trim()) { qc.setDraft({ items: [...qc.draft.items, newItem.trim()] }); setNewItem(''); } }}>
                <Input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="Add a check, e.g. Original packaging included" />
                <Button type="submit" variant="secondary" disabled={!newItem.trim()}><Plus /> Add</Button>
              </form>
              <SaveBar dirty={qc.dirty} saving={save.isPending} onReset={qc.reset} onSave={() => persist('qc_checklist', { items: qc.draft.items.map((s) => s.trim()).filter(Boolean) })} />
            </SectionCard>

            <SectionCard title="Shipping rules" description="Deadlines and Delhi NCR zones used by the Shipments tracker." className="scroll-mt-24"
              action={<Button variant="secondary" size="sm" onClick={() => setShipOpen(true)} disabled={!shipSettings}><Truck /> Edit rules</Button>}>
              <div id="s-shipping">
                {shipSettings ? (
                  <>
                    <KV label="Pickup deadline">within {shipSettings.pickup_deadline_days} day{shipSettings.pickup_deadline_days === 1 ? '' : 's'}, by {shipSettings.pickup_deadline_hour}:00 IST</KV>
                    <KV label="Delivery after pickup">{shipSettings.ncr_delivery_days} days NCR · {shipSettings.outside_ncr_delivery_days} days outside</KV>
                    <KV label="Sundays">{shipSettings.skip_sundays ? 'Not counted' : 'Counted'}</KV>
                    <KV label="RTO review after">{shipSettings.rto_escalation_days} days late</KV>
                  </>
                ) : <div className="h-24 rounded-lg bg-muted animate-pulse" />}
              </div>
            </SectionCard>

            <SectionCard title="Integrations" className="scroll-mt-24">
              <div id="s-integrations" className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-medium"><RefreshCw className="size-4 text-faint" /> Shopify product catalogue</p>
                  <p className="text-xs text-muted-foreground">Pulls products, sizes, prices and stock used in the exchange flow.</p>
                </div>
                <ProductSyncButton />
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
      {shipSettings && <ShipmentSettingsDialog open={shipOpen} onOpenChange={setShipOpen} settings={shipSettings} />}
    </Layout>
  );
}
