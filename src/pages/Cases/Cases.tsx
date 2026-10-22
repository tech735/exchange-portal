import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { ArrowLeft, CheckCircle2, LifeBuoy, Plus, RotateCcw, Trash2, Truck, ExternalLink } from 'lucide-react';
import Layout from '@/components/Layout';
import { PageHeader, ViewTabs, SearchField, ToneBadge, EmptyState, ConfirmDialog, initials } from '@/components/app';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useSpecialCases, useSaveSpecialCase, useDeleteSpecialCase, useShipments, useUpdateShipment, type SpecialCaseValues } from '@/hooks/useShipments';
import { useCaseUpdates, useAddCaseUpdate, useStaff } from '@/hooks/useAppData';
import { useAuth } from '@/hooks/useAuth';
import { useUser } from '@/contexts/UserContext';
import { useToast } from '@/hooks/use-toast';
import { SPECIAL_CASE_TYPE_LABELS, type CaseBoardStage, type SpecialCase, type SpecialCaseType, type Shipment } from '@/types/database';
import { CaseBoard, BOARD_COLUMNS, type BoardColumn } from './CaseBoard';
import { cn } from '@/lib/utils';

type Tab = 'board' | 'open' | 'rto' | 'resolved';
const TYPE_TONE: Record<SpecialCaseType, 'danger' | 'warning' | 'info' | 'neutral'> = { RTO: 'danger', RETURN: 'warning', EXCHANGE: 'info', OTHER: 'neutral' };
const today = () => format(new Date(), 'yyyy-MM-dd');

