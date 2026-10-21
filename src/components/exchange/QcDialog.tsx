import { useEffect, useRef, useState } from 'react';
import { Camera, Check, Loader2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAppSettings, uploadQcPhoto } from '@/hooks/useAppData';
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Quality check · #{ticket.order_id}</DialogTitle>
          <DialogDescription>
            {ticket.customer_name} · received {ticket.return_received_at ? new Date(ticket.return_received_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
            {ticket.return_awb ? ` · AWB ${ticket.return_awb}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 sm:grid-cols-[220px_1fr]">
          <div className="space-y-2">
            <div className="grid aspect-square place-items-center rounded-lg bg-muted text-xs text-faint">Returned item</div>
            <p className="text-sm font-medium">{r ? `${r.product_name} · Size ${r.size}` : 'No return items listed'}</p>
            <p className="text-xs text-muted-foreground">Reason: {REASON_LABELS[ticket.reason_code]}{ticket.reason_notes ? ` · “${ticket.reason_notes}”` : ''}</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Checklist</Label>
              {items.map((i) => (
                <label key={i} className="flex cursor-pointer items-center gap-2.5 text-sm">
                  <Checkbox checked={!!checks[i]} onCheckedChange={(v) => setChecks((c) => ({ ...c, [i]: v === true }))} />
                  {i}
                </label>
              ))}
            </div>

            <div className="space-y-2">
              <Label>Photos <span className="font-normal text-muted-foreground">({photos.length}/4)</span></Label>
              <div className="flex flex-wrap gap-2">
                {photos.map((p, i) => (
                  <div key={p.path} className="group relative size-16 overflow-hidden rounded-lg border border-border">
                    <img src={p.preview} alt={`QC photo ${i + 1}`} className="size-full object-cover" />
                    <button type="button" aria-label="Remove photo" onClick={() => setPhotos((ps) => ps.filter((x) => x.path !== p.path))}
                      className="absolute right-0.5 top-0.5 grid size-5 place-items-center rounded-full bg-foreground/70 text-background opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
                {photos.length < 4 && (
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                    className="grid size-16 place-items-center rounded-lg border border-dashed border-input text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                    {uploading ? <Loader2 className="size-5 animate-spin" /> : <Camera className="size-5" />}
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => addPhotos(e.target.files)} />
              </div>
            </div>

            <div role="radiogroup" aria-label="Decision" className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
              {(['APPROVED', 'DENIED'] as const).map((d) => (
                <button key={d} type="button" role="radio" aria-checked={decision === d} onClick={() => setDecision(d)}
                  className={cn('flex h-9 items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-all duration-150',
                    decision === d ? 'bg-card shadow-sm ' + (d === 'APPROVED' ? 'text-success' : 'text-destructive') : 'text-muted-foreground hover:text-foreground')}>
                  {d === 'APPROVED' ? <Check className="size-4" /> : <X className="size-4" />}
                  {d === 'APPROVED' ? 'Approve' : 'Reject'}
                  <kbd className="kbd ml-1 hidden sm:inline-flex">{d === 'APPROVED' ? 'A' : 'R'}</kbd>
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="qc-notes">{decision === 'DENIED' ? 'Reason for rejection (required)' : 'Notes (optional)'}</Label>
              <Textarea id="qc-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder={decision === 'DENIED' ? 'e.g. Stains on the collar, tags removed' : 'e.g. Minor crease, acceptable'} />
            </div>
            {err && <p className="text-xs text-destructive">{err}</p>}
          </div>
        </div>

        <DialogFooter className="items-center gap-2 sm:gap-2">
          <p className="mr-auto hidden text-xs text-muted-foreground sm:block">
            {decision === 'APPROVED'
              ? allChecked ? 'Next: the replacement goes to “Ready to ship”.' : 'Tick every checklist item to approve.'
              : 'The customer’s item will be marked as rejected.'}
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
