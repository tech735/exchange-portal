import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import {
  ArrowRight, ChevronLeft, ChevronRight, Copy, ExternalLink, Mail, MessageCircle, MoreHorizontal, Phone, Trash2, AlertTriangle, Undo2,
} from 'lucide-react';
import Layout from '@/components/Layout';
import {
  PageHeader, SectionCard, Stepper, StatusBadge, PaymentBadge, ToneBadge, KV, EmptyState, ConfirmDialog, ProductThumb, formatINR, initials,
} from '@/components/app';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { BookShipmentDialog } from '@/components/exchange/BookShipmentDialog';
import { QcDialog } from '@/components/exchange/QcDialog';
import { ActivityFeed } from '@/components/exchange/ActivityFeed';
import { useTicket, useDeleteTicket } from '@/hooks/useTickets';
import { useExchangeActions, RAZORPAY_LINKS_URL } from '@/hooks/useExchangeActions';
import { useProductPrices } from '@/hooks/useProductPrices';
import { useStaff, useQcPhotoUrls } from '@/hooks/useAppData';
import { useUser } from '@/contexts/UserContext';
import { useAccess } from '@/hooks/useAccess';
import { useToast } from '@/hooks/use-toast';
import { getExchangeStatus, slaRemaining, EXCHANGE_STEPS, REQUEST_SOURCE_LABELS } from '@/lib/exchangeStatus';
import { itemPrice } from '@/lib/exchangeMath';
import { REASON_LABELS, type ProductCatalog, type Ticket, type TicketItem } from '@/types/database';
import { useProducts } from '@/hooks/useProducts';
import { describeItem, displayPhone } from '@/lib/items';
import { cn } from '@/lib/utils';

const fmt = (d?: string | null) => (d ? format(new Date(d), 'd MMM') : undefined);
const fmtLong = (d?: string | null) => (d ? format(new Date(d), 'd MMM yyyy, h:mm a') : '—');
const AGG_LABEL: Record<string, string> = { SHIPROCKET: 'Shiprocket', ITHINK: 'iThink Logistics', SHIPDELIGHT: 'ShipDelight' };

/** Old Shopify-created tickets carry machine notes; show them as plain, useful text. */
function cleanReasonNotes(n?: string | null) {
  if (!n) return '';
  return n.split('\n').filter((l) => !/^Processed via Shopify UI/i.test(l.trim())).join('\n').trim();
}
function cleanNotes(n?: string | null) {
  if (!n) return '';
  return n.replace(/^Order fulfilled via:\s*/i, 'Original delivery: ')
    .replace(/\(AWB:\s*([^,)]+),\s*Location:[^)]*\)/gi, 'AWB $1')
    .replace(/\s*\|\s*/g, ' · ')
    .trim();
}

