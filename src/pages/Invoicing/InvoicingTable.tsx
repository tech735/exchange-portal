import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableProps, Pagination } from '@/components/ui/DataTable';
import { AlertTriangle, CheckCircle, ChevronRight, Clock, IndianRupee } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { STAGE_LABELS, type Ticket, type TicketItem } from '@/types/database';
import { format, isToday, isYesterday, isThisWeek } from 'date-fns';
import { useState, useMemo } from 'react';
import { useProductPrices } from '@/hooks/useProductPrices';

interface InvoicingTableProps {
  tickets?: Ticket[];
  isLoading?: boolean;
  onInvoiceDone: (id: string) => Promise<void>;
  onClose: (id: string) => Promise<void>;
  onSendToRefund: (id: string) => Promise<void>;
}

export function InvoicingTable({ tickets, isLoading, onInvoiceDone, onClose, onSendToRefund }: InvoicingTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const { data: productPrices } = useProductPrices();
  const [processingInvoices, setProcessingInvoices] = useState<Set<string>>(() => {
    const saved = sessionStorage.getItem('processingInvoices');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  const handleStartProcessing = (id: string) => {
    setProcessingInvoices((prev) => {
      const newSet = new Set(prev);
      newSet.add(id);
      sessionStorage.setItem('processingInvoices', JSON.stringify(Array.from(newSet)));
      return newSet;
    });
    window.open("https://books.zoho.in/app/852503254#/salesorders", "_blank", "noopener,noreferrer");
  };

  const handleInvoiceDone = async (id: string) => {
    setProcessingInvoices((prev) => {
      const newSet = new Set(prev);
      newSet.delete(id);
      sessionStorage.setItem('processingInvoices', JSON.stringify(Array.from(newSet)));
      return newSet;
    });
    await onInvoiceDone(id);
  };

  const navigate = useNavigate();
  const location = useLocation();

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

  // Calculate refund amount for a ticket
  const calculateRefundAmount = (ticket: Ticket): number => {
    const calculateItemValue = (items: TicketItem[]): number => {
      return items.reduce((total, item) => {
        const itemPrice = productPrices?.[item.sku] || 1000;
        return total + (itemPrice * item.qty);
      }, 0);
    };

    const returnItemsValue = calculateItemValue(ticket.return_items || []);
    const exchangeItemsValue = calculateItemValue(ticket.exchange_items || []);
    const deliveryCharge = 150; // Default delivery charge

    // Refund is needed when return items value > exchange items value
    const netAmount = exchangeItemsValue - returnItemsValue + deliveryCharge;
    return netAmount < 0 ? Math.abs(netAmount) : 0;
  };

  const columns = [
    {
      key: 'order_id',
      label: 'Order ID',
      render: (value: string, row: Ticket) => (
        <Link to={`/ticket/${row.id}`} className="text-primary hover:underline font-medium">
          {value}
        </Link>
      )
    },
    {
      key: 'customer_name',
      label: 'Customer',
      render: (value: string, row: Ticket) => (
        <div>
          <div>{value}</div>
          {row.sla_breached && (
            <span className="sla-breach-badge ml-2">
              <AlertTriangle className="h-3 w-3" />
            </span>
          )}
        </div>
      )
    },
    {
      key: 'exchange_completed_at',
      label: 'Exchange Completed',
      render: (value: string) => (
        <div className="text-muted-foreground">
          {value ? format(new Date(value), 'MMM d, HH:mm') : '-'}
        </div>
      )
    },
    {
      key: 'payment_collected',
      label: 'Payment/Refund',
      render: (_: unknown, row: Ticket) => {
        const isCollected = row.sent_to_invoicing_at || (row.amount_collected || 0) > 0;
        const refundAmount = calculateRefundAmount(row);
        const needsRefund = refundAmount > 0;
        const collectedDate = row.sent_to_invoicing_at || row.exchange_completed_at;
        const isRefunded = row.refund_status === 'PROCESSED';

        return (
          <div className="flex flex-col gap-1">
            {needsRefund ? (
              isRefunded ? (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-orange-500" />
                  <div>
                    <div className="text-sm font-medium text-orange-500">Refunded ₹{refundAmount.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">
                      {row.refund_sent_at ? format(new Date(row.refund_sent_at), 'MMM d, HH:mm') : '-'}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div>
                    <div className="text-sm font-medium text-orange-500">Refund ₹{refundAmount.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">To be refunded</div>
                  </div>
                </div>
              )
            ) : isCollected ? (
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <div>
                  <div className="text-sm font-medium text-green-600">Collected</div>
                  <div className="text-xs text-muted-foreground">
                    {collectedDate ? format(new Date(collectedDate), 'MMM d, HH:mm') : '-'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-500" />
                <div className="text-sm font-medium text-orange-500">Pending</div>
              </div>
            )}
          </div>
        );
      }
    },
    {
      key: 'stage',
      label: 'Stage',
      render: (value: string) => (
        <Badge variant="outline">{STAGE_LABELS[value]}</Badge>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_: unknown, row: Ticket) => {
        const refundAmount = calculateRefundAmount(row);
        const needsRefund = refundAmount > 0;

        return (
          <div className="flex gap-2">
            {['EXCHANGE_BOOKED', 'EXCHANGE_COMPLETED', 'INVOICING_PENDING'].includes(row.stage) && (
              <div className="flex flex-col gap-2">
                {!processingInvoices.has(row.id) ? (
                  <Button size="sm" onClick={() => handleStartProcessing(row.id)}>
                    Process Invoice
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => handleInvoiceDone(row.id)}>
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Invoice Done
                  </Button>
                )}
              </div>
            )}
            {row.stage === 'INVOICED' && needsRefund && (
              <Button size="sm" onClick={() => onSendToRefund(row.id)}>
                <CheckCircle className="h-4 w-4 mr-1" />
                Mark as Refunded
              </Button>
            )}
            {row.stage === 'INVOICED' && !needsRefund && (
              <Button size="sm" variant="outline" onClick={() => onClose(row.id)}>
                Close Ticket
              </Button>
            )}
            {row.stage === 'TO_BE_REFUNDED' && (
              <Button size="sm" variant="outline" onClick={() => onClose(row.id)}>
                Close Ticket
              </Button>
            )}
            {row.stage === 'CLOSED' && row.refund_status === 'PROCESSED' && !row.closed_at && (
              <Button size="sm" variant="outline" onClick={() => onClose(row.id)}>
                Finalize Ticket
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
                  const refundAmount = calculateRefundAmount(ticket);
                  const needsRefund = refundAmount > 0;
                  const isRefunded = ticket.refund_status === 'PROCESSED';
                  const exchangedAt = ticket.exchange_completed_at
                    ? format(new Date(ticket.exchange_completed_at), 'MMM d')
                    : null;
                  const time = format(new Date(ticket.created_at), 'h:mma');
                  const paymentLabel = needsRefund
                    ? (isRefunded ? `₹${refundAmount} refunded` : `₹${refundAmount} refund due`)
                    : 'Collected';

                  return (
                    <div
                      key={ticket.id}
                      className={`px-4 py-3 flex items-center gap-2 cursor-pointer active:bg-muted/50 transition-colors ${idx < group.length - 1 ? 'border-b border-border' : ''}`}
                      onClick={() => navigate(`/ticket/${ticket.id}`, { state: { from: location.pathname } })}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-[15px] text-foreground leading-snug">#{ticket.order_id}</span>
                          <span className={`text-[14px] font-medium shrink-0 ${needsRefund && !isRefunded ? 'text-orange-600' : isRefunded ? 'text-green-600' : 'text-foreground'}`}>
                            {paymentLabel}
                          </span>
                        </div>
                        <p className="text-[13px] text-muted-foreground mt-0.5 leading-snug">
                          {ticket.customer_name}
                          {exchangedAt ? ` · Exchanged ${exchangedAt}` : ` · ${time}`}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap" onClick={(e) => e.stopPropagation()}>
                          <Badge variant="outline" className="text-[11px] px-2 py-0.5 h-auto rounded-full">
                            {STAGE_LABELS[ticket.stage] || ticket.stage}
                          </Badge>
                          {['EXCHANGE_BOOKED', 'EXCHANGE_COMPLETED', 'INVOICING_PENDING'].includes(ticket.stage) && (
                            !processingInvoices.has(ticket.id) ? (
                              <Button size="sm" className="h-6 text-[11px] px-2 rounded-full" onClick={() => handleStartProcessing(ticket.id)}>
                                Process Invoice
                              </Button>
                            ) : (
                              <Button size="sm" variant="outline" className="h-6 text-[11px] px-2 rounded-full" onClick={() => handleInvoiceDone(ticket.id)}>
                                <CheckCircle className="h-3 w-3 mr-1" />Invoice Done
                              </Button>
                            )
                          )}
                          {ticket.stage === 'INVOICED' && needsRefund && (
                            <Button size="sm" className="h-6 text-[11px] px-2 rounded-full" onClick={() => onSendToRefund(ticket.id)}>
                              Mark Refunded
                            </Button>
                          )}
                          {ticket.stage === 'INVOICED' && !needsRefund && (
                            <Button size="sm" variant="outline" className="h-6 text-[11px] px-2 rounded-full" onClick={() => onClose(ticket.id)}>
                              Close
                            </Button>
                          )}
                          {(ticket.stage === 'TO_BE_REFUNDED' || ticket.stage === 'CLOSED') && (
                            <Button size="sm" variant="outline" className="h-6 text-[11px] px-2 rounded-full" onClick={() => onClose(ticket.id)}>
                              Close
                            </Button>
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
          title="Invoicing Tickets"
          data={paginatedTickets}
          columns={columns}
          isLoading={isLoading}
          emptyMessage="No tickets found"
          onSelectionChange={(selectedRows) => {
            console.log('Selected invoicing tickets:', selectedRows);
          }}
        >
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            itemsPerPage={itemsPerPage}
            onItemsPerPageChange={setItemsPerPage}
          />
        </DataTable>
      </div>
    </>
  );
}
