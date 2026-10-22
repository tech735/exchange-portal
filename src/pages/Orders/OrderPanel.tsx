import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowRight, ArrowUpRight, X } from 'lucide-react';
import { ProductThumb } from '@/components/app';
import { useProducts } from '@/hooks/useProducts';
import { describeItem } from '@/lib/items';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { KV, ToneBadge, initials } from '@/components/app';
import { cn } from '@/lib/utils';
import {
  customerEmail,
  customerName,
  customerPhone,
  deliveredAt,
  eligibility,
  fulfilledAt,
  fulfillmentPill,
  money,
  orderNumber,
  paymentPill,
  shipTo,
  shopifyAdminUrl,
  type OrderRecord,
} from './orderUtils';

function PanelSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

export function OrderPanel({
  order,
  windowDays,
  onClose,
  showClose = true,
  className,
}: {
  order: OrderRecord;
  windowDays: number;
  onClose: () => void;
  /** The Sheet renders its own close button, so the inline one is hidden there. */
  showClose?: boolean;
  className?: string;
}) {
  const { data: products = [] } = useProducts();
  const navigate = useNavigate();
  const pay = paymentPill(order);
  const ful = fulfillmentPill(order);
  const elig = eligibility(order, windowDays);
  const delivered = deliveredAt(order);
  const shipped = fulfilledAt(order);
  const adminUrl = shopifyAdminUrl(order);
  const address = shipTo(order);
  const name = customerName(order);
  const email = customerEmail(order);
  const phone = customerPhone(order);
  const fulfillments = (order.fulfillments ?? []).filter((f) => f.tracking_number || f.tracking_company);

  const startExchange = () => navigate(`/exchanges/new?order=${encodeURIComponent(orderNumber(order))}`);

  const startButton = (
    <Button className="w-full" size="lg" onClick={startExchange} disabled={!elig.eligible}>
      Start exchange
      <ArrowRight />
    </Button>
  );

  return (
    <div className={cn('flex flex-col gap-5', className)}>
      {/* Header */}
      <div className="space-y-3">
        <div className={cn('flex items-start gap-3', !showClose && 'pr-8')}>
          <h2 className="min-w-0 flex-1 truncate font-heading text-lg font-semibold text-foreground">Order {orderNumber(order)}</h2>
          {adminUrl && (
            <a
              href={adminUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-primary hover:underline"
            >
              Open in Shopify
              <ArrowUpRight className="size-3.5" aria-hidden />
            </a>
          )}
          {showClose && (
            <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close order panel" className="-mr-1.5 -mt-0.5 shrink-0">
              <X />
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Placed {format(new Date(order.created_at), 'd MMM yyyy, h:mm a')} · {money(order.total_price, order.currency)}
        </p>
        <div className="flex flex-wrap gap-1.5">
          <ToneBadge tone={pay.tone}>{pay.label}</ToneBadge>
          <ToneBadge tone={ful.tone}>
            {ful.label}
            {ful.label === 'Delivered' && delivered ? ` ${format(delivered, 'd MMM')}` : ''}
          </ToneBadge>
          <ToneBadge tone={elig.eligible ? 'info' : 'neutral'}>{elig.longLabel}</ToneBadge>
        </div>
      </div>

      {/* Primary action */}
      <div className="space-y-1.5">
        {elig.eligible ? (
          startButton
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              {/* Wrapper keeps the tooltip working on a disabled button */}
              <span tabIndex={0} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {startButton}
              </span>
            </TooltipTrigger>
            <TooltipContent>{elig.reason}</TooltipContent>
          </Tooltip>
        )}
        {!elig.eligible && <p className="text-xs text-muted-foreground">{elig.reason}</p>}
      </div>

      {/* Items */}
      <PanelSection title={`Items (${order.line_items.reduce((s, i) => s + i.quantity, 0)})`}>
        <ul className="space-y-3">
          {order.line_items.map((item) => {
            const variant = item.variant_title && item.variant_title !== 'Default Title' ? item.variant_title : null;
            const image = (item as { image?: { src?: string } | null }).image?.src || describeItem({ sku: item.sku, product_name: item.title || item.name, size: item.variant_title || '', qty: item.quantity }, products).image;
            return (
              <li key={item.id} className="flex items-center gap-3">
                <ProductThumb src={image} alt={item.title || item.name} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{item.title || item.name}</p>
                  <p className="truncate text-xs text-muted-foreground tabular">
                    {[variant, item.sku].filter(Boolean).join(' · ')}
                    {(variant || item.sku) && ' · '}
                    {money(item.price, order.currency)} × {item.quantity}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </PanelSection>

      {/* Delivery */}
      <PanelSection title="Delivery">
        <div className="-my-1.5">
          {fulfillments.length === 0 ? (
            <KV label="Courier"><span className="text-muted-foreground">Not shipped yet</span></KV>
          ) : (
            fulfillments.map((f, i) => (
              <KV key={i} label={fulfillments.length > 1 ? `Courier ${i + 1}` : 'Courier'}>
                {f.tracking_company || 'Carrier'}
                {f.tracking_number && (
                  <>
                    {' · '}
                    {f.tracking_url ? (
                      <a
                        href={f.tracking_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline"
                      >
                        AWB {f.tracking_number}
                        <ArrowUpRight className="size-3.5" aria-hidden />
                      </a>
                    ) : (
                      <>AWB {f.tracking_number}</>
                    )}
                  </>
                )}
              </KV>
            ))
          )}
          {delivered ? (
            <KV label="Delivered">{format(delivered, 'd MMM, h:mm a')}</KV>
          ) : shipped ? (
            <KV label="Shipped">{format(shipped, 'd MMM, h:mm a')}</KV>
          ) : null}
          <KV label="Ship to">{address ?? <span className="text-muted-foreground">No shipping address</span>}</KV>
        </div>
      </PanelSection>

      {/* Customer */}
      <PanelSection title="Customer">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-muted-foreground" aria-hidden>
            {initials(name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {[phone, email].filter(Boolean).join(' · ') || 'No contact details'}
            </p>
          </div>
        </div>
      </PanelSection>
    </div>
  );
}
