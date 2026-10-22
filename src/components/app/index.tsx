import * as React from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronRight, Package, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Tone } from '@/lib/exchangeStatus';
import { getExchangeStatus } from '@/lib/exchangeStatus';
import type { Ticket } from '@/types/database';

/* ------------------------------------------------------------------ */
/* Page header                                                         */
/* ------------------------------------------------------------------ */

export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumb?: { label: string; to?: string }[];
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {breadcrumb && breadcrumb.length > 0 && (
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-muted-foreground">
          {breadcrumb.map((b, i) => (
            <React.Fragment key={i}>
              {i > 0 && <ChevronRight className="size-3.5 text-faint" aria-hidden />}
              {b.to ? (
                <Link to={b.to} className="hover:text-foreground transition-colors">{b.label}</Link>
              ) : (
                <span className="text-foreground font-medium">{b.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="text-xl sm:text-2xl font-semibold text-foreground truncate">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Badges                                                              */
/* ------------------------------------------------------------------ */

export function ToneBadge({ tone = 'neutral', children, dot = true, className }: { tone?: Tone; children: React.ReactNode; dot?: boolean; className?: string }) {
  const variant = tone === 'danger' ? 'danger' : tone;
  return <Badge variant={variant} dot={dot} className={className}>{children}</Badge>;
}

export function StatusBadge({ ticket, className }: { ticket: Parameters<typeof getExchangeStatus>[0]; className?: string }) {
  const s = getExchangeStatus(ticket);
  return <ToneBadge tone={s.tone} className={className}>{s.label}</ToneBadge>;
}

export function PaymentBadge({ ticket }: { ticket: Pick<Ticket, 'is_paid' | 'refund_amount' | 'refund_status' | 'amount_collected'> }) {
  if (ticket.refund_amount > 0) {
    return <ToneBadge tone={ticket.refund_status === 'PROCESSED' ? 'success' : 'warning'}>{ticket.refund_status === 'PROCESSED' ? 'Refunded' : 'Refund due'}</ToneBadge>;
  }
  return ticket.is_paid ? <ToneBadge tone="success">Paid</ToneBadge> : <ToneBadge tone="danger">Unpaid</ToneBadge>;
}

/* ------------------------------------------------------------------ */
/* KPI card (clickable → filtered list)                                */
/* ------------------------------------------------------------------ */

export function KpiCard({
  label,
  value,
  meta,
  to,
  onClick,
  active,
  tone,
  loading,
}: {
  label: string;
  value: React.ReactNode;
  meta?: React.ReactNode;
  to?: string;
  onClick?: () => void;
  active?: boolean;
  tone?: Tone;
  loading?: boolean;
}) {
  const body = (
    <>
      <p className="text-xs font-medium text-muted-foreground truncate">{label}</p>
      {loading ? (
        <div className="mt-2 h-7 w-16 rounded-md bg-muted animate-pulse" />
      ) : (
        <p className={cn('mt-1 font-heading text-2xl font-semibold tabular leading-tight', tone === 'danger' && 'text-destructive', tone === 'warning' && 'text-warning', tone === 'success' && 'text-success')}>{value}</p>
      )}
      {meta && <p className="mt-1 text-xs text-muted-foreground truncate">{meta}</p>}
    </>
  );
  const cls = cn(
    'block rounded-xl border bg-card p-4 text-left transition-[border-color,box-shadow,background-color] duration-150',
    active ? 'border-primary ring-[3px] ring-primary/10' : 'border-border',
    (to || onClick) && 'hover:border-input hover:shadow-card-hover cursor-pointer focus-visible:ring-2 focus-visible:ring-ring',
  );
  if (to) return <Link to={to} className={cls}>{body}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={cn(cls, 'w-full')} aria-pressed={active}>{body}</button>;
  return <div className={cls}>{body}</div>;
}

/* ------------------------------------------------------------------ */
/* Saved-view tabs with counts                                         */
/* ------------------------------------------------------------------ */

export function ViewTabs<T extends string>({
  views,
  value,
  onChange,
  trailing,
}: {
  views: { id: T; label: string; count?: number }[];
  value: T;
  onChange: (id: T) => void;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 border-b border-border">
      <div role="tablist" className="flex min-w-0 flex-1 items-center gap-5 overflow-x-auto scrollbar-hide">
        {views.map((v) => {
          const on = v.id === value;
          return (
            <button
              key={v.id}
              role="tab"
              aria-selected={on}
              onClick={() => onChange(v.id)}
              className={cn(
                '-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-0.5 py-2.5 text-sm font-medium transition-colors duration-150',
                on ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {v.label}
              {v.count !== undefined && (
                <span className={cn('rounded-full px-1.5 text-[11px] leading-5 tabular', on ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground')}>
                  {v.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {trailing}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Filter chip + search                                                */
/* ------------------------------------------------------------------ */

export function FilterChip({ label, onRemove }: { label: React.ReactNode; onRemove?: () => void }) {
  return (
    <span className="inline-flex h-7 items-center gap-1 rounded-full border border-input bg-card pl-2.5 pr-1 text-xs font-medium text-foreground animate-fade-in">
      {label}
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label="Remove filter" className="grid size-5 place-items-center rounded-full text-faint hover:bg-muted hover:text-foreground transition-colors">
          <X className="size-3" />
        </button>
      )}
    </span>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder = 'Search…',
  className,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" aria-hidden />
      <input
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-base md:text-sm shadow-sm placeholder:text-faint transition-[border-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/15"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Floating bulk action bar                                            */
/* ------------------------------------------------------------------ */

export function BulkBar({ count, children, onClear, summary }: { count: number; children: React.ReactNode; onClear: () => void; summary?: React.ReactNode }) {
  if (count === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 md:bottom-6 z-40 flex justify-center px-4">
      <div className="pointer-events-auto flex max-w-full items-center gap-1 overflow-x-auto rounded-xl bg-foreground py-1.5 pl-4 pr-1.5 text-background shadow-overlay animate-in fade-in slide-in-from-bottom-2 duration-200">
        <span className="whitespace-nowrap text-sm font-medium">{count} selected{summary ? <> · {summary}</> : null}</span>
        <span className="mx-2 h-5 w-px bg-background/20" aria-hidden />
        {children}
        <button onClick={onClear} aria-label="Clear selection" className="ml-1 grid size-8 shrink-0 place-items-center rounded-lg text-background/60 hover:bg-background/10 hover:text-background transition-colors">
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}

export function BulkBarButton({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className="inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-[13px] font-medium hover:bg-background/10 transition-colors disabled:opacity-50 [&_svg]:size-4">
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Section card                                                        */
/* ------------------------------------------------------------------ */

export function SectionCard({
  title,
  action,
  children,
  className,
  bodyClassName,
  description,
}: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  description?: React.ReactNode;
}) {
  return (
    <section className={cn('rounded-xl border border-border bg-card', className)}>
      {title && (
        <header className="flex items-center gap-3 px-4 sm:px-5 pt-4 pb-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-heading text-[15px] font-semibold leading-snug text-foreground">{title}</h2>
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={cn('px-4 sm:px-5 pb-4', !title && 'pt-4', bodyClassName)}>{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Stepper                                                             */
/* ------------------------------------------------------------------ */

export function Stepper({ steps, current, sublabels }: { steps: readonly string[]; current: number; sublabels?: (string | undefined)[] }) {
  return (
    <>
      {/* Desktop / tablet: full stepper */}
      <ol className="hidden md:flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-4">
        {steps.map((s, i) => {
          const done = current >= 0 && i < current;
          const now = i === current;
          return (
            <li key={s} className="flex min-w-0 flex-1 items-center gap-2 last:flex-none">
              <span className={cn('grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold transition-colors',
                done && 'bg-success text-white', now && 'bg-primary text-primary-foreground ring-4 ring-primary/10', !done && !now && 'border border-input text-faint')}>
                {done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
              </span>
              <span className="min-w-0">
                <span className={cn('block truncate text-xs font-medium', done || now ? 'text-foreground' : 'text-faint')}>{s}</span>
                {sublabels?.[i] && <span className={cn('block truncate text-[11px]', now ? 'text-primary' : 'text-muted-foreground')}>{sublabels[i]}</span>}
              </span>
              {i < steps.length - 1 && <span className={cn('h-0.5 min-w-3 flex-1 rounded-full', done ? 'bg-success' : 'bg-border')} aria-hidden />}
            </li>
          );
        })}
      </ol>
      {/* Phone: compact progress */}
      <div className="md:hidden rounded-xl border border-border bg-card p-4">
        <p className="text-xs font-medium text-primary">
          {current >= 0 ? `Step ${current + 1} of ${steps.length} · ${steps[current]}` : 'Off the main path'}
        </p>
        <div className="mt-2 flex gap-1">
          {steps.map((s, i) => (
            <span key={s} className={cn('h-1.5 flex-1 rounded-full', i < current ? 'bg-success' : i === current ? 'bg-primary' : 'bg-border')} />
          ))}
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Empty / loading states                                              */
/* ------------------------------------------------------------------ */

export function EmptyState({ icon: Icon, title, description, action, className }: { icon?: React.ElementType; title: string; description?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 px-6 py-12 text-center', className)}>
      {Icon && <div className="mb-1 grid size-11 place-items-center rounded-full bg-muted text-muted-foreground"><Icon className="size-5" /></div>}
      <p className="font-heading text-[15px] font-semibold text-foreground">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function RowSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3.5">
          <div className="h-4 w-4 rounded bg-muted animate-pulse" />
          <div className="h-4 flex-1 max-w-[220px] rounded bg-muted animate-pulse" />
          <div className="hidden sm:block h-4 w-24 rounded bg-muted animate-pulse" />
          <div className="hidden md:block h-5 w-20 rounded-full bg-muted animate-pulse" />
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Key / value row                                                     */
/* ------------------------------------------------------------------ */

export function KV({ label, children, strong }: { label: React.ReactNode; children: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className={cn('min-w-0 text-right break-words', strong ? 'font-semibold text-foreground' : 'text-foreground')}>{children}</span>
    </div>
  );
}

export function initials(name?: string | null) {
  return (name || '?').split(/\s+/).filter(Boolean).map((n) => n[0]).slice(0, 2).join('').toUpperCase();
}

export const formatINR = (n: number | null | undefined) =>
  `₹${Math.round(Number(n || 0)).toLocaleString('en-IN')}`;

/* ------------------------------------------------------------------ */
/* Confirm dialog (replaces window.confirm)                            */
/* ------------------------------------------------------------------ */


export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  destructive,
  loading,
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  children?: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
          <Button variant={destructive ? 'destructive' : 'default'} onClick={() => onConfirm()} disabled={loading}>
            {loading ? 'Working…' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Product thumbnail (Shopify photo, falls back to a package icon)     */
/* ------------------------------------------------------------------ */


export function ProductThumb({ src, alt, size = 48, className }: { src?: string | null; alt?: string; size?: number; className?: string }) {
  const [failed, setFailed] = React.useState(false);
  const px = { width: size, height: size };
  if (!src || failed) {
    return (
      <span style={px} className={cn('grid shrink-0 place-items-center rounded-md border border-border bg-muted text-faint', className)} aria-hidden>
        <Package style={{ width: size * 0.42, height: size * 0.42 }} />
      </span>
    );
  }
  const thumb = src.includes('cdn.shopify.com') ? `${src}${src.includes('?') ? '&' : '?'}width=${Math.round(size * 2)}` : src;
  return (
    <img src={thumb} alt={alt ?? ''} loading="lazy" onError={() => setFailed(true)} style={px}
      className={cn('shrink-0 rounded-md border border-border bg-muted object-cover', className)} />
  );
}
