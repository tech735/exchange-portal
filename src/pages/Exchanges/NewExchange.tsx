import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { differenceInCalendarDays, format } from 'date-fns';
import { ArrowRight, Check, Loader2, Mail, MessageCircle, Minus, Phone, Plus, Search, LifeBuoy, MoreHorizontal, Trash2 } from 'lucide-react';
import Layout from '@/components/Layout';
import { PageHeader, SectionCard, ToneBadge, KV, formatINR } from '@/components/app';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ProductCombobox, SizeChips, productForSku, toTicketItem, type SizeOption } from '@/components/exchange/ProductPicker';
import { shopifyService, type ShopifyOrder } from '@/services/shopify';
import { useProducts } from '@/hooks/useProducts';
import { useCreateTicket } from '@/hooks/useTickets';
import { useAppSettings } from '@/hooks/useAppData';
import { useToast } from '@/hooks/use-toast';
import { useExchangeActions, RAZORPAY_LINKS_URL } from '@/hooks/useExchangeActions';
import { REQUEST_SOURCE_LABELS, type RequestSource } from '@/lib/exchangeStatus';
import { REASON_LABELS, type ProductCatalog, type ReasonCode, type Ticket, type TicketItem } from '@/types/database';
import { cn } from '@/lib/utils';

const SOURCE_ICONS: Record<RequestSource, React.ElementType> = { EMAIL: Mail, WHATSAPP: MessageCircle, CALL: Phone, HELPDESK: LifeBuoy, OTHER: MoreHorizontal };

interface ReturnLine {
  key: string;
  selected: boolean;
  name: string;
  sku: string;
  size: string;
  maxQty: number;
  qty: number;
  price: number | null;
  reason: ReasonCode;
  // replacement
  repProduct?: ProductCatalog;
  repSize?: SizeOption;
  repDifferent?: boolean;
}

type Collect = 'LINK' | 'PAID' | 'LATER';

function Stepper({ value, onChange, max }: { value: number; onChange: (n: number) => void; max: number }) {
  return (
    <div className="inline-flex h-8 items-center rounded-lg border border-input bg-card">
      <button type="button" aria-label="Less" className="grid h-full w-8 place-items-center text-muted-foreground hover:text-foreground disabled:opacity-40" disabled={value <= 1} onClick={() => onChange(value - 1)}><Minus className="size-3.5" /></button>
      <span className="w-6 text-center text-sm font-medium tabular">{value}</span>
      <button type="button" aria-label="More" className="grid h-full w-8 place-items-center text-muted-foreground hover:text-foreground disabled:opacity-40" disabled={value >= max} onClick={() => onChange(value + 1)}><Plus className="size-3.5" /></button>
    </div>
  );
}

function SectionNumber({ n, done }: { n: number; done: boolean }) {
  return (
    <span className={cn('grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold', done ? 'bg-success text-white' : 'bg-primary text-primary-foreground')}>
      {done ? <Check className="size-3.5" strokeWidth={3} /> : n}
    </span>
  );
}

