import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useRecentActivity } from '@/hooks/useActivity';
import { EVENT_LABELS, type EventType } from '@/types/database';
import { formatDistanceToNow } from 'date-fns';
import {
  Bell,
  PackagePlus,
  RefreshCw,
  PackageCheck,
  CheckCircle2,
  XCircle,
  Repeat,
  Receipt,
  FileCheck,
  IndianRupee,
  AlertTriangle,
  CheckCheck,
} from 'lucide-react';

const EVENT_ICONS: Record<EventType, React.ElementType> = {
  CREATED: PackagePlus,
  UPDATED: RefreshCw,
  RECEIVED: PackageCheck,
  APPROVED: CheckCircle2,
  DENIED: XCircle,
  EXCHANGE_DONE: Repeat,
  SENT_TO_INVOICE: Receipt,
  INVOICED: FileCheck,
  REFUND_SENT: IndianRupee,
  ESCALATED: AlertTriangle,
  CLOSED: CheckCheck,
};

const RECENT_WINDOW_MS = 60 * 60 * 1000;

export function NotificationsPanel() {
  const [open, setOpen] = useState(false);
  const { data: activity } = useRecentActivity();
  const navigate = useNavigate();

  const hasRecent = (activity ?? []).some((item) => Date.now() - new Date(item.eventAt).getTime() < RECENT_WINDOW_MS);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button aria-label="Notifications" className="relative grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <Bell className="size-[18px]" />
          {hasRecent && (
            <span className="absolute right-2 top-2 size-2 rounded-full bg-destructive ring-2 ring-card" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-1.5rem))] p-0 rounded-xl overflow-hidden shadow-overlay">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <p className="font-heading font-semibold text-sm">Notifications</p>
          <span className="text-xs text-muted-foreground">{activity?.length ?? 0} recent</span>
        </div>
        <div className="max-h-80 overflow-y-auto scrollbar-thin">
          {!activity || activity.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No recent activity</p>
          ) : (
            activity.map((item) => {
              const Icon = EVENT_ICONS[item.eventType] ?? Bell;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setOpen(false);
                    navigate(`/exchanges/${item.ticketId}`);
                  }}
                  className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors border-b border-border last:border-0"
                >
                  <div className="grid size-8 shrink-0 place-items-center rounded-full bg-accent">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium truncate">{EVENT_LABELS[item.eventType]}</p>
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        {formatDistanceToNow(new Date(item.eventAt), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {item.orderId ?? 'Ticket'}
                      {item.customerName ? ` · ${item.customerName}` : ''}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
