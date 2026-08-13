import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Info,
  History,
  Package,
  MoreHorizontal,
  Trash2,
  ExternalLink,
  Calculator,
  User,
  Tag,
  Clipboard,
  CreditCard,
  Truck,
} from 'lucide-react';
import { type Ticket, REASON_LABELS, STAGE_LABELS, STATUS_LABELS, EVENT_LABELS } from '@/types/database';
import { useTicketEvents } from '@/hooks/useTickets';
import { format } from 'date-fns';
import { InfoCard, Field, DetailNavHeader } from '@/components/ui/detail-card';
import { Link, useLocation } from 'react-router-dom';

const statusVariants: Record<string, string> = {
  NEW: 'new',
  IN_PROCESS: 'in_process',
  COMPLETED: 'completed',
  DENIED: 'denied',
  ESCALATED: 'escalated',
};

const stageVariants: Record<string, string> = {
  LODGED: 'lodged',
  RETURN_PENDING: 'return_pending',
  RETURN_RECEIVED: 'return_received',
  WAREHOUSE_APPROVED: 'warehouse_approved',
  WAREHOUSE_DENIED: 'warehouse_denied',
  EXCHANGE_BOOKED: 'exchange_booked',
  EXCHANGE_COMPLETED: 'exchange_completed',
  INVOICING_PENDING: 'invoicing_pending',
  INVOICED: 'invoiced',
  TO_BE_REFUNDED: 'to_be_refunded',
  CLOSED: 'closed',
  ESCALATED: 'escalated',
};

interface TicketDetailsDrawerProps {
  tickets: Ticket[];
  currentIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (index: number) => void;
  onDelete?: (id: string) => void;
  onMarkCollected?: (ticket: Ticket) => void;
  productPrices?: Record<string, number>;
}

