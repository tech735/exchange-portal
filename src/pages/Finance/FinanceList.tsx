import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { RowSkeleton, StatusBadge, formatINR } from '@/components/app';
import type { Ticket } from '@/types/database';
import { refundAgeDays, shippedAt, shortDate, type FinanceTab } from './financeUtils';

const PAGE_SIZE = 50;

export interface FinanceListProps {
  tab: FinanceTab;
  rows: Ticket[];
  isLoading: boolean;
  /** Rendered instead of the list when there are no rows (or on error). */
  placeholder: React.ReactNode | null;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleMany: (ids: string[], on: boolean) => void;
  valueOf: (t: Ticket) => number | null;
  renderAction: (t: Ticket, opts: { phone: boolean }) => React.ReactNode;
}

const stop = (e: React.SyntheticEvent) => e.stopPropagation();

function Payment({ t, tab }: { t: Ticket; tab: FinanceTab }) {
  if ((t.refund_amount || 0) > 0) {
    if (t.refund_status === 'PROCESSED') {
      return <span className="text-success">{formatINR(t.refund_amount)} refunded</span>;
    }
    const age = tab === 'refunds' ? refundAgeDays(t) : null;
    return (
      <span className="text-warning">
        Refund {formatINR(t.refund_amount)} due
        {age !== null && age > 0 && <span className="text-muted-foreground"> · {age}d</span>}
      </span>
    );
  }
  if ((t.amount_collected || 0) > 0) return <span className="text-foreground">{formatINR(t.amount_collected)} collected</span>;
  return <span className="text-muted-foreground">₹0 · same price</span>;
}

export function FinanceList({ tab, rows, isLoading, placeholder, selected, onToggle, onToggleMany, valueOf, renderAction }: FinanceListProps) {
  const navigate = useNavigate();
  // Paging resets because the parent keys this component by tab + search.
  const [limit, setLimit] = React.useState(PAGE_SIZE);

  if (isLoading) return <RowSkeleton rows={6} />;
  if (placeholder) return <>{placeholder}</>;

  const visible = rows.slice(0, limit);
  const visibleIds = visible.map((t) => t.id);
  const selectedVisible = visibleIds.filter((id) => selected.has(id)).length;
  const allState: boolean | 'indeterminate' =
    selectedVisible === 0 ? false : selectedVisible === visibleIds.length ? true : 'indeterminate';
  const open = (id: string) => navigate(`/exchanges/${id}`);

  return (
    <>
      {/* Tablet / desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <th className="w-11 py-2.5 pl-4 pr-1">
                <Checkbox
                  checked={allState}
                  onCheckedChange={(v) => onToggleMany(visibleIds, v === true)}
                  aria-label="Select all rows"
                />
              </th>
              <th className="px-3 py-2.5 font-medium">Exchange</th>
              <th className="hidden lg:table-cell px-3 py-2.5 font-medium">Shipped</th>
              <th className="px-3 py-2.5 font-medium">Payment</th>
              <th className="px-3 py-2.5 text-right font-medium">Value</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="py-2.5 pl-3 pr-4"><span className="sr-only">Action</span></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((t) => {
              const on = selected.has(t.id);
              const value = valueOf(t);
              const shipped = shortDate(shippedAt(t));
              return (
                <tr
                  key={t.id}
                  onClick={() => open(t.id)}
                  className={cn(
                    'cursor-pointer border-b border-border last:border-0 transition-colors duration-150 ease-out-soft',
                    on ? 'bg-accent/60 hover:bg-accent' : 'hover:bg-muted/40',
                  )}
                >
                  <td className="py-3 pl-4 pr-1" onClick={stop}>
                    <Checkbox checked={on} onCheckedChange={() => onToggle(t.id)} aria-label={`Select order ${t.order_id}`} />
                  </td>
                  <td className="px-3 py-3">
                    <Link to={`/exchanges/${t.id}`} onClick={stop} className="font-medium text-foreground hover:text-primary transition-colors">
                      {t.order_id}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground max-w-[220px]">{t.customer_name}</p>
                  </td>
                  <td className="hidden lg:table-cell px-3 py-3 whitespace-nowrap text-foreground">
                    {shipped ? `Shipped ${shipped}` : <span className="text-faint">—</span>}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap"><Payment t={t} tab={tab} /></td>
                  <td className="px-3 py-3 text-right tabular whitespace-nowrap text-foreground">
                    {value === null ? <span className="text-faint">—</span> : formatINR(value)}
                  </td>
                  <td className="px-3 py-3"><StatusBadge ticket={t} /></td>
                  <td className="py-3 pl-3 pr-4 text-right" onClick={stop}>
                    <div className="flex items-center justify-end gap-1">{renderAction(t, { phone: false })}</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Phone cards */}
      <ul className="md:hidden divide-y divide-border">
        {visible.map((t) => {
          const on = selected.has(t.id);
          const value = valueOf(t);
          const shipped = shortDate(shippedAt(t));
          const action = renderAction(t, { phone: true });
          return (
            <li
              key={t.id}
              onClick={() => open(t.id)}
              className={cn('flex gap-2 px-3 py-3.5 transition-colors duration-150 active:bg-muted/50', on && 'bg-accent/60')}
            >
              <label className="grid size-9 shrink-0 place-items-center -mt-1.5" onClick={stop}>
                <Checkbox checked={on} onCheckedChange={() => onToggle(t.id)} aria-label={`Select order ${t.order_id}`} />
              </label>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{t.order_id}</p>
                    <p className="truncate text-xs text-muted-foreground">{t.customer_name}</p>
                  </div>
                  <StatusBadge ticket={t} className="shrink-0" />
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
                  <Payment t={t} tab={tab} />
                  {value !== null && <span className="tabular text-muted-foreground">Value {formatINR(value)}</span>}
                  {shipped && <span className="text-muted-foreground">Shipped {shipped}</span>}
                </div>
                {action && (
                  <div className="flex items-center justify-end gap-1" onClick={stop}>{action}</div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {rows.length > limit && (
        <div className="border-t border-border px-4 py-2.5 text-center">
          <Button variant="ghost" size="sm" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
            Show more · {rows.length - limit} left
          </Button>
        </div>
      )}
    </>
  );
}