function NewCaseDialog({ open, onOpenChange, onCreated, stage = 'NEW' }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (orderName: string) => void; stage?: CaseBoardStage }) {
  const save = useSaveSpecialCase();
  const { profile, user } = useAuth();
  const { toast } = useToast();
  const [v, setV] = useState({ order_name: '', case_type: 'OTHER' as SpecialCaseType, issue: '', awb_number: '' });
  useEffect(() => { if (open) setV({ order_name: '', case_type: 'OTHER', issue: '', awb_number: '' }); }, [open]);
  const submit = async () => {
    try {
      await save.mutateAsync({ values: {
        order_name: v.order_name.trim(), case_type: v.case_type, issue: v.issue.trim(), awb_number: v.awb_number.trim() || null,
        action_taken: null, latest_update: null, status: 'OPEN', resolved_on: null, updated_by: profile?.full_name ?? null, owner_id: user?.id ?? null, board_stage: stage,
      } as SpecialCaseValues });
      toast({ title: 'Case logged' });
      onCreated(v.order_name.trim());
      onOpenChange(false);
    } catch (e) { toast({ title: 'Couldn’t log the case', description: (e as Error).message, variant: 'destructive' }); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log a case</DialogTitle>
          <DialogDescription>RTOs, damaged parcels, wrong deliveries, or anything that needs follow-up.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-[1fr_140px] gap-3">
            <div className="space-y-1.5"><Label htmlFor="c-order">Order number</Label><Input id="c-order" value={v.order_name} onChange={(e) => setV({ ...v, order_name: e.target.value })} placeholder="K-2627-3232" /></div>
            <div className="space-y-1.5"><Label>Type</Label>
              <Select value={v.case_type} onValueChange={(t) => setV({ ...v, case_type: t as SpecialCaseType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(SPECIAL_CASE_TYPE_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="c-issue">What happened?</Label><Textarea id="c-issue" rows={3} value={v.issue} onChange={(e) => setV({ ...v, issue: e.target.value })} placeholder="e.g. Customer refused delivery, parcel returning" /></div>
          <div className="space-y-1.5"><Label htmlFor="c-awb">AWB <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="c-awb" value={v.awb_number} onChange={(e) => setV({ ...v, awb_number: e.target.value.toUpperCase() })} className="font-mono" /></div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!v.order_name.trim() || !v.issue.trim() || save.isPending}>{save.isPending ? 'Saving…' : 'Log case'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CaseDetail({ c, onBack }: { c: SpecialCase; onBack: () => void }) {
  const { data: updates = [], isLoading } = useCaseUpdates(c.id);
  const addUpdate = useAddCaseUpdate();
  const save = useSaveSpecialCase();
  const del = useDeleteSpecialCase();
  const { data: staff = [] } = useStaff();
  const { profile } = useAuth();
  const { user } = useUser();
  const { toast } = useToast();
  const [body, setBody] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [nextStep, setNextStep] = useState(c.action_taken ?? '');
  useEffect(() => { setNextStep(c.action_taken ?? ''); setBody(''); }, [c.id, c.action_taken]);

  const base: SpecialCaseValues = {
    order_name: c.order_name, case_type: c.case_type, issue: c.issue, action_taken: c.action_taken, awb_number: c.awb_number,
    latest_update: c.latest_update, status: c.status, resolved_on: c.resolved_on, updated_by: profile?.full_name ?? c.updated_by, owner_id: c.owner_id ?? null,
  } as SpecialCaseValues;
  const patch = async (p: Partial<SpecialCaseValues>, ok: string) => {
    try { await save.mutateAsync({ id: c.id, values: { ...base, ...p } }); toast({ title: ok }); }
    catch (e) { toast({ title: 'Couldn’t save', description: (e as Error).message, variant: 'destructive' }); }
  };
  const post = async () => {
    if (!body.trim()) return;
    try { await addUpdate.mutateAsync({ caseId: c.id, body }); setBody(''); }
    catch (e) { toast({ title: 'Couldn’t post the update', description: (e as Error).message, variant: 'destructive' }); }
  };
  const open = c.status === 'OPEN';
  const ownerName = staff.find((s) => s.id === c.owner_id)?.full_name;

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-4 border-b border-border p-4 sm:p-6">
        <button onClick={onBack} className="lg:hidden inline-flex items-center gap-1 text-sm font-medium text-primary"><ArrowLeft className="size-4" /> All cases</button>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-heading text-lg font-semibold">{c.order_name}</h2>
              <ToneBadge tone={TYPE_TONE[c.case_type]}>{SPECIAL_CASE_TYPE_LABELS[c.case_type]}</ToneBadge>
              <ToneBadge tone={open ? 'warning' : 'success'}>{open ? 'Open' : `Resolved ${c.resolved_on ? format(new Date(c.resolved_on), 'd MMM') : ''}`}</ToneBadge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Logged {formatDistanceToNowStrict(new Date(c.created_at), { addSuffix: true })}{c.awb_number ? ` · AWB ${c.awb_number}` : ''}{c.updated_by ? ` · last edit by ${c.updated_by}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={c.owner_id ?? 'none'} onValueChange={(v) => patch({ owner_id: v === 'none' ? null : v } as Partial<SpecialCaseValues>, 'Owner updated')}>
              <SelectTrigger className="h-9 w-[170px]" aria-label="Owner"><SelectValue>{ownerName ? `Owner: ${ownerName}` : 'No owner'}</SelectValue></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No owner</SelectItem>
                {staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name || s.email}</SelectItem>)}
              </SelectContent>
            </Select>
            {open && (
              <Select value={c.board_stage ?? 'NEW'} onValueChange={(v) => patch({ board_stage: v as CaseBoardStage } as Partial<SpecialCaseValues>, 'Moved')}>
                <SelectTrigger className="h-9 w-[180px]" aria-label="Stage"><SelectValue /></SelectTrigger>
                <SelectContent>{BOARD_COLUMNS.filter((b) => b.key !== 'CLOSED').map((b) => <SelectItem key={b.key} value={b.key}>{b.title}</SelectItem>)}</SelectContent>
              </Select>
            )}
            {open
              ? <Button onClick={() => patch({ status: 'RESOLVED', resolved_on: today() }, 'Case resolved')}><CheckCircle2 /> Resolve</Button>
              : <Button variant="secondary" onClick={() => patch({ status: 'OPEN', resolved_on: null }, 'Case reopened')}><RotateCcw /> Reopen</Button>}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-muted/60 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Issue</p>
            <p className="mt-1 text-sm whitespace-pre-line">{c.issue}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="next" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Next step / action taken</Label>
            <Textarea id="next" rows={2} value={nextStep} onChange={(e) => setNextStep(e.target.value)} onBlur={() => nextStep !== (c.action_taken ?? '') && patch({ action_taken: nextStep || null }, 'Next step saved')} placeholder="e.g. Call customer, re-ship once confirmed" />
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-6">
        <p className="text-sm font-semibold">Updates</p>
        {isLoading ? <div className="h-16 rounded-lg bg-muted animate-pulse" /> : updates.length === 0 && !c.latest_update ? (
          <p className="text-sm text-muted-foreground">No updates yet. Add the first one below.</p>
        ) : (
          <ol className="space-y-3">
            {updates.length === 0 && c.latest_update && (
              <li className="flex gap-3"><span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-semibold">{initials(c.updated_by)}</span>
                <div className="flex-1 rounded-lg bg-muted/60 px-3 py-2"><p className="text-[11px] text-faint">Earlier note</p><p className="text-sm">{c.latest_update}</p></div></li>
            )}
            {updates.map((u) => (
              <li key={u.id} className="flex gap-3 animate-fade-in">
                <span className={cn('mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-[10px] font-semibold', u.author_id === user?.id ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground')}>{initials(u.author_name)}</span>
                <div className="min-w-0 flex-1 rounded-lg bg-muted/60 px-3 py-2">
                  <p className="text-[11px] text-faint">{u.author_name ?? 'Someone'} · {formatDistanceToNowStrict(new Date(u.created_at), { addSuffix: true })}</p>
                  <p className="text-sm whitespace-pre-line break-words">{u.body}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="border-t border-border p-3 sm:p-4">
        <div className="flex items-end gap-2 rounded-lg border border-input bg-card p-2 focus-within:border-primary focus-within:ring-[3px] focus-within:ring-primary/15">
          <textarea value={body} onChange={(e) => setBody(e.target.value)} onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') post(); }}
            rows={2} placeholder="Add an update… (the customer isn’t notified)" className="flex-1 resize-none bg-transparent px-1 text-base md:text-sm outline-none placeholder:text-faint" />
          <Button size="sm" onClick={post} disabled={!body.trim() || addUpdate.isPending}>Post</Button>
        </div>
        <div className="mt-2 flex justify-end">
          <button onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /> Delete case</button>
        </div>
      </div>

      <ConfirmDialog open={confirmDelete} onOpenChange={setConfirmDelete} destructive title={`Delete the case for ${c.order_name}?`} description="Its updates are deleted too." confirmLabel="Delete" loading={del.isPending}
        onConfirm={async () => { await del.mutateAsync(c.id); setConfirmDelete(false); onBack(); toast({ title: 'Case deleted' }); }} />
    </div>
  );
}

function RtoList({ shipments }: { shipments: Shipment[] }) {
  const update = useUpdateShipment();
  const { toast } = useToast();
  const [resolving, setResolving] = useState<Shipment | null>(null);
  const [resolution, setResolution] = useState('');
  if (shipments.length === 0) return <EmptyState icon={Truck} title="No open RTOs" description="Shipments marked RTO on the Shipments page show up here until resolved." />;
  return (
    <>
      <ul className="divide-y divide-border">
        {shipments.map((s) => (
          <li key={s.id} className="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{s.shipment_ref} <span className="font-normal text-muted-foreground">· {s.customer_name ?? 'Customer'}</span></p>
              <p className="truncate text-xs text-muted-foreground">{[s.city, s.courier, s.awb_number && `AWB ${s.awb_number}`].filter(Boolean).join(' · ')}{s.resolution ? ` · ${s.resolution}` : ''}</p>
            </div>
            <div className="flex gap-2">
              <Button asChild variant="ghost" size="sm"><Link to="/shipments"><ExternalLink /> Shipment</Link></Button>
              <Button size="sm" variant="secondary" onClick={() => { setResolving(s); setResolution(s.resolution ?? ''); }}>Resolve</Button>
            </div>
          </li>
        ))}
      </ul>
      <ConfirmDialog open={!!resolving} onOpenChange={(o) => !o && setResolving(null)} title={`Resolve RTO ${resolving?.shipment_ref}?`} confirmLabel="Resolve" loading={update.isPending}
        onConfirm={async () => {
          try { await update.mutateAsync({ shipment: resolving!, patch: { resolution: resolution || 'Resolved', resolved_on: today() } }); toast({ title: 'RTO resolved' }); setResolving(null); }
          catch (e) { toast({ title: 'Couldn’t save', description: (e as Error).message, variant: 'destructive' }); }
        }}>
        <div className="space-y-1.5"><Label htmlFor="res">What was the outcome?</Label><Input id="res" value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="e.g. Re-shipped on 24 Oct, refunded" /></div>
      </ConfirmDialog>
    </>
  );
}

export default function Cases() {
  const { data: cases = [], isLoading } = useSpecialCases();
  const { data: shipments = [] } = useShipments(null);
  const [tab, setTab] = useState<Tab>('board');
  const [newStage, setNewStage] = useState<CaseBoardStage>('NEW');
  const save = useSaveSpecialCase();
  const { data: staff = [] } = useStaff();
  const { profile } = useAuth();
  const { toast } = useToast();
  const moveCase = async (c: SpecialCase, to: BoardColumn) => {
    const patch = to === 'CLOSED'
      ? { status: 'RESOLVED', resolved_on: today() }
      : { status: 'OPEN', resolved_on: null, board_stage: to };
    try {
      await save.mutateAsync({ id: c.id, values: { ...patch, updated_by: profile?.full_name ?? c.updated_by } as unknown as SpecialCaseValues });
      toast({ title: `${c.order_name} → ${BOARD_COLUMNS.find((b) => b.key === to)?.title}` });
    } catch (e) { toast({ title: 'Couldn’t move the case', description: (e as Error).message, variant: 'destructive' }); }
  };
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const rtos = useMemo(() => shipments.filter((s) => s.status === 'RTO' && !s.resolved_on), [shipments]);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return cases
      .filter((c) => (tab === 'resolved' ? c.status === 'RESOLVED' : c.status === 'OPEN'))
      .filter((c) => !s || [c.order_name, c.issue, c.awb_number, c.latest_update].some((v) => v && v.toLowerCase().includes(s)));
  }, [cases, tab, q]);
  const selected = cases.find((c) => c.id === selectedId) ?? null;

  useEffect(() => {
    if (tab === 'rto' || tab === 'board') return;
    if (typeof window !== 'undefined' && window.innerWidth >= 1024 && !selected && list[0]) setSelectedId(list[0].id);
  }, [list, selected, tab]);

  const openCount = cases.filter((c) => c.status === 'OPEN').length;

  return (
    <Layout>
      <div className="space-y-5">
        <PageHeader
          title="Cases"
          description="RTOs, damaged parcels, wrong deliveries and anything else that needs follow-up"
          actions={<Button onClick={() => { setNewStage('NEW'); setCreating(true); }}><Plus /> Log a case</Button>}
        />
        <ViewTabs
          views={[{ id: 'board', label: 'Board' }, { id: 'open', label: 'Open', count: openCount }, { id: 'rto', label: 'RTO', count: rtos.length }, { id: 'resolved', label: 'Resolved' }]}
          value={tab}
          onChange={(t) => { setTab(t); setSelectedId(null); }}
        />

        {tab === 'board' ? (
          isLoading
            ? <div className="grid grid-cols-5 gap-3">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-96 rounded-xl bg-muted animate-pulse" />)}</div>
            : <CaseBoard
                cases={cases}
                staff={staff}
                onOpen={(c) => { setTab(c.status === 'RESOLVED' ? 'resolved' : 'open'); setSelectedId(c.id); }}
                onCreate={(stage) => { setNewStage(stage); setCreating(true); }}
                onMove={moveCase}
              />
        ) : tab === 'rto' ? (
          <div className="overflow-hidden rounded-xl border border-border bg-card"><RtoList shipments={rtos} /></div>
        ) : (
          <div className="grid overflow-hidden rounded-xl border border-border bg-card lg:h-[calc(100vh-15rem)] lg:min-h-[520px] lg:grid-cols-[380px_minmax(0,1fr)]">
            <div className={cn('flex min-h-0 flex-col lg:border-r lg:border-border', selected && 'hidden lg:flex')}>
              <div className="border-b border-border p-3"><SearchField value={q} onChange={setQ} placeholder="Search cases…" /></div>
              <div className="flex-1 overflow-y-auto">
                {isLoading ? (
                  <div className="space-y-2 p-3">{[0, 1, 2].map((i) => <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />)}</div>
                ) : list.length === 0 ? (
                  <EmptyState icon={LifeBuoy} title={tab === 'open' ? 'No open cases' : 'No resolved cases yet'} description={tab === 'open' ? 'Log any order that needs special handling.' : undefined} />
                ) : (
                  <ul className="divide-y divide-border">
                    {list.map((c) => (
                      <li key={c.id}>
                        <button onClick={() => setSelectedId(c.id)} className={cn('w-full px-4 py-3.5 text-left transition-colors', selectedId === c.id ? 'bg-accent' : 'hover:bg-muted/50')}>
                          <div className="flex items-center gap-2">
                            <ToneBadge tone={TYPE_TONE[c.case_type]}>{SPECIAL_CASE_TYPE_LABELS[c.case_type]}</ToneBadge>
                            <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.order_name}</span>
                            <span className="text-[11px] text-faint whitespace-nowrap">{formatDistanceToNowStrict(new Date(c.updated_at))}</span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{c.latest_update || c.issue}</p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <div className={cn('min-h-0', !selected && 'hidden lg:block')}>
              {selected ? <CaseDetail c={selected} onBack={() => setSelectedId(null)} /> : (
                <EmptyState icon={LifeBuoy} title="Pick a case" description="Select a case on the left to see its updates." className="h-full" />
              )}
            </div>
          </div>
        )}
      </div>
      <NewCaseDialog open={creating} onOpenChange={setCreating} stage={newStage} onCreated={() => { if (tab !== 'board') setTab('open'); }} />
    </Layout>
  );
}