export function TicketDetailsDrawer({
  tickets,
  currentIndex,
  open,
  onOpenChange,
  onNavigate,
  onDelete,
  onMarkCollected,
  productPrices,
}: TicketDetailsDrawerProps) {
  const ticket = tickets[currentIndex];
  const { data: events = [], isLoading: eventsLoading } = useTicketEvents(ticket?.id);
  const location = useLocation();

  const isPaid = !!(ticket?.is_paid || ticket?.exchange_completed_at);

  // The Sheet root always renders; if the ticket disappears underneath an open
  // drawer (list refetch, delete) we close it rather than ripping the content
  // out of the tree, which would strand Radix's body pointer-events lock.
  if (!ticket) {
    return <Sheet open={false} onOpenChange={onOpenChange} />;
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col gap-0">
        <DetailNavHeader index={currentIndex} total={tickets.length} onNavigate={onNavigate} />

        {/* Identity row */}
        <div className="px-4 sm:px-6 py-4 flex items-start gap-3 border-b border-border shrink-0">
          <div className="flex-1 min-w-0 pr-1">
            <SheetTitle className="text-base font-medium leading-tight truncate">
              #{ticket.order_id}
            </SheetTitle>
            <SheetDescription asChild>
              <p className="text-xs text-muted-foreground mt-0.5">
                {ticket.customer_name} · Created {format(new Date(ticket.created_at), 'PP')}
              </p>
            </SheetDescription>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* modal={false}: this menu lives inside the Sheet, and a second
                body pointer-events lock here is what strands the page. */}
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8 rounded-full">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="gap-2" asChild>
                  <Link to={`/ticket/${ticket.id}`} state={{ from: location.pathname }}>
                    <ExternalLink className="w-4 h-4 text-muted-foreground" />Full page view
                  </Link>
                </DropdownMenuItem>
                {onDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="gap-2 text-destructive focus:text-destructive" onClick={() => onDelete(ticket.id)}>
                      <Trash2 className="w-4 h-4" />Delete ticket
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            {!isPaid && onMarkCollected && (ticket.status === 'IN_PROCESS' || ticket.status === 'NEW') && (
              <Button size="sm" className="gap-1.5" onClick={() => onMarkCollected(ticket)}>
                <CreditCard className="w-4 h-4" />
                Mark Paid
              </Button>
            )}
          </div>
        </div>

        <Tabs defaultValue="details" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-2 rounded-none border-b border-border bg-transparent h-auto px-4 sm:px-6 shrink-0">
            <TabsTrigger value="details" className="gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3">
              <Info className="w-4 h-4" />
              Details
            </TabsTrigger>
            <TabsTrigger value="timeline" className="gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3">
              <History className="w-4 h-4" />
              Timeline
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="flex-1 overflow-y-auto scrollbar-hide">
            <div className="p-4 sm:p-6 space-y-4">
              {/* Status & Stage */}
              <InfoCard title="Status & Stage" icon={Tag}>
                <div className="grid grid-cols-2 gap-4">
                  <Field
                    label="Status"
                    value={
                      <Badge variant={statusVariants[ticket.status] as any}>
                        {STATUS_LABELS[ticket.status]}
                      </Badge>
                    }
                  />
                  <Field
                    label="Stage"
                    value={
                      <Badge variant={stageVariants[ticket.stage] as any || 'outline'}>
                        {STAGE_LABELS[ticket.stage as keyof typeof STAGE_LABELS] || ticket.stage}
                      </Badge>
                    }
                  />
                  <Field label="Reason" value={REASON_LABELS[ticket.reason_code]} />
                  <Field
                    label="Payment"
                    value={
                      isPaid
                        ? <Badge variant="paid">Paid</Badge>
                        : <Badge variant="unpaid">Unpaid</Badge>
                    }
                  />
                </div>
                {ticket.sla_breached && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <Badge variant="destructive" className="text-xs">SLA Breached</Badge>
                  </div>
                )}
              </InfoCard>

              {/* Customer */}
              <InfoCard title="Customer" icon={User}>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Name" value={ticket.customer_name} />
                  <Field label="Phone" value={ticket.customer_phone} />
                  {ticket.customer_email && (
                    <Field label="Email" value={ticket.customer_email} className="col-span-2" />
                  )}
                  {ticket.student_name && (
                    <Field label="Student" value={ticket.student_name} />
                  )}
                  {ticket.school_name && (
                    <Field label="School" value={ticket.school_name} />
                  )}
                </div>
              </InfoCard>

              {/* Return Items */}
              {ticket.return_items && ticket.return_items.length > 0 && (
                <InfoCard title="Return Items" icon={Package}>
                  <div className="space-y-3">
                    {ticket.return_items.map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <div>
                          <p className="font-medium">{item.product_name}</p>
                          <p className="text-xs text-muted-foreground">SKU: {item.sku} · Size: {item.size}</p>
                        </div>
                        <span className="text-muted-foreground">×{item.qty}</span>
                      </div>
                    ))}
                  </div>
                </InfoCard>
              )}

              {/* Exchange Items */}
              {ticket.exchange_items && ticket.exchange_items.length > 0 && (
                <InfoCard title="Exchange Items" icon={Package}>
                  <div className="space-y-3">
                    {ticket.exchange_items.map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <div>
                          <p className="font-medium">{item.product_name}</p>
                          <p className="text-xs text-muted-foreground">SKU: {item.sku} · Size: {item.size}</p>
                        </div>
                        <span className="text-muted-foreground">×{item.qty}</span>
                      </div>
                    ))}
                  </div>
                </InfoCard>
              )}

              {/* Shipping — always shown; fields fill in as the ticket progresses */}
              <InfoCard title="Shipping" icon={Truck}>
                <div className="grid grid-cols-2 gap-4">
                  <Field
                    label="Return AWB"
                    mono
                    value={ticket.return_awb || <span className="text-muted-foreground font-normal font-sans">Not booked</span>}
                  />
                  <Field
                    label="Exchange AWB"
                    mono
                    value={ticket.exchange_awb || <span className="text-muted-foreground font-normal font-sans">Not booked</span>}
                  />
                  <Field
                    label="Return Courier"
                    value={ticket.return_aggregator || <span className="text-muted-foreground font-normal">—</span>}
                  />
                  <Field
                    label="Exchange Courier"
                    value={ticket.exchange_aggregator || <span className="text-muted-foreground font-normal">—</span>}
                  />
                  <Field
                    label="Return Booked"
                    value={
                      ticket.return_booked_at
                        ? format(new Date(ticket.return_booked_at), 'PP')
                        : <span className="text-muted-foreground font-normal">—</span>
                    }
                  />
                  <Field
                    label="Exchange Booked"
                    value={
                      ticket.exchange_booked_at
                        ? format(new Date(ticket.exchange_booked_at), 'PP')
                        : <span className="text-muted-foreground font-normal">—</span>
                    }
                  />
                </div>
              </InfoCard>

              {/* Financial */}
              <InfoCard title="Financial Summary" icon={CreditCard}>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Amount Collected" value={`₹${ticket.amount_collected || 0}`} />
                  <Field label="Refund Amount" value={`₹${ticket.refund_amount || 0}`} />
                  <Field label="Refund Status" value={ticket.refund_status || 'NONE'} />
                </div>
              </InfoCard>

              {/* Notes */}
              <InfoCard title="Notes & Metadata" icon={Clipboard}>
                <p className="text-xs text-muted-foreground mb-1">Last Updated</p>
                <p className="text-xs mb-3">{ticket.updated_at ? format(new Date(ticket.updated_at), 'PPP p') : 'Never'}</p>
                <p className="text-xs text-muted-foreground mb-1">Notes</p>
                <p className="text-sm whitespace-pre-wrap text-foreground/80">
                  {ticket.notes || ticket.reason_notes || 'No notes available.'}
                </p>
              </InfoCard>
            </div>
          </TabsContent>

          <TabsContent value="timeline" className="flex-1 overflow-y-auto scrollbar-hide">
            {eventsLoading ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
                <p>Loading timeline...</p>
              </div>
            ) : events.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <History className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="font-medium text-base">No Timeline Events</h3>
                <p className="text-muted-foreground max-w-sm mt-1 text-sm">
                  No events recorded for this ticket yet.
                </p>
              </div>
            ) : (
              <div className="px-4 sm:px-6 py-5">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-5">Timeline</h3>
                <div className="relative pl-6 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-muted">
                  {events.map((event: any) => {
                    const label = EVENT_LABELS[event.event_type as keyof typeof EVENT_LABELS] || event.event_type;
                    return (
                      <div key={event.id} className="relative">
                        <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full border-2 border-background bg-muted-foreground" />
                        <div className="flex flex-col gap-1">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-medium text-sm">{label}</h4>
                            <span className="text-xs text-muted-foreground shrink-0">
                              {format(new Date(event.event_at), 'MMM d, yyyy HH:mm')}
                            </span>
                          </div>
                          {event.event_payload && Object.keys(event.event_payload).length > 0 && (
                            <div className="mt-1 text-xs bg-muted/40 px-3 py-2 rounded-lg text-muted-foreground">
                              {event.event_payload.stage && <span>Stage: {STAGE_LABELS[event.event_payload.stage as keyof typeof STAGE_LABELS] || event.event_payload.stage}</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
