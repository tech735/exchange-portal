import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command as CommandPrimitive } from 'cmdk';
import { Plus, Search, CornerDownLeft } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useTickets } from '@/hooks/useTickets';
import { useUser } from '@/contexts/UserContext';
import { navFor, canAccess } from '@/lib/navigation';
import { getExchangeStatus } from '@/lib/exchangeStatus';
import { ToneBadge } from '@/components/app';

/** Opens the palette on ⌘K / Ctrl+K anywhere, and on "/" outside text fields. */
export function useCommandPaletteHotkey(open: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName));
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); open(); }
      else if (e.key === '/' && !typing) { e.preventDefault(); open(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
}

const item =
  'flex cursor-pointer select-none items-center gap-3 rounded-lg px-3 py-2.5 text-sm outline-none transition-colors data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground';
const group = '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-faint';

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate();
  const { user, hasFullAccess } = useUser();
  const full = hasFullAccess();
  const [q, setQ] = useState('');
  const canSeeTickets = canAccess(user?.role, '/exchanges/x', full);
  const { data: tickets = [] } = useTickets();

  useEffect(() => { if (!open) setQ(''); }, [open]);

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!canSeeTickets || s.length < 2) return [];
    return tickets
      .filter((t) => [t.order_id, t.customer_name, t.customer_phone, t.customer_email, t.return_awb, t.exchange_awb].some((v) => v && String(v).toLowerCase().includes(s)))
      .slice(0, 8);
  }, [q, tickets, canSeeTickets]);

  const go = (to: string) => { onOpenChange(false); navigate(to); };
  const pages = navFor(user?.role, full);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[10vh] gap-0 overflow-hidden p-0 pt-3 sm:pt-0 sm:p-0 sm:top-[14vh] sm:translate-y-0 sm:max-w-[640px] sm:w-full sm:data-[state=open]:slide-in-from-top-2 [&>button:last-child]:hidden">
        <DialogTitle className="sr-only">Search and commands</DialogTitle>
        <CommandPrimitive shouldFilter={false} loop className="flex flex-col">
          <div className="flex items-center gap-3 border-b border-border px-4">
            <Search className="size-4 shrink-0 text-faint" />
            <CommandPrimitive.Input
              value={q}
              onValueChange={setQ}
              autoFocus
              placeholder="Search order #, customer, phone, AWB… or type a command"
              className="h-14 w-full bg-transparent text-base md:text-[15px] outline-none placeholder:text-faint"
            />
            <kbd className="kbd hidden sm:inline-flex">Esc</kbd>
          </div>
          <CommandPrimitive.List className="max-h-[60vh] overflow-y-auto scrollbar-thin p-2">
            <CommandPrimitive.Empty className="px-3 py-10 text-center text-sm text-muted-foreground">
              No matches for “{q}”. Try an order number, phone or AWB.
            </CommandPrimitive.Empty>

            {matches.length > 0 && (
              <CommandPrimitive.Group heading="Exchanges" className={group}>
                {matches.map((t) => {
                  const st = getExchangeStatus(t);
                  return (
                    <CommandPrimitive.Item key={t.id} value={`ticket-${t.id}`} onSelect={() => go(`/exchanges/${t.id}`)} className={item}>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-foreground">#{t.order_id} · {t.customer_name}</p>
                        <p className="truncate text-xs text-muted-foreground">{t.customer_phone}{t.return_awb ? ` · AWB ${t.return_awb}` : ''}</p>
                      </div>
                      <ToneBadge tone={st.tone}>{st.label}</ToneBadge>
                    </CommandPrimitive.Item>
                  );
                })}
              </CommandPrimitive.Group>
            )}

            {q.trim().length < 2 && canAccess(user?.role, '/exchanges/new', full) && (
              <CommandPrimitive.Group heading="Actions" className={group}>
                <CommandPrimitive.Item value="new-exchange" onSelect={() => go('/exchanges/new')} className={item}>
                  <span className="grid size-7 place-items-center rounded-md bg-accent text-primary"><Plus className="size-4" /></span>
                  <span className="flex-1">Lodge a new exchange</span>
                </CommandPrimitive.Item>
              </CommandPrimitive.Group>
            )}

            <CommandPrimitive.Group heading="Go to" className={group}>
              {pages
                .filter((p) => !q.trim() || p.label.toLowerCase().includes(q.trim().toLowerCase()))
                .map((p) => (
                  <CommandPrimitive.Item key={p.to} value={`page-${p.to}`} onSelect={() => go(p.to)} className={item}>
                    <span className="grid size-7 place-items-center rounded-md bg-muted text-muted-foreground"><p.icon className="size-4" /></span>
                    <span className="flex-1">{p.label}</span>
                  </CommandPrimitive.Item>
                ))}
            </CommandPrimitive.Group>
          </CommandPrimitive.List>
          <div className="hidden sm:flex items-center gap-4 border-t border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
            <span><kbd className="kbd">↑</kbd> <kbd className="kbd">↓</kbd> navigate</span>
            <span className="inline-flex items-center gap-1"><kbd className="kbd"><CornerDownLeft className="size-3" /></kbd> open</span>
            <span className="ml-auto">Tip: press <kbd className="kbd">/</kbd> anywhere</span>
          </div>
        </CommandPrimitive>
      </DialogContent>
    </Dialog>
  );
}
