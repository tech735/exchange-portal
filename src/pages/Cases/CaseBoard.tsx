import { useState } from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import { CircleDot, CirclePlay, UserRound, CirclePause, CircleCheck, Plus } from 'lucide-react';
import { ToneBadge, initials } from '@/components/app';
import { SPECIAL_CASE_TYPE_LABELS, type CaseBoardStage, type SpecialCase, type SpecialCaseType } from '@/types/database';
import { cn } from '@/lib/utils';

export type BoardColumn = CaseBoardStage | 'CLOSED';

export const BOARD_COLUMNS: { key: BoardColumn; title: string; icon: React.ElementType; tone: string; hint: string }[] = [
  { key: 'NEW', title: 'New', icon: CircleDot, tone: 'text-info', hint: 'Just logged' },
  { key: 'ON_US', title: 'On us', icon: CirclePlay, tone: 'text-success', hint: 'We’re working on it' },
  { key: 'ON_CUSTOMER', title: 'Waiting on customer', icon: UserRound, tone: 'text-warning', hint: 'Needs a reply or action from them' },
  { key: 'ON_HOLD', title: 'On hold', icon: CirclePause, tone: 'text-[hsl(263_60%_50%)]', hint: 'Parked — courier, stock, approval' },
  { key: 'CLOSED', title: 'Closed', icon: CircleCheck, tone: 'text-success', hint: 'Resolved' },
];

const TYPE_TONE: Record<SpecialCaseType, 'danger' | 'warning' | 'info' | 'neutral'> = { RTO: 'danger', RETURN: 'warning', EXCHANGE: 'info', OTHER: 'neutral' };

export const columnOf = (c: SpecialCase): BoardColumn => (c.status === 'RESOLVED' ? 'CLOSED' : c.board_stage ?? 'NEW');

/** Back-office board: drag a case between columns; click to open it. */
export function CaseBoard({
  cases,
  staff,
  onOpen,
  onCreate,
  onMove,
}: {
  cases: SpecialCase[];
  staff: { id: string; full_name: string | null; email: string }[];
  onOpen: (c: SpecialCase) => void;
  onCreate: (stage: CaseBoardStage) => void;
  onMove: (c: SpecialCase, to: BoardColumn) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<BoardColumn | null>(null);
  const weekAgo = Date.now() - 14 * 864e5;
  const byCol = (k: BoardColumn) =>
    cases
      .filter((c) => columnOf(c) === k && (k !== 'CLOSED' || +new Date(c.updated_at) >= weekAgo))
      .sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at));
  const dragged = cases.find((c) => c.id === dragId);

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
      <div className="grid min-w-[1100px] grid-cols-5 gap-3">
        {BOARD_COLUMNS.map((col) => {
          const items = byCol(col.key);
          const valid = !!dragged && columnOf(dragged) !== col.key;
          return (
            <section
              key={col.key}
              aria-label={col.title}
              onDragOver={(e) => { if (valid) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (over !== col.key) setOver(col.key); } }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver((o) => (o === col.key ? null : o)); }}
              onDrop={(e) => { e.preventDefault(); if (dragged && valid) onMove(dragged, col.key); setDragId(null); setOver(null); }}
              className={cn('flex min-h-[420px] flex-col rounded-xl border border-border bg-card transition-[box-shadow,background-color] duration-150',
                over === col.key && 'ring-2 ring-primary bg-accent/40')}
            >
              <header className="flex items-center gap-2 border-b border-border px-3 py-2.5" title={col.hint}>
                <col.icon className={cn('size-4', col.tone)} />
                <h2 className="flex-1 truncate font-sans text-sm font-medium">{col.title}</h2>
                <span className="text-xs text-muted-foreground tabular">{items.length}</span>
                {col.key !== 'CLOSED' && (
                  <button onClick={() => onCreate(col.key as CaseBoardStage)} aria-label={`Log a case in ${col.title}`}
                    className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                    <Plus className="size-4" />
                  </button>
                )}
              </header>
              <div className="flex flex-1 flex-col gap-2 p-2">
                {items.length === 0 && <p className="py-10 text-center text-xs text-faint">{col.key === 'CLOSED' ? 'Nothing closed in 14 days' : 'No cases'}</p>}
                {items.map((c) => {
                  const owner = staff.find((s) => s.id === c.owner_id);
                  return (
                    <button
                      key={c.id}
                      draggable
                      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', c.id); setDragId(c.id); }}
                      onDragEnd={() => { setDragId(null); setOver(null); }}
                      onClick={() => onOpen(c)}
                      className={cn('w-full cursor-grab rounded-lg border border-border bg-card p-3 text-left shadow-card transition-[border-color,box-shadow,opacity,transform] duration-150 hover:border-input hover:shadow-card-hover active:cursor-grabbing',
                        dragId === c.id && 'opacity-40 rotate-[1deg]')}
                    >
                      <div className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{c.order_name}</span>
                        <ToneBadge tone={TYPE_TONE[c.case_type]}>{SPECIAL_CASE_TYPE_LABELS[c.case_type]}</ToneBadge>
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{c.latest_update || c.issue}</p>
                      <div className="mt-2.5 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-faint">{formatDistanceToNowStrict(new Date(c.updated_at), { addSuffix: true })}</span>
                        {owner
                          ? <span title={owner.full_name ?? owner.email} className="grid size-6 place-items-center rounded-full bg-accent text-[10px] font-semibold text-accent-foreground">{initials(owner.full_name ?? owner.email)}</span>
                          : <span className="text-[11px] text-faint">No owner</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
