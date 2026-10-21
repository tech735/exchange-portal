import { useMemo, useState } from 'react';
import { formatDistanceToNowStrict, format } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTicketEvents } from '@/hooks/useTickets';
import { useStaff } from '@/hooks/useAppData';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { initials } from '@/components/app';
import { EVENT_LABELS, STAGE_LABELS, type EventType, type TicketStage } from '@/types/database';
import { cn } from '@/lib/utils';

type Filter = 'all' | 'notes' | 'system';

interface FeedItem {
  id: string;
  at: string;
  who: string;
  isNote: boolean;
  title: string;
  detail?: string;
}

const FIELD_LABELS: Record<string, string> = {
  return_awb: 'return AWB', exchange_awb: 'replacement AWB', amount_collected: 'amount collected', refund_amount: 'refund',
  is_paid: 'payment', assigned_to: 'owner', qc_notes: 'QC notes', delivery_charge: 'delivery charge',
};

/**
 * Activity = system events (audit log) + internal notes, newest first.
 * Notes are stored as ticket_events (type UPDATED, payload.note) so no new table is needed.
 */
export function ActivityFeed({ ticketId }: { ticketId: string }) {
  const { data: events = [], isLoading } = useTicketEvents(ticketId);
  const { data: staff = [] } = useStaff();
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>('all');
  const [note, setNote] = useState('');
  const [posting, setPosting] = useState(false);

  const nameOf = (id: string | null) => (id ? staff.find((s) => s.id === id)?.full_name || staff.find((s) => s.id === id)?.email : null) || 'System';

  const items: FeedItem[] = useMemo(() => {
    return [...events]
      .map((e: { id: string; event_type: EventType; event_by_user_id: string | null; event_at: string; event_payload: Record<string, unknown> | null }) => {
        const p = e.event_payload || {};
        if (typeof p.note === 'string') return { id: e.id, at: e.event_at, who: nameOf(e.event_by_user_id), isNote: true, title: p.note as string };
        const stage = p.stage ? STAGE_LABELS[p.stage as TicketStage] : undefined;
        const fields = Array.isArray(p.updated_fields) ? (p.updated_fields as string[]).map((f) => FIELD_LABELS[f]).filter(Boolean) : [];
        const detail = [stage && `→ ${stage}`, fields.length ? `updated ${fields.join(', ')}` : undefined, p.reason_code ? `reason ${String(p.reason_code).toLowerCase().replace('_', ' ')}` : undefined]
          .filter(Boolean).join(' · ');
        return { id: e.id, at: e.event_at, who: nameOf(e.event_by_user_id), isNote: false, title: EVENT_LABELS[e.event_type] ?? e.event_type, detail };
      })
      .reverse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, staff]);

  const shown = items.filter((i) => filter === 'all' || (filter === 'notes' ? i.isNote : !i.isNote));

  const post = async () => {
    if (!note.trim()) return;
    setPosting(true);
    try {
      const { error } = await (supabase.from('ticket_events') as unknown as { insert: (v: object) => Promise<{ error: Error | null }> }).insert({
        ticket_id: ticketId,
        event_type: 'UPDATED',
        event_by_user_id: user?.id ?? null,
        event_payload: { note: note.trim(), author: profile?.full_name ?? null },
      });
      if (error) throw error;
      setNote('');
      qc.invalidateQueries({ queryKey: ['ticket-events', ticketId] });
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-4 border-b border-border text-sm">
        {(['all', 'notes', 'system'] as Filter[]).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={cn('-mb-px border-b-2 py-2 font-medium capitalize transition-colors', filter === f ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
            {f}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-input bg-card p-2 focus-within:border-primary focus-within:ring-[3px] focus-within:ring-primary/15 transition-[border-color,box-shadow]">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') post(); }}
          rows={2}
          placeholder="Add an internal note… (the customer won’t see it)"
          className="w-full resize-none bg-transparent px-1 text-base md:text-sm outline-none placeholder:text-faint"
        />
        <div className="flex items-center justify-between">
          <span className="px-1 text-[11px] text-faint">⌘↵ to post</span>
          <Button size="sm" variant="secondary" onClick={post} disabled={!note.trim() || posting}>{posting ? 'Posting…' : 'Post note'}</Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3 py-2">{[0, 1, 2].map((i) => <div key={i} className="h-10 rounded-lg bg-muted animate-pulse" />)}</div>
      ) : shown.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{filter === 'notes' ? 'No notes yet.' : 'No activity yet.'}</p>
      ) : (
        <ol className="space-y-3">
          {shown.map((i) => (
            <li key={i.id} className="flex gap-3">
              <span className={cn('mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-[10px] font-semibold', i.isNote ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground')}>
                {i.who === 'System' ? 'SY' : initials(i.who)}
              </span>
              <div className={cn('min-w-0 flex-1', i.isNote && 'rounded-lg bg-accent/50 px-3 py-2')}>
                <p className="text-sm text-foreground break-words"><span className="font-medium">{i.isNote ? i.who : i.title}</span>{i.isNote ? '' : ''}</p>
                {i.isNote ? <p className="text-sm text-foreground break-words">{i.title}</p> : i.detail && <p className="text-xs text-muted-foreground">{i.detail}</p>}
                <p className="mt-0.5 text-[11px] text-faint" title={format(new Date(i.at), 'PPpp')}>
                  {!i.isNote && i.who !== 'System' ? `${i.who} · ` : ''}{formatDistanceToNowStrict(new Date(i.at), { addSuffix: true })}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
