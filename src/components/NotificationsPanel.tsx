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
        <button className="h-10 w-10 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition relative">
          <Bell className="h-4 w-4" />
          {hasRecent && (
            <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 bg-primary border border-background rounded-full" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0 rounded-2xl overflow-hidden">
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
                    navigate(`/ticket/${item.ticketId}`);
                  }}
                  className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors border-b border-border last:border-0"
                >
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
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
