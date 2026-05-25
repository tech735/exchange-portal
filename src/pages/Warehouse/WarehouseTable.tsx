import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableProps } from '@/components/ui/DataTable';
import { AlertTriangle, Check, ChevronRight, Package, X } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { STAGE_LABELS, type Ticket } from '@/types/database';
import { format, isToday, isYesterday, isThisWeek } from 'date-fns';
import { useState, useMemo } from 'react';

interface WarehouseTableProps {
  tickets?: Ticket[];
  isLoading?: boolean;
  onBookReturn: (ticket: Ticket) => void;
  onReceive: (id: string) => Promise<void>;
  onQCAction: (ticket: Ticket, action: 'APPROVE' | 'DENY') => void;
  onBookExchange: (ticket: Ticket) => void;
}

export function WarehouseTable({
  tickets,
  isLoading,
  onBookReturn,
  onReceive,
  onQCAction,
  onBookExchange,
}: WarehouseTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const location = useLocation();
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

  const columns = [
    {
      key: 'order_id',
      label: 'Order ID',
      render: (value: string, row: Ticket) => (
        <Link to={`/ticket/${row.id}`} state={{ from: location.pathname }} className="text-primary hover:underline font-medium">
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
      key: 'return_items',
      label: 'Items',
      render: (_: unknown, row: Ticket) => {
        const showExchange = row.stage === 'WAREHOUSE_APPROVED' || row.stage === 'EXCHANGE_BOOKED';
        const items = showExchange ? row.exchange_items : row.return_items;
        return (
          <div className="max-w-xs">
            <div className="text-xs text-muted-foreground mb-1">
              {showExchange ? 'Exchange Items' : 'Return Items'}
            </div>
            {items.map((item, idx) => (
              <div key={idx} className="text-xs bg-muted px-2 py-1 rounded mb-1">
                <Package className="h-3 w-3 inline mr-1" />
                {item.product_name}
                {showExchange && item.size ? ` ${item.size}` : ''}
                ({item.qty})
              </div>
            ))}
          </div>
        );
      }
    },
    {
      key: 'awb_info',
      label: 'AWB Info',
      render: (_: unknown, row: Ticket) => (
        <div className="text-xs space-y-1">
          {row.return_awb && (
            <div>Return: <span className="font-mono">{row.return_awb}</span></div>
          )}
          {row.exchange_awb && (
            <div>Exchange: <span className="font-mono">{row.exchange_awb}</span></div>
          )}
        </div>
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
      key: 'actions',
      label: 'Actions',
      render: (_: unknown, row: Ticket) => (
        <div className="flex gap-2">
          {/* TAB 1: NEW (WAREHOUSE) -> Book Return */}
          {row.stage === 'LODGED' && (
            <Button size="sm" onClick={() => onBookReturn(row)}>
              <Package className="h-4 w-4 mr-1" />
              Book Return
            </Button>
          )}

          {/* TAB 2: RETURN PENDING -> Mark Received */}
          {row.stage === 'RETURN_PENDING' && (
            <Button size="sm" onClick={() => onReceive(row.id)}>
              <Check className="h-4 w-4 mr-1" />
              Mark Received
            </Button>
          )}

          {/* TAB 3: RETURN RECEIVED -> QC Approve/Deny */}
          {row.stage === 'RETURN_RECEIVED' && (
            <>
              <Button size="sm" onClick={() => onQCAction(row, 'APPROVE')}>
                <Check className="h-4 w-4 mr-1" />
                Approve
              </Button>
              <Button size="sm" variant="destructive" onClick={() => onQCAction(row, 'DENY')}>
                <X className="h-4 w-4 mr-1" />
                Deny
              </Button>
            </>
          )}

          {/* TAB 4: APPROVED -> Book Exchange */}
          {row.stage === 'WAREHOUSE_APPROVED' && (
            <Button size="sm" onClick={() => onBookExchange(row)}>
              <Package className="h-4 w-4 mr-1" />
              Book Exchange
            </Button>
          )}

          {/* TAB 6: EXCHANGE BOOKED -> View/Complete (Optional) */}
          {row.stage === 'EXCHANGE_BOOKED' && (
            <div className="text-xs text-muted-foreground italic">
              Exchange Booked
            </div>
          )}
        </div>
      )
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
                  const firstItem = ticket.return_items?.[0];
                  const itemCount = ticket.return_items?.length || 0;
                  const time = format(new Date(ticket.created_at), 'h:mma');

                  return (
                    <div
                      key={ticket.id}
                      className={`px-4 py-3 flex items-center gap-2 cursor-pointer active:bg-muted/50 transition-colors ${idx < group.length - 1 ? 'border-b border-border' : ''}`}
                      onClick={() => navigate(`/ticket/${ticket.id}`, { state: { from: location.pathname } })}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-[15px] text-foreground leading-snug">#{ticket.order_id}</span>
                          <Badge variant="outline" className="text-[11px] px-2 py-0.5 h-auto rounded-full shrink-0">
                            {STAGE_LABELS[ticket.stage] || ticket.stage}
                          </Badge>
                        </div>
                        <p className="text-[13px] text-muted-foreground mt-0.5 leading-snug">
                          {ticket.customer_name}
                          {firstItem ? ` · ${firstItem.product_name}${itemCount > 1 ? ` +${itemCount - 1}` : ''}` : ''}
                          {` · ${time}`}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap" onClick={(e) => e.stopPropagation()}>
                          {ticket.stage === 'LODGED' && (
                            <Button size="sm" className="h-7 text-xs px-3" onClick={() => onBookReturn(ticket)}>
                              <Package className="h-3 w-3 mr-1" />Book Return
                            </Button>
                          )}
                          {ticket.stage === 'RETURN_PENDING' && (
                            <Button size="sm" className="h-7 text-xs px-3" onClick={() => onReceive(ticket.id)}>
                              <Check className="h-3 w-3 mr-1" />Mark Received
                            </Button>
                          )}
                          {ticket.stage === 'RETURN_RECEIVED' && (
                            <>
                              <Button size="sm" className="h-7 text-xs px-3" onClick={() => onQCAction(ticket, 'APPROVE')}>
                                <Check className="h-3 w-3 mr-1" />Approve
                              </Button>
                              <Button size="sm" variant="destructive" className="h-7 text-xs px-3" onClick={() => onQCAction(ticket, 'DENY')}>
                                <X className="h-3 w-3 mr-1" />Deny
                              </Button>
                            </>
                          )}
                          {ticket.stage === 'WAREHOUSE_APPROVED' && (
                            <Button size="sm" className="h-7 text-xs px-3" onClick={() => onBookExchange(ticket)}>
                              <Package className="h-3 w-3 mr-1" />Book Exchange
                            </Button>
                          )}
                          {ticket.stage === 'EXCHANGE_BOOKED' && (
                            <span className="text-xs text-muted-foreground italic">Exchange Booked</span>
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
          title="Warehouse Tickets"
          data={paginatedTickets}
          columns={columns}
          isLoading={isLoading}
          emptyMessage="No tickets found"
          onSelectionChange={(selectedRows) => {
            console.log('Selected warehouse tickets:', selectedRows);
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