export default function NewExchange() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { toast } = useToast();
  const { data: settings } = useAppSettings();
  const { data: products = [] } = useProducts();
  const create = useCreateTicket();
  const { settlePayment, markLinkSent } = useExchangeActions();

  // 1 · Request
  const [source, setSource] = useState<RequestSource | null>(null);
  const [ref, setRef] = useState('');
  const [receivedAt, setReceivedAt] = useState(() => format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  // Order
  const [orderQuery, setOrderQuery] = useState(params.get('order') ?? '');
  const [order, setOrder] = useState<ShopifyOrder | null>(null);
  const [lookup, setLookup] = useState<'idle' | 'loading' | 'error'>('idle');
  const [lookupErr, setLookupErr] = useState('');
  const [manual, setManual] = useState(false);
  const [customer, setCustomer] = useState({ order_id: '', name: '', phone: '', email: '' });
  const [school, setSchool] = useState({ student: '', grade: '', section: '', school: '' });
  const [showSchool, setShowSchool] = useState(false);
  // 2/3 · Items
  const [lines, setLines] = useState<ReturnLine[]>([]);
  const [manualReturn, setManualReturn] = useState<{ product?: ProductCatalog; size?: SizeOption }>({});
  const [reasonNotes, setReasonNotes] = useState('');
  // 4 · Payment
  const [delivery, setDelivery] = useState<number | null>(null);
  const [collect, setCollect] = useState<Collect>('LINK');
  const [paidRef, setPaidRef] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const findOrder = async (q = orderQuery) => {
    const id = q.trim().replace(/^#/, '');
    if (!id) return;
    setLookup('loading'); setLookupErr('');
    try {
      const o = await shopifyService.getOrder(id);
      setOrder(o);
      setManual(false);
      setCustomer({
        order_id: o.name.replace(/^#/, ''),
        name: [o.customer?.first_name, o.customer?.last_name].filter(Boolean).join(' ') || [o.shipping_address?.first_name, o.shipping_address?.last_name].filter(Boolean).join(' '),
        phone: o.phone || o.customer?.phone || o.shipping_address?.phone || '',
        email: o.email || o.customer?.email || '',
      });
      setLines(o.line_items.map((li) => ({
        key: String(li.id), selected: o.line_items.length === 1, name: li.title, sku: li.sku, size: li.variant_title || '', maxQty: li.quantity, qty: 1,
        price: Number(li.price) || null, reason: 'WRONG_SIZE',
        repProduct: undefined, repSize: undefined,
      })));
      setLookup('idle');
    } catch (e) {
      setLookup('error'); setLookupErr((e as Error).message || 'Order not found');
    }
  };

  // Deep link from Orders: /exchanges/new?order=1256
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (params.get('order')) findOrder(params.get('order')!); }, []);

  // Default the replacement product to the same catalogue product once products load.
  useEffect(() => {
    if (!products.length) return;
    setLines((ls) => ls.map((l) => (l.repProduct || l.repDifferent ? l : { ...l, repProduct: productForSku(products, l.sku) })));
  }, [products, order]);

  const deliveredAt = order?.fulfillments?.find((f) => f.status === 'success')?.created_at || order?.created_at;
  const windowDays = settings?.exchange_policy.window_days ?? 10;
  const daysLeft = deliveredAt ? windowDays - differenceInCalendarDays(new Date(), new Date(deliveredAt)) : null;

  const chosen = lines.filter((l) => l.selected);
  const firstReason = chosen[0]?.reason ?? 'WRONG_SIZE';
  const freeReason = settings?.fees.free_reasons.includes(firstReason) ?? false;
  const deliveryCharge = delivery ?? (freeReason ? 0 : settings?.fees.delivery_charge ?? 150);

  const returnItems: TicketItem[] = chosen.map((l) => ({ sku: l.sku, product_name: l.name, size: l.size, qty: l.qty, ...(l.price !== null ? { price: l.price } : {}) }));
  const exchangeItems: TicketItem[] = chosen.filter((l) => l.repProduct && l.repSize).map((l) => toTicketItem(l.repProduct!, l.repSize!, l.qty));
  const returnValue = returnItems.reduce((s, i) => s + (i.price ?? 0) * i.qty, 0);
  const exchangeValue = exchangeItems.reduce((s, i) => s + (i.price ?? 0) * i.qty, 0);
  const net = exchangeValue - returnValue + deliveryCharge;

  const customerOk = !!(customer.order_id.trim() && customer.name.trim() && customer.phone.trim());
  const step1 = !!source && customerOk;
  const step2 = chosen.length > 0;
  const step3 = step2 && chosen.every((l) => l.repProduct && l.repSize);
  const canSubmit = step1 && step2 && step3 && !submitting;

  const missing = useMemo(() => {
    const m: string[] = [];
    if (!source) m.push('how the customer reached us');
    if (!customerOk) m.push('order and customer details');
    if (!step2) m.push('at least one item coming back');
    if (step2 && !step3) m.push('a replacement size for each item');
    return m;
  }, [source, customerOk, step2, step3]);

  const setLine = (key: string, patch: Partial<ReturnLine>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const addManualReturn = () => {
    const { product, size } = manualReturn;
    if (!product || !size) return;
    setLines((ls) => [...ls, {
      key: `m-${Date.now()}`, selected: true, name: product.product_name, sku: size.sku || product.sku, size: size.size, maxQty: 10, qty: 1,
      price: size.price, reason: 'WRONG_SIZE', repProduct: product,
    }]);
    setManualReturn({});
  };

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const perItemReasons = chosen.length > 1 ? chosen.map((l) => `${l.name} (${l.size}): ${REASON_LABELS[l.reason]}`).join('; ') : '';
      const fulfil = order?.fulfillments?.length
        ? `Original delivery: ${order.fulfillments.map((f) => `${f.tracking_company || 'Courier'} AWB ${f.tracking_number || '—'}`).join(' | ')}`
        : '';
      const ticket = await create.mutateAsync({
        order_id: customer.order_id.trim(),
        customer_name: customer.name.trim(),
        customer_phone: customer.phone.trim(),
        customer_email: customer.email.trim() || undefined,
        student_name: school.student || undefined,
        student_grade: school.grade || undefined,
        student_section: school.section || undefined,
        school_name: school.school || undefined,
        reason_code: firstReason,
        reason_notes: [reasonNotes.trim(), perItemReasons].filter(Boolean).join('\n') || undefined,
        return_items: returnItems,
        exchange_items: exchangeItems,
        notes: [notes.trim(), collect === 'PAID' && paidRef ? `Payment reference: ${paidRef}` : '', fulfil].filter(Boolean).join('\n') || undefined,
        request_source: source!,
        request_ref: ref.trim() || undefined,
        request_received_at: receivedAt ? new Date(receivedAt).toISOString() : undefined,
        delivery_charge: deliveryCharge,
      });
      const created = { ...ticket, return_items: returnItems, exchange_items: exchangeItems, delivery_charge: deliveryCharge, reason_code: firstReason } as Ticket;
      if (collect === 'PAID') await settlePayment(created);
      if (collect === 'LINK') { await markLinkSent(created); window.open(RAZORPAY_LINKS_URL, '_blank', 'noopener'); }
      toast({ title: `Exchange #${customer.order_id} lodged`, description: collect === 'PAID' ? 'Payment recorded · sent to the warehouse.' : collect === 'LINK' ? 'Create the payment link in Razorpay (opened in a new tab).' : 'Waiting on payment.' });
      navigate(`/exchanges/${ticket.id}`, { replace: true });
    } catch (e) {
      toast({ title: 'Couldn’t lodge the exchange', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const Summary = (
    <SectionCard title="Summary" className="lg:sticky lg:top-24">
      <KV label={`Return value (${chosen.reduce((s, l) => s + l.qty, 0)} item${chosen.length === 1 ? '' : 's'})`}>− {formatINR(returnValue)}</KV>
      <KV label="Replacement value">+ {formatINR(exchangeValue)}</KV>
      <div className="flex items-center justify-between py-1.5 text-sm">
        <span className="text-muted-foreground">Delivery charge{freeReason && delivery === null ? ' (free for this reason)' : ''}</span>
        <div className="inline-flex h-8 items-center rounded-lg border border-input">
          <button type="button" aria-label="Lower" className="grid h-full w-7 place-items-center text-muted-foreground hover:text-foreground" onClick={() => setDelivery(Math.max(0, deliveryCharge - 50))}><Minus className="size-3.5" /></button>
          <span className="w-12 text-center text-sm font-medium tabular">{formatINR(deliveryCharge)}</span>
          <button type="button" aria-label="Raise" className="grid h-full w-7 place-items-center text-muted-foreground hover:text-foreground" onClick={() => setDelivery(deliveryCharge + 50)}><Plus className="size-3.5" /></button>
        </div>
      </div>
      <div className="my-2 h-px bg-border" />
      <KV label={net >= 0 ? 'Customer pays' : 'Refund due'} strong>{formatINR(Math.abs(net))}</KV>

      <p className="mt-4 mb-2 text-xs font-medium text-muted-foreground">Payment</p>
      <div className="space-y-2" role="radiogroup">
        {([['LINK', 'Send a payment link', 'Opens Razorpay to create the link'], ['PAID', 'Already paid', 'e.g. UPI transfer you can see'], ['LATER', 'Decide later', 'Lodge now, collect later']] as [Collect, string, string][]).map(([k, l, d]) => (
          <button key={k} type="button" role="radio" aria-checked={collect === k} onClick={() => setCollect(k)}
            className={cn('flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors duration-150', collect === k ? 'border-primary bg-accent' : 'border-input hover:bg-muted')}>
            <span className={cn('mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border', collect === k ? 'border-primary' : 'border-input')}>{collect === k && <span className="size-2 rounded-full bg-primary" />}</span>
            <span><span className="block text-sm font-medium">{l}</span><span className="block text-xs text-muted-foreground">{d}</span></span>
          </button>
        ))}
      </div>
      {collect === 'PAID' && <Input className="mt-2" placeholder="Payment reference (optional)" value={paidRef} onChange={(e) => setPaidRef(e.target.value)} />}

      <Button className="mt-4 w-full" size="lg" disabled={!canSubmit} onClick={submit}>
        {submitting ? <><Loader2 className="animate-spin" /> Lodging…</> : <>Lodge exchange <ArrowRight /></>}
      </Button>
      {missing.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Still needed: {missing.join(', ')}.</p>}
    </SectionCard>
  );

  return (
    <Layout>
      <div className="space-y-5 pb-24 lg:pb-0">
        <PageHeader
          breadcrumb={[{ label: 'Exchanges', to: '/exchanges' }, { label: 'New exchange' }]}
          title="New exchange"
          description="Lodge a request that came in by email, WhatsApp, phone or the helpdesk."
          actions={<Button variant="ghost" onClick={() => navigate(-1)}>Cancel</Button>}
        />

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-5">
            {/* 1 · Request & order */}
            <SectionCard title={<span className="flex items-center gap-2.5"><SectionNumber n={1} done={step1} />Request & order</span>}>
              <div className="space-y-5">
                <div>
                  <Label className="mb-2 block">How did the customer reach us?</Label>
                  <div className="flex flex-wrap gap-2" role="radiogroup">
                    {(Object.keys(REQUEST_SOURCE_LABELS) as RequestSource[]).map((s) => {
                      const Icon = SOURCE_ICONS[s];
                      const on = source === s;
                      return (
                        <button key={s} type="button" role="radio" aria-checked={on} onClick={() => setSource(s)}
                          className={cn('inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-all duration-150 active:scale-[0.97]',
                            on ? 'border-primary bg-accent text-accent-foreground' : 'border-input bg-card text-foreground hover:bg-muted')}>
                          <Icon className={cn('size-4', on ? 'text-primary' : 'text-faint')} />{REQUEST_SOURCE_LABELS[s]}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
                  <div className="space-y-1.5">
                    <Label htmlFor="ref">Reference <span className="font-normal text-muted-foreground">(optional)</span></Label>
                    <Input id="ref" value={ref} onChange={(e) => setRef(e.target.value)} placeholder={source === 'HELPDESK' ? 'Helpdesk ticket, e.g. HD-48211' : source === 'EMAIL' ? 'Email subject or thread' : 'e.g. WhatsApp chat 21 Oct'} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="received">Received at</Label>
                    <Input id="received" type="datetime-local" value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} />
                  </div>
                </div>

                <div className="h-px bg-border" />

                {!manual ? (
                  <div className="space-y-3">
                    <Label htmlFor="order">Shopify order</Label>
                    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); findOrder(); }}>
                      <div className="relative flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
                        <Input id="order" className="pl-9" value={orderQuery} onChange={(e) => setOrderQuery(e.target.value)} placeholder="Order number, e.g. K-2627-1256" />
                      </div>
                      <Button type="submit" variant="secondary" disabled={!orderQuery.trim() || lookup === 'loading'}>{lookup === 'loading' ? <Loader2 className="animate-spin" /> : 'Find'}</Button>
                    </form>
                    {lookup === 'error' && <p className="text-sm text-destructive">{lookupErr}. Check the number, or enter the details manually.</p>}
                    {order && (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-muted/60 px-3 py-2.5 text-sm animate-fade-in">
                        <span className="font-medium">{order.name}</span>
                        <span className="text-muted-foreground">placed {format(new Date(order.created_at), 'd MMM')}</span>
                        {daysLeft !== null && (daysLeft >= 0
                          ? <ToneBadge tone="success">Eligible · {daysLeft}d left</ToneBadge>
                          : <ToneBadge tone="warning">Outside the {windowDays}-day window</ToneBadge>)}
                        <button className="ml-auto text-xs font-medium text-primary hover:underline" onClick={() => { setOrder(null); setLines([]); setOrderQuery(''); }}>Change</button>
                      </div>
                    )}
                    {!order && <button className="text-sm font-medium text-primary hover:underline" onClick={() => { setManual(true); setLines([]); }}>No Shopify order? Enter details manually</button>}
                  </div>
                ) : (
                  <button className="text-sm font-medium text-primary hover:underline" onClick={() => setManual(false)}>← Find a Shopify order instead</button>
                )}

                {(order || manual) && (
                  <div className="grid gap-3 sm:grid-cols-2 animate-fade-in">
                    {manual && (
                      <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="oid">Order number</Label><Input id="oid" value={customer.order_id} onChange={(e) => setCustomer((c) => ({ ...c, order_id: e.target.value }))} /></div>
                    )}
                    <div className="space-y-1.5"><Label htmlFor="cname">Customer name</Label><Input id="cname" value={customer.name} onChange={(e) => setCustomer((c) => ({ ...c, name: e.target.value }))} /></div>
                    <div className="space-y-1.5"><Label htmlFor="cphone">Phone</Label><Input id="cphone" inputMode="tel" value={customer.phone} onChange={(e) => setCustomer((c) => ({ ...c, phone: e.target.value }))} /></div>
                    <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="cemail">Email <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="cemail" type="email" value={customer.email} onChange={(e) => setCustomer((c) => ({ ...c, email: e.target.value }))} /></div>
                    <div className="sm:col-span-2">
                      {!showSchool ? (
                        <button className="text-sm font-medium text-primary hover:underline" onClick={() => setShowSchool(true)}>+ Add student / school details</button>
                      ) : (
                        <div className="grid gap-3 sm:grid-cols-4 animate-fade-in">
                          <div className="space-y-1.5 sm:col-span-2"><Label>Student</Label><Input value={school.student} onChange={(e) => setSchool((s) => ({ ...s, student: e.target.value }))} /></div>
                          <div className="space-y-1.5"><Label>Grade</Label><Input value={school.grade} onChange={(e) => setSchool((s) => ({ ...s, grade: e.target.value }))} /></div>
                          <div className="space-y-1.5"><Label>Section</Label><Input value={school.section} onChange={(e) => setSchool((s) => ({ ...s, section: e.target.value }))} /></div>
                          <div className="space-y-1.5 sm:col-span-4"><Label>School</Label><Input value={school.school} onChange={(e) => setSchool((s) => ({ ...s, school: e.target.value }))} /></div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </SectionCard>

            {/* 2 · Items coming back */}
            <SectionCard title={<span className="flex items-center gap-2.5"><SectionNumber n={2} done={step2} />What’s coming back?</span>} className={cn(!(order || manual) && 'opacity-60')}>
              {!(order || manual) ? (
                <p className="text-sm text-muted-foreground">Find the order first.</p>
              ) : (
                <div className="space-y-1">
                  {lines.length === 0 && order && <p className="text-sm text-muted-foreground">This order has no line items.</p>}
                  {lines.map((l) => (
                    <div key={l.key} className={cn('flex flex-wrap items-center gap-3 border-b border-border py-3 last:border-0', !l.selected && 'opacity-70')}>
                      <Checkbox checked={l.selected} onCheckedChange={(v) => setLine(l.key, { selected: v === true })} aria-label={`Return ${l.name}`} />
                      <div className="grid size-11 place-items-center rounded-md bg-muted text-[10px] text-faint">IMG</div>
                      <div className="min-w-0 flex-1 basis-40">
                        <p className="truncate text-sm font-medium">{l.name}</p>
                        <p className="text-xs text-muted-foreground">{l.size ? `Size ${l.size} · ` : ''}{l.price !== null ? formatINR(l.price) : 'no price'} · ordered {l.maxQty}</p>
                      </div>
                      {l.selected && (
                        <div className="flex w-full items-center gap-2 sm:w-auto">
                          <Stepper value={l.qty} max={l.maxQty} onChange={(n) => setLine(l.key, { qty: n })} />
                          <Select value={l.reason} onValueChange={(v) => setLine(l.key, { reason: v as ReasonCode })}>
                            <SelectTrigger className="h-8 w-full sm:w-[170px] text-[13px]" aria-label="Reason"><SelectValue /></SelectTrigger>
                            <SelectContent>{Object.entries(REASON_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                          </Select>
                          {l.key.startsWith('m-') && <Button variant="ghost" size="icon-sm" aria-label="Remove" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}><Trash2 /></Button>}
                        </div>
                      )}
                    </div>
                  ))}
                  {manual && (
                    <div className="space-y-3 rounded-lg border border-dashed border-input p-3">
                      <p className="text-xs font-medium text-muted-foreground">Add an item the customer is returning</p>
                      <ProductCombobox value={manualReturn.product} onChange={(p) => setManualReturn({ product: p })} />
                      {manualReturn.product && <SizeChips product={manualReturn.product} value={manualReturn.size?.size} onChange={(o) => setManualReturn((m) => ({ ...m, size: o }))} />}
                      <Button size="sm" variant="secondary" disabled={!manualReturn.product || !manualReturn.size} onClick={addManualReturn}><Plus /> Add item</Button>
                    </div>
                  )}
                  <div className="space-y-1.5 pt-3">
                    <Label htmlFor="rnotes">What did the customer say? <span className="font-normal text-muted-foreground">(optional)</span></Label>
                    <Textarea id="rnotes" rows={2} value={reasonNotes} onChange={(e) => setReasonNotes(e.target.value)} placeholder="e.g. Too tight on the shoulders, wants one size up" />
                  </div>
                </div>
              )}
            </SectionCard>

            {/* 3 · Replacements */}
            <SectionCard title={<span className="flex items-center gap-2.5"><SectionNumber n={3} done={step3} />What should we send instead?</span>} className={cn(!step2 && 'opacity-60')}>
              {!step2 ? (
                <p className="text-sm text-muted-foreground">Choose the items coming back first.</p>
              ) : (
                <div className="space-y-5">
                  {chosen.map((l) => (
                    <div key={l.key} className="space-y-2.5">
                      <div className="flex items-center gap-2">
                        <p className="min-w-0 flex-1 truncate text-sm font-medium">{l.repProduct?.product_name ?? l.name}</p>
                        <span className="text-xs text-muted-foreground">for size {l.size || '—'} × {l.qty}</span>
                      </div>
                      {l.repDifferent || !l.repProduct ? (
                        <ProductCombobox value={l.repProduct} onChange={(p) => setLine(l.key, { repProduct: p, repSize: undefined, repDifferent: true })} placeholder="Choose the replacement product…" />
                      ) : null}
                      <SizeChips product={l.repProduct} value={l.repSize?.size} current={l.repDifferent ? undefined : l.size} onChange={(o) => setLine(l.key, { repSize: o })} />
                      <div className="flex flex-wrap items-center gap-3 text-xs">
                        {l.repSize && (
                          <span className={cn((l.repSize.price ?? 0) === (l.price ?? 0) ? 'text-success' : 'text-muted-foreground')}>
                            {l.repSize.price === null ? 'No price in catalogue' : (l.repSize.price ?? 0) === (l.price ?? 0) ? 'Same price · nothing extra for the item' : `${formatINR(l.repSize.price)} (difference ${formatINR((l.repSize.price ?? 0) - (l.price ?? 0))})`}
                          </span>
                        )}
                        <button className="font-medium text-primary hover:underline" onClick={() => setLine(l.key, { repDifferent: !l.repDifferent, repSize: undefined, repProduct: l.repDifferent ? productForSku(products, l.sku) : l.repProduct })}>
                          {l.repDifferent ? 'Use the same product' : 'Different product…'}
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="space-y-1.5">
                    <Label htmlFor="notes">Internal note <span className="font-normal text-muted-foreground">(optional)</span></Label>
                    <Textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything the warehouse should know" />
                  </div>
                </div>
              )}
            </SectionCard>
          </div>

          <div className="hidden lg:block">{Summary}</div>
        </div>

        {/* Phone/tablet: summary at the bottom of the flow + sticky submit */}
        <div className="lg:hidden">{Summary}</div>
      </div>

      <div className="lg:hidden fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] md:bottom-0 z-30 flex items-center gap-3 border-t border-border bg-card/95 px-4 py-3 backdrop-blur">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{net >= 0 ? 'Customer pays' : 'Refund due'}</p>
          <p className="font-heading text-lg font-semibold tabular">{formatINR(Math.abs(net))}</p>
        </div>
        <Button size="lg" disabled={!canSubmit} onClick={submit}>{submitting ? <Loader2 className="animate-spin" /> : <>Lodge <ArrowRight /></>}</Button>
      </div>
      {missing.length > 0 && <span className="sr-only" aria-live="polite">Still needed: {missing.join(', ')}</span>}
    </Layout>
  );
}
