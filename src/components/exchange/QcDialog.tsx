import { useEffect, useRef, useState } from 'react';
import { Camera, Check, Loader2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAppSettings, uploadQcPhoto } from '@/hooks/useAppData';
import { useProducts } from '@/hooks/useProducts';
import { describeItem } from '@/lib/items';
import { ProductThumb } from '@/components/app';
import { REASON_LABELS, type Ticket } from '@/types/database';
import { cn } from '@/lib/utils';

/**
 * Quality check at the packing station: checklist + photos + decision.
 * Keyboard: A approve, R reject, ⌘/Ctrl+Enter confirm.
 */
export function QcDialog({
  ticket,
  open,
  onOpenChange,
  onSubmit,
}: {
  ticket: Ticket | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSubmit: (decision: 'APPROVED' | 'DENIED', notes: string, checklist: Record<string, boolean>, photos: string[]) => Promise<unknown>;
}) {
  const { data: settings } = useAppSettings();
  const { data: products = [] } = useProducts();
  const items = settings?.qc_checklist.items ?? [];
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [decision, setDecision] = useState<'APPROVED' | 'DENIED'>('APPROVED');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<{ path: string; preview: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) { setChecks({}); setDecision('APPROVED'); setNotes(''); setPhotos([]); setErr(''); }
  }, [open, ticket?.id]);

  const allChecked = items.every((i) => checks[i]);
  const canSubmit = decision === 'APPROVED' ? allChecked : notes.trim().length >= 3;

  const submit = async () => {
    if (!ticket || !canSubmit || busy) return;
    setBusy(true); setErr('');
    try { await onSubmit(decision, notes.trim(), checks, photos.map((p) => p.path)); onOpenChange(false); }
    catch (e) { setErr((e as Error).message || 'Could not save QC'); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement) { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit(); return; }
      if (e.key === 'a' || e.key === 'A') setDecision('APPROVED');
      if (e.key === 'r' || e.key === 'R') setDecision('DENIED');
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const addPhotos = async (files: FileList | null) => {
    if (!ticket || !files?.length) return;
    setUploading(true); setErr('');
    try {
      for (const f of Array.from(files).slice(0, 4 - photos.length)) {
        const path = await uploadQcPhoto(ticket.id, f);
        setPhotos((p) => [...p, { path, preview: URL.createObjectURL(f) }]);
      }
    } catch (e) { setErr('Photo upload failed: ' + ((e as Error).message || 'try again')); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  if (!ticket) return null;
  const r = ticket.return_items?.[0];
  const rd = r ? describeItem(r, products) : undefined;
  const itemName = rd ? `${rd.name}${rd.variant ? ` · ${rd.variant}` : ''}` : 'No return items listed';
  const checkedCount = items.filter((i) => checks[i]).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader className="text-left">
          <DialogTitle>Quality check · {ticket.order_id}</DialogTitle>
          <DialogDescription>
            {ticket.customer_name} · received {ticket.return_received_at ? new Date(ticket.return_received_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
            {ticket.return_awb ? ` · AWB ${ticket.return_awb}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 sm:grid-cols-[200px_minmax(0,1fr)] sm:gap-6">
          {/* What came back: compact row on phones, photo column on wider screens */}
          <div className="flex items-start gap-3 sm:block sm:space-y-3">
            <div className="sm:hidden"><ProductThumb src={rd?.image} alt={rd?.name} size={64} className="rounded-lg" /></div>
            <div className="hidden sm:block"><ProductThumb src={rd?.image} alt={rd?.name} size={200} className="rounded-xl" /></div>
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium leading-snug text-foreground">{itemName}</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Reason: {REASON_LABELS[ticket.reason_code]}{ticket.reason_notes ? ` · “${ticket.reason_notes}”` : ''}
              </p>
            </div>
          </div>

          <div className="space-y-5">
            <section className="space-y-2" aria-label="Checklist">
              <SectionHead title="Checklist" meta={`${checkedCount}/${items.length} checked`} done={allChecked && items.length > 0} />
              <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                {items.map((i) => (
                  <label key={i} className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm transition-colors duration-150 hover:bg-muted/50">
                    <Checkbox checked={!!checks[i]} onCheckedChange={(v) => setChecks((c) => ({ ...c, [i]: v === true }))} />
                    <span className="min-w-0">{i}</span>
                  </label>
                ))}
              </div>
            </section>

            <section className="space-y-2" aria-label="Photos">
              <SectionHead title="Photos" meta={`${photos.length}/4 · optional`} />
              <div className="flex flex-wrap gap-2">
                {photos.map((p, i) => (
                  <div key={p.path} className="group relative size-16 overflow-hidden rounded-lg border border-border">
                    <img src={p.preview} alt={`QC photo ${i + 1}`} className="size-full object-cover" />
                    <button type="button" aria-label="Remove photo" onClick={() => setPhotos((ps) => ps.filter((x) => x.path !== p.path))}
                      className="absolute right-0.5 top-0.5 grid size-5 place-items-center rounded-full bg-foreground/70 text-background transition-opacity [@media(hover:hover)_and_(pointer:fine)]:opacity-0 group-hover:opacity-100 focus-visible:opacity-100">
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
                {photos.length < 4 && (
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} aria-label="Add photo"
                    className="flex size-16 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-input text-[11px] font-medium text-muted-foreground transition-colors duration-150 hover:border-primary hover:text-primary">
                    {uploading ? <Loader2 className="size-5 animate-spin" /> : <><Camera className="size-5" />Add</>}
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => addPhotos(e.target.files)} />
              </div>
            </section>

            <section className="space-y-2" aria-label="Decision">
              <SectionHead title="Decision" />
              <div role="radiogroup" aria-label="Decision" className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
                {(['APPROVED', 'DENIED'] as const).map((d) => (
                  <button key={d} type="button" role="radio" aria-checked={decision === d} onClick={() => setDecision(d)}
                    title={d === 'APPROVED' ? 'Shortcut: A · ⌘/Ctrl+Enter to save' : 'Shortcut: R · ⌘/Ctrl+Enter to save'} aria-keyshortcuts={d === 'APPROVED' ? 'A' : 'R'}
                    className={cn('flex h-9 items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-[background-color,color,box-shadow] duration-150',
                      decision === d ? 'bg-card shadow-sm ' + (d === 'APPROVED' ? 'text-success' : 'text-destructive') : 'text-muted-foreground hover:text-foreground')}>
                    {d === 'APPROVED' ? <Check className="size-4" /> : <X className="size-4" />}
                    {d === 'APPROVED' ? 'Approve' : 'Reject'}
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-2">
              <Label htmlFor="qc-notes">
                {decision === 'DENIED' ? 'Reason for rejection' : 'Notes'}{' '}
                <span className="font-normal text-muted-foreground">{decision === 'DENIED' ? '(required)' : '(optional)'}</span>
              </Label>
              <Textarea id="qc-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder={decision === 'DENIED' ? 'e.g. Stains on the collar, tags removed' : 'e.g. Minor crease, acceptable'} />
              {err && <p className="text-xs text-destructive">{err}</p>}
            </section>
          </div>
        </div>

        {/* Phones: pinned to the bottom of the sheet so the decision is always in reach */}
        <DialogFooter className="sticky -bottom-8 z-10 -mx-6 -mb-8 flex-row border-t border-border bg-card px-6 py-3 [&>button]:flex-1 sm:static sm:m-0 sm:items-center sm:border-0 sm:bg-transparent sm:p-0 sm:[&>button]:flex-none">
          <p className="mr-auto hidden text-xs text-muted-foreground sm:block">
            {decision === 'APPROVED'
              ? allChecked ? 'Moves to “Ready to ship”.' : 'Tick every checklist item to approve.'
              : 'The returned item is marked as rejected.'}
          </p>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button variant={decision === 'DENIED' ? 'destructive' : 'default'} onClick={submit} disabled={!canSubmit || busy || uploading}>
            {busy ? 'Saving…' : decision === 'APPROVED' ? 'Approve' : 'Reject return'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Section label on the left, status on the right: same rhythm for every block in the dialog. */
function SectionHead({ title, meta, done }: { title: string; meta?: string; done?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {meta && <span className={cn('text-xs tabular', done ? 'font-medium text-success' : 'text-muted-foreground')}>{meta}</span>}
    </div>
  );
}
