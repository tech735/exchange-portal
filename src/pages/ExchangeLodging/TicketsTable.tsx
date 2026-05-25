import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableProps } from '@/components/ui/DataTable';
import { AlertTriangle, Calculator, ChevronRight, Trash2 } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { REASON_LABELS, STAGE_LABELS, type Ticket } from '@/types/database';
import { format, isToday, isYesterday, isThisWeek } from 'date-fns';
import { useState, useMemo } from 'react';
import { useUser } from '@/contexts/UserContext';
import { useDeleteTicket } from '@/hooks/useTickets';
import { useToast } from '@/hooks/use-toast';

interface TicketsTableProps {
  tickets?: Ticket[];
  isLoading?: boolean;
  onTicketSelect?: (ticket: Ticket) => void;
  onMarkCollected?: (ticket: Ticket) => void;
  productPrices?: Record<string, number>;
}

export function TicketsTable({ tickets, isLoading, onTicketSelect, onMarkCollected, productPrices }: TicketsTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const location = useLocation();
  const { user, hasFullAccess } = useUser();
  const deleteTicket = useDeleteTicket();
  const { toast } = useToast();

  const navigate = useNavigate();

  const totalPages = Math.max(1, Math.ceil((tickets?.length || 0) / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedTickets = tickets?.slice(startIndex, endIndex) || [];

  const groupedTickets = useMemo(() => {
    const groups: { label: string; key: string; tickets: Ticket[] }[] = [];
    const seen: Record<string, number> = {};
    paginatedTickets.forEach(ticket => {
      const date = new Date(ticket.created_at);
      const key = format(date, 'yyyy-MM-dd');
      let label: string;
      if (isToday(date)) label = 'Today';
      else if (isYesterday(date)) label = 'Yesterday';
      else if (isThisWeek(date, { weekStartsOn: 1 })) label = format(date, 'EEEE');
      else label = format(date, 'MMMM d');
      if (seen[key] === undefined) { seen[key] = groups.length; groups.push({ label, key, tickets: [] }); }
      groups[seen[key]].tickets.push(ticket);
    });
    return groups;
  }, [paginatedTickets]);

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this ticket? This action cannot be undone.')) {
      try {
        await deleteTicket.mutateAsync(id);
        toast({ title: 'Ticket Deleted', description: 'The ticket has been successfully deleted.' });
      } catch (error) {
        toast({ title: 'Error', description: 'Failed to delete ticket', variant: 'destructive' });
      }
    }
  };

  const calculateNetAmount = (ticket: Ticket): number => {
    const deliveryCharge = 150;
    const calculateItemValue = (items: any[]): number => {
      return items.reduce((total, item) => {
        const itemPrice = productPrices?.[item.sku] || 1000;
        return total + (itemPrice * (item.qty || 0));
      }, 0);
    };

    const returnItemsValue = calculateItemValue(ticket.return_items || []);
    const exchangeItemsValue = calculateItemValue(ticket.exchange_items || []);
    return exchangeItemsValue - returnItemsValue + deliveryCharge;
  };

  const columns = [
    {
      key: 'order_id',
      label: 'Order ID',
      render: (value: string, row: Ticket) => (
        <div className="flex items-center gap-2">
          <Link to={`/ticket/${row.id}`} state={{ from: location.pathname }} className="text-primary hover:underline font-medium">
            {value}
          </Link>
          {onTicketSelect && row.status !== 'IN_PROCESS' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onTicketSelect(row)}
              className="ml-2"
            >
              <Calculator className="h-3 w-3" />
            </Button>
          )}
        </div>
      )
    },
    {
      key: 'customer_name',
      label: 'Customer',
      render: (value: string, row: Ticket) => (
        <div>
          <div>{value}</div>
          <div className="text-xs text-muted-foreground flex flex-col">
            <span>{row.customer_phone}</span>
            {row.customer_email && <span>{row.customer_email}</span>}
          </div>
          {row.sla_breached && (
            <span className="sla-breach-badge ml-2 mt-1">
              <AlertTriangle className="h-3 w-3" />
            </span>
          )}
        </div>
      )
    },
    {
      key: 'reason_code',
      label: 'Reason',
      render: (value: string) => (
        <Badge variant="secondary">{REASON_LABELS[value]}</Badge>
      )
    },
    {
      key: 'stage',
      label: 'Stage',
      render: (value: string) => (
        <Badge variant="outline">{STAGE_LABELS[value]}</Badge>
      )
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (value: string) => (
        <div className="text-muted-foreground">
          {format(new Date(value), 'MMM d, HH:mm')}
        </div>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_: unknown, row: Ticket) => {
        const netAmount = calculateNetAmount(row);
        const isRefund = netAmount < 0;
        const isZero = netAmount === 0;

        return (
          <div className="flex items-center gap-2">
            {(row.status === 'IN_PROCESS' || row.status === 'NEW') && (
              (row.is_paid || row.exchange_completed_at) ? (
                (row.refund_amount || 0) > 0 ? (
                  <Badge variant="secondary" className="bg-orange-100 text-orange-800 hover:bg-orange-100">
                    Refunded
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-100">
                    Paid
                  </Badge>
                )
              ) : (
                onMarkCollected && (
                  isZero ? (
                    <Badge
                      variant="secondary"
                      className="bg-blue-50 text-blue-600 border border-blue-100 cursor-pointer hover:bg-blue-100 whitespace-nowrap"
                      onClick={(e) => { e.stopPropagation(); onMarkCollected(row); }}
                    >
                      No Amount to Collect
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMarkCollected(row);
                      }}
                      className="whitespace-nowrap"
                    >
                      {isRefund ? "Send to Refund" : "Mark Paid"}
                    </Button>
                  )
                )
              )
            )}
            {(hasFullAccess() || user?.role === 'ADMIN') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(row.id);
                }}
                className="text-red-500 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        );
      }
    }
  ];

  return (
    <>
      {/* Mobile list (< lg) */}
      <div className="block lg:hidden rounded-2xl overflow-hidden border border-border bg-card">
        {isLoading ? (
          <div className="flex justify-center py-16"><div className="loader" /></div>
        ) : paginatedTickets.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No tickets found</p>
        ) : (
          <>
            {groupedTickets.map(({ label, key, tickets: group }) => (
              <div key={key}>
                <div className="px-4 py-1.5 bg-muted/40 border-b border-border">
                  <span className="text-xs font-medium text-muted-foreground">{label}</span>
                </div>
                {group.map((ticket, idx) => {
                  const netAmount = calculateNetAmount(ticket);
                  const isRefund = netAmount < 0;
                  const isZero = netAmount === 0;
                  const isPaid = !!(ticket.is_paid || ticket.exchange_completed_at);
                  const isRefundedAlready = (ticket.refund_amount || 0) > 0;
                  const itemCount = ticket.return_items?.length || 0;
                  const time = format(new Date(ticket.created_at), 'h:mma');
                  const amountLabel = isPaid
                    ? (isRefundedAlready ? 'Refunded' : 'Paid')
                    : isZero ? 'No amount'
                    : isRefund ? `₹${Math.abs(netAmount)} refund`
                    : `₹${netAmount} due`;

                  return (
                    <div
                      key={ticket.id}
                      className={`px-4 py-3 flex items-center gap-2 cursor-pointer active:bg-muted/50 transition-colors ${idx < group.length - 1 ? 'border-b border-border' : ''}`}
                      onClick={() => navigate(`/ticket/${ticket.id}`, { state: { from: location.pathname } })}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-[15px] text-foreground leading-snug">#{ticket.order_id}</span>
                          <span className={`text-[14px] font-medium shrink-0 ${isPaid && isRefundedAlready ? 'text-orange-600' : isPaid ? 'text-green-600' : isRefund && !isPaid ? 'text-orange-600' : 'text-foreground'}`}>
                            {amountLabel}
                          </span>
                        </div>
                        <p className="text-[13px] text-muted-foreground mt-0.5 leading-snug">
                          {ticket.customer_name} · {itemCount} {itemCount === 1 ? 'item' : 'items'} · {time}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <Badge variant="outline" className="text-[11px] px-2 py-0.5 h-auto rounded-full">
                            {STAGE_LABELS[ticket.stage as keyof typeof STAGE_LABELS] || ticket.stage}
                          </Badge>
                          {isPaid ? (
                            <Badge variant="secondary" className={`text-[11px] px-2 py-0.5 h-auto rounded-full ${isRefundedAlready ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}`}>
                              {isRefundedAlready ? 'Refunded' : 'Paid'}
                            </Badge>
                          ) : (ticket.status === 'IN_PROCESS' || ticket.status === 'NEW') && onMarkCollected && (
                            isZero ? (
                              <Badge
                                variant="secondary"
                                className="bg-blue-50 text-blue-600 border border-blue-100 cursor-pointer hover:bg-blue-100 text-[11px] px-2 py-0.5 h-auto rounded-full"
                                onClick={(e) => { e.stopPropagation(); onMarkCollected(ticket); }}
                              >
                                No Amount to Collect
                              </Badge>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 text-[11px] px-2 rounded-full"
                                onClick={(e) => { e.stopPropagation(); onMarkCollected(ticket); }}
                              >
                                {isRefund ? 'Send to Refund' : 'Mark Paid'}
                              </Button>
                            )
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                    </div>
                  );
                })}
              </div>
            ))}
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <span className="text-xs text-muted-foreground">Page {currentPage} of {totalPages}</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="h-8 w-8 p-0">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="h-8 w-8 p-0">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Desktop table (≥ lg) */}
      <div className="hidden lg:block">
        <DataTable
          title="Exchange Tickets"
          data={paginatedTickets}
          columns={columns}
          isLoading={isLoading}
          emptyMessage="No tickets found"
          onSelectionChange={(selectedRows) => {
            console.log('Selected exchange tickets:', selectedRows);
          }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Items per page:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                className="w-20 px-2 py-1 border rounded text-sm"
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(currentPage - 1)} disabled={currentPage === 1}>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </Button>
              <span className="text-sm text-muted-foreground px-2">Page {currentPage} of {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(currentPage + 1)} disabled={currentPage === totalPages}>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </Button>
            </div>
          </div>
        </DataTable>
      </div>
    </>
  );
}