function ItemColumn({ label, items, tone, prices, products }: { label: string; items: TicketItem[]; tone: 'danger' | 'success'; prices?: Record<string, number>; products: ProductCatalog[] }) {
  return (
    <div className="min-w-0 flex-1 rounded-lg bg-muted/50 p-3.5">
      <p className={cn('text-[11px] font-semibold uppercase tracking-wider', tone === 'danger' ? 'text-destructive' : 'text-success')}>{label}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No items</p>
      ) : (
        <ul className="mt-2 space-y-3">
          {items.map((it, i) => {
            const p = itemPrice(it, prices);
            const d = describeItem(it, products);
            return (
              <li key={i} className="flex items-center gap-3">
                <ProductThumb src={d.image} alt={d.name} size={56} className="bg-card" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground" title={d.name}>{d.name}</p>
                  <p className="text-xs text-muted-foreground">{d.variant ? <span className="font-medium text-foreground">{d.variant}</span> : 'Size not recorded'}{it.sku ? <> · <span className="font-mono">{it.sku}</span></> : ''}</p>
                  <p className="text-xs font-medium tabular">{p === null ? <span className="text-warning">Price missing</span> : `${formatINR(p)} × ${it.qty || 1}`}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ShipmentRow({ title, agg, awb, booked, done, doneLabel, pending }: { title: string; agg?: string | null; awb?: string | null; booked?: string | null; done?: string | null; doneLabel: string; pending: string }) {
  const progress = done ? 100 : booked ? 55 : 0;
  return (
    <div className="space-y-2 py-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">{title}</p>
        <ToneBadge tone={done ? 'success' : booked ? 'info' : 'neutral'}>{done ? doneLabel : booked ? 'In transit' : 'Not booked'}</ToneBadge>
      </div>
      <p className="text-xs text-muted-foreground">
        {awb ? <>{AGG_LABEL[agg ?? ''] ?? agg ?? 'Courier'} · AWB <span className="font-mono text-foreground">{awb}</span>{booked ? ` · booked ${fmt(booked)}` : ''}</> : pending}
      </p>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${progress}%` }} /></div>
    </div>
  );
}

export default function ExchangeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { ids?: string[]; from?: string } };
  const { toast } = useToast();
  const { data: ticket, isLoading, error } = useTicket(id);
  const { data: prices } = useProductPrices();
  const { data: products = [] } = useProducts();
  const { data: staff = [] } = useStaff();
  const actions = useExchangeActions();
  const deleteTicket = useDeleteTicket();
  const { user } = useUser();
  const access = useAccess();
  const actAny = access.can('exchanges.act_any');
  const [dialog, setDialog] = useState<null | 'pay' | 'return' | 'replacement' | 'qc' | 'delete' | 'received' | 'undo'>(null);

  const ids = location.state?.ids;
  const pos = ids && id ? ids.indexOf(id) : -1;
  const neighbour = (d: -1 | 1) => (ids && pos >= 0 ? ids[pos + d] : undefined);

  const st = ticket ? getExchangeStatus(ticket) : null;
  const amounts = useMemo(() => (ticket ? actions.amountsFor(ticket) : null), [ticket, actions]);
  const photoUrls = useQcPhotoUrls(ticket?.qc_photos ?? []);

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-5 animate-pulse">
          <div className="h-8 w-64 rounded-lg bg-muted" />
          <div className="h-16 rounded-xl bg-muted" />
          <div className="grid gap-5 lg:grid-cols-[1fr_360px]"><div className="h-96 rounded-xl bg-muted" /><div className="h-96 rounded-xl bg-muted" /></div>
        </div>
      </Layout>
    );
  }
  if (error || !ticket || !st || !amounts) {
    return (
      <Layout>
        <EmptyState icon={AlertTriangle} title="Exchange not found" description="It may have been deleted, or the link is wrong." action={<Button variant="secondary" onClick={() => navigate(-1)}>Go back</Button>} />
      </Layout>
    );
  }

  const t: Ticket = ticket;
  const sla = slaRemaining(t);
  const team = st.nextAction?.team;
  const mayAct = actAny || (team === 'support' && user?.role === 'SUPPORT') || (team === 'warehouse' && user?.role === 'WAREHOUSE') || (team === 'finance' && user?.role === 'INVOICING');

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); toast({ title: ok }); setDialog(null); }
    catch (e) { toast({ title: 'Couldn’t save', description: (e as Error).message, variant: 'destructive' }); throw e; }
  };

  const primary = (() => {
    if (!mayAct) return null;
    switch (st.key) {
      case 'REQUESTED':
      case 'AWAITING_PAYMENT': return { label: 'Record payment', onClick: () => setDialog('pay') };
      case 'TO_BOOK_PICKUP': return { label: 'Book return pickup', onClick: () => setDialog('return') };
      case 'RETURN_IN_TRANSIT': return { label: 'Mark return received', onClick: () => setDialog('received') };
      case 'QC_PENDING': return { label: 'Run quality check', onClick: () => setDialog('qc') };
      case 'READY_TO_SHIP': return { label: 'Ship replacement', onClick: () => setDialog('replacement') };
      case 'SHIPPED': case 'INVOICING': case 'REFUND_DUE': return { label: 'Open in Finance', onClick: () => navigate('/finance') };
      default: return null;
    }
  })();

  const stepDates = [fmt(t.created_at), fmt(t.exchange_completed_at) ?? (st.key === 'AWAITING_PAYMENT' ? 'Link sent' : undefined),
    fmt(t.return_booked_at) ?? (st.key === 'TO_BOOK_PICKUP' ? 'Not booked' : undefined), fmt(t.return_received_at),
    fmt(t.exchange_booked_at), fmt(t.invoicing_done_at), fmt(t.closed_at)];
  const ownerName = staff.find((s) => s.id === t.assigned_to)?.full_name;

  return (
    <Layout>
      <div className="space-y-5 pb-20 md:pb-0">
        <div className="flex items-center gap-2">
          <PageHeader
            className="flex-1"
            breadcrumb={[{ label: 'Exchanges', to: access.canOpen('/exchanges') ? '/exchanges' : undefined }, { label: `${t.order_id}` }]}
            title={<span className="flex flex-wrap items-center gap-2">{t.order_id}<StatusBadge ticket={t} /><PaymentBadge ticket={t} />{st.key !== 'CLOSED' && <ToneBadge tone={sla.tone}>{sla.label}</ToneBadge>}</span>}
            description={<>
              {t.customer_name}
              {t.request_source ? ` · via ${REQUEST_SOURCE_LABELS[t.request_source]}` : ''}
              {t.request_ref ? ` (${t.request_ref})` : ''} · lodged {fmtLong(t.created_at)}
            </>}
            actions={
              <>
                {ids && pos >= 0 && (
                  <div className="hidden sm:flex items-center gap-1 mr-1">
                    <Button variant="secondary" size="icon-sm" disabled={!neighbour(-1)} onClick={() => navigate(`/exchanges/${neighbour(-1)}`, { state: location.state })} aria-label="Previous"><ChevronLeft /></Button>
                    <span className="px-1 text-xs text-muted-foreground tabular">{pos + 1} of {ids.length}</span>
                    <Button variant="secondary" size="icon-sm" disabled={!neighbour(1)} onClick={() => navigate(`/exchanges/${neighbour(1)}`, { state: location.state })} aria-label="Next"><ChevronRight /></Button>
                  </div>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="secondary" size="icon" aria-label="More"><MoreHorizontal /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(window.location.href); toast({ title: 'Link copied' }); }}><Copy className="mr-2 size-4" />Copy link</DropdownMenuItem>
                    {['RETURN_PENDING', 'RETURN_RECEIVED', 'WAREHOUSE_APPROVED', 'WAREHOUSE_DENIED', 'EXCHANGE_BOOKED'].includes(t.stage) && (actAny || user?.role === 'WAREHOUSE') && (
                      <DropdownMenuItem onClick={() => setDialog('undo')}><Undo2 className="mr-2 size-4" />Undo last step</DropdownMenuItem>
                    )}
                    {(st.key === 'REQUESTED') && mayAct && (
                      <DropdownMenuItem onClick={() => { window.open(RAZORPAY_LINKS_URL, '_blank', 'noopener'); run(() => actions.markLinkSent(t), 'Marked as payment link sent').catch(() => {}); }}>
                        <ExternalLink className="mr-2 size-4" />Send payment link (Razorpay)
                      </DropdownMenuItem>
                    )}
                    {access.can('exchanges.delete') && (<><DropdownMenuSeparator /><DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDialog('delete')}><Trash2 className="mr-2 size-4" />Delete exchange</DropdownMenuItem></>)}
                  </DropdownMenuContent>
                </DropdownMenu>
                {primary && <Button className="hidden md:inline-flex" onClick={primary.onClick}>{primary.label} <ArrowRight /></Button>}
              </>
            }
          />
        </div>

        <Stepper steps={EXCHANGE_STEPS} current={st.step} sublabels={stepDates} />

        {st.key === 'REJECTED' && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/[0.06] px-4 py-3 text-sm text-destructive">
            <p className="font-medium">Rejected at quality check</p>
            {t.qc_notes && <p className="mt-0.5 text-destructive/90">{t.qc_notes}</p>}
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-5">
            <SectionCard title="Items" action={<ToneBadge tone="neutral" dot={false}>{REASON_LABELS[t.reason_code]}</ToneBadge>}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <ItemColumn label="Returning" items={t.return_items} tone="danger" prices={prices as Record<string, number>} products={products} />
                <ArrowRight className="hidden sm:block size-5 shrink-0 text-faint" />
                <ItemColumn label="Sending" items={t.exchange_items} tone="success" prices={prices as Record<string, number>} products={products} />
              </div>
              {cleanReasonNotes(t.reason_notes) && <p className="mt-3 text-sm text-muted-foreground whitespace-pre-line">“{cleanReasonNotes(t.reason_notes)}”</p>}
              {cleanNotes(t.notes) && <p className="mt-2 text-xs text-muted-foreground whitespace-pre-line">{cleanNotes(t.notes)}</p>}
            </SectionCard>

            <SectionCard title="Payment">
              <KV label="Return value">− {formatINR(amounts.returnValue)}</KV>
              <KV label="Replacement value">+ {formatINR(amounts.exchangeValue)}</KV>
              <KV label="Delivery charge">+ {formatINR(amounts.deliveryCharge)}</KV>
              <div className="my-2 h-px bg-border" />
              <KV label={amounts.net >= 0 ? 'Customer pays' : 'Refund due'} strong>{formatINR(Math.abs(amounts.net))}</KV>
              {amounts.missingPrices.length > 0 && (
                <p className="mt-2 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">Missing prices for {amounts.missingPrices.join(', ')}. Sync the catalogue or check the SKU.</p>
              )}
              {t.is_paid ? (
                <p className="mt-3 rounded-lg bg-success/10 px-3 py-2 text-xs font-medium text-success">
                  {t.refund_amount > 0
                    ? `Refund of ${formatINR(t.refund_amount)} ${t.refund_status === 'PROCESSED' ? 'sent' : 'due'}`
                    : `Settled · ${formatINR(t.amount_collected)} collected${t.exchange_completed_at ? ` on ${fmtLong(t.exchange_completed_at)}` : ''}`}
                </p>
              ) : st.key === 'AWAITING_PAYMENT' ? (
                <p className="mt-3 rounded-lg bg-warning/10 px-3 py-2 text-xs font-medium text-warning">Payment link sent. Waiting for the customer.</p>
              ) : null}
            </SectionCard>

            <SectionCard title="Shipments">
              <div className="divide-y divide-border">
                <ShipmentRow title="Return pickup" agg={t.return_aggregator} awb={t.return_awb} booked={t.return_booked_at} done={t.return_received_at} doneLabel="Received" pending="Book once payment is settled" />
                <ShipmentRow title="Replacement" agg={t.exchange_aggregator} awb={t.exchange_awb} booked={t.exchange_booked_at} done={t.closed_at} doneLabel="Delivered" pending="Ships after quality check passes" />
              </div>
            </SectionCard>

            {t.qc_decision && (
              <SectionCard title="Quality check" action={<ToneBadge tone={t.qc_decision === 'APPROVED' ? 'success' : 'danger'}>{t.qc_decision === 'APPROVED' ? 'Approved' : 'Rejected'}</ToneBadge>}>
                {t.qc_checklist && (
                  <ul className="grid gap-1.5 sm:grid-cols-2">
                    {Object.entries(t.qc_checklist).map(([k, v]) => (
                      <li key={k} className="flex items-center gap-2 text-sm"><span className={cn('size-1.5 rounded-full', v ? 'bg-success' : 'bg-destructive')} />{k}</li>
                    ))}
                  </ul>
                )}
                {t.qc_notes && <p className="mt-3 text-sm text-muted-foreground">{t.qc_notes}</p>}
                {(photoUrls.data ?? []).length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {photoUrls.data!.map((u, i) => (
                      <a key={u} href={u} target="_blank" rel="noreferrer" className="block size-20 overflow-hidden rounded-lg border border-border">
                        <img src={u} alt={`QC photo ${i + 1}`} className="size-full object-cover transition-transform duration-200 hover:scale-105" />
                      </a>
                    ))}
                  </div>
                )}
              </SectionCard>
            )}
          </div>

          <div className="min-w-0 space-y-5">
            <SectionCard title="Customer">
              <div className="flex items-center gap-3 pb-2">
                <span className="grid size-10 place-items-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">{initials(t.customer_name)}</span>
                <div className="min-w-0">
                  <p className="truncate font-medium">{t.customer_name}</p>
                  <div className="mt-1 flex gap-1.5">
                    <Button asChild variant="secondary" size="icon-sm"><a href={`tel:${t.customer_phone}`} aria-label="Call"><Phone /></a></Button>
                    <Button asChild variant="secondary" size="icon-sm"><a href={`https://wa.me/${t.customer_phone.replace(/\D/g, '').replace(/^(\d{10})$/, '91$1')}`} target="_blank" rel="noreferrer" aria-label="WhatsApp"><MessageCircle /></a></Button>
                    {t.customer_email && <Button asChild variant="secondary" size="icon-sm"><a href={`mailto:${t.customer_email}`} aria-label="Email"><Mail /></a></Button>}
                  </div>
                </div>
              </div>
              <KV label="Phone">{displayPhone(t.customer_phone) || <span className="text-muted-foreground">Not recorded</span>}</KV>
              {t.customer_email && <KV label="Email">{t.customer_email}</KV>}
              {t.student_name && t.student_name !== 'N/A' && <KV label="Student">{t.student_name}{t.student_grade ? ` · ${t.student_grade}${t.student_section ? `-${t.student_section}` : ''}` : ''}</KV>}
              {t.school_name && t.school_name !== 'Unknown' && <KV label="School">{t.school_name}</KV>}
            </SectionCard>

            <SectionCard title="Request">
              <KV label="Came in via">{t.request_source ? REQUEST_SOURCE_LABELS[t.request_source] : <span className="text-muted-foreground">Not recorded</span>}</KV>
              {t.request_ref && <KV label="Reference">{t.request_ref}</KV>}
              {t.request_received_at && <KV label="Received">{fmtLong(t.request_received_at)}</KV>}
              <div className="pt-2">
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">Owner</p>
                <Select
                  value={t.assigned_to ?? 'none'}
                  onValueChange={(v) => run(() => actions.update.mutateAsync({ id: t.id, assigned_to: v === 'none' ? null : v, eventType: 'UPDATED' }), v === 'none' ? 'Owner removed' : 'Owner updated').catch(() => {})}
                >
                  <SelectTrigger aria-label="Owner"><SelectValue placeholder="Unassigned">{ownerName ?? 'Unassigned'}</SelectValue></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name || s.email}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </SectionCard>

            <SectionCard title="Activity">
              <ActivityFeed ticketId={t.id} />
            </SectionCard>
          </div>
        </div>
      </div>

      {/* Phone: sticky next action */}
      {primary && (
        <div className="md:hidden fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 border-t border-border bg-card/95 px-4 py-3 backdrop-blur">
          <Button className="w-full" size="lg" onClick={primary.onClick}>{primary.label} <ArrowRight /></Button>
        </div>
      )}

      <ConfirmDialog
        open={dialog === 'pay'}
        onOpenChange={(o) => !o && setDialog(null)}
        title={amounts.net >= 0 ? `Record payment of ${formatINR(amounts.net)}?` : `Record refund due of ${formatINR(-amounts.net)}?`}
        description="The exchange moves to the warehouse for return pickup."
        confirmLabel={amounts.net >= 0 ? 'Record payment' : 'Record refund due'}
        loading={actions.pending}
        onConfirm={() => run(() => actions.settlePayment(t), amounts.net >= 0 ? 'Payment recorded' : 'Refund marked as due').catch(() => {})}
      />
      <ConfirmDialog
        open={dialog === 'undo'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Undo the last step?"
        description={({
          RETURN_PENDING: 'Removes the pickup booking (courier and AWB). It goes back to “To book pickup”.',
          RETURN_RECEIVED: 'Undoes “received”. It goes back to “Return in transit”.',
          WAREHOUSE_APPROVED: 'Clears the QC result, notes and photos. It goes back to “QC pending”.',
          WAREHOUSE_DENIED: 'Clears the QC result, notes and photos. It goes back to “QC pending”.',
          EXCHANGE_BOOKED: 'Removes the replacement booking (courier and AWB). It goes back to “Ready to ship”.',
        } as Record<string, string>)[t.stage]}
        confirmLabel="Undo step"
        loading={actions.pending}
        onConfirm={() => run(() => actions.stepBack(t), 'Step undone').catch(() => {})}
      />
      <ConfirmDialog
        open={dialog === 'received'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Mark the return as received?"
        description={t.return_awb ? `AWB ${t.return_awb}. It moves to quality check.` : 'It moves to quality check.'}
        confirmLabel="Mark received"
        loading={actions.pending}
        onConfirm={() => run(() => actions.markReceived(t), 'Return received').catch(() => {})}
      />
      <ConfirmDialog
        open={dialog === 'delete'}
        onOpenChange={(o) => !o && setDialog(null)}
        destructive
        title={`Delete ${t.order_id}?`}
        description="This permanently removes the exchange and its history."
        confirmLabel="Delete"
        loading={deleteTicket.isPending}
        onConfirm={async () => { await deleteTicket.mutateAsync(t.id); toast({ title: 'Exchange deleted' }); navigate('/exchanges'); }}
      />
      <BookShipmentDialog
        open={dialog === 'return' || dialog === 'replacement'}
        onOpenChange={(o) => !o && setDialog(null)}
        kind={dialog === 'replacement' ? 'replacement' : 'return'}
        orderLabel={`${t.order_id}`}
        context={t.notes}
        onSubmit={(agg, awb) => dialog === 'replacement'
          ? run(() => actions.bookReplacement(t, agg, awb), 'Replacement shipment booked')
          : run(() => actions.bookReturn(t, agg, awb), 'Return pickup booked')}
      />
      <QcDialog
        ticket={t}
        open={dialog === 'qc'}
        onOpenChange={(o) => !o && setDialog(null)}
        onSubmit={(d, notes, checklist, photos) => run(() => actions.recordQc(t, d, notes, checklist, photos), d === 'APPROVED' ? 'QC approved' : 'Return rejected')}
      />
    </Layout>
  );
}

