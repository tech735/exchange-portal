import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { BulkActionToolbar, BulkAction } from '@/components/ui/bulk-action-toolbar';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { MobilePagination } from '@/components/ui/DataTable';
import { ChevronRight } from 'lucide-react';
import { STAGE_LABELS, type Ticket } from '@/types/database';
import { format, isToday, isYesterday, isThisWeek } from 'date-fns';
import { useEffect, useState, useMemo } from 'react';
import { exportTicketsToCSV } from '@/utils/exportUtils';
import { TicketDetailsDrawer } from '../ExchangeLodging/TicketDetailsDrawer';

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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // The drawer stays mounted and is driven by `drawerOpen` so Radix runs its own
  // close sequence — unmounting it instead strands the body pointer-events lock.
  const [viewingIndex, setViewingIndex] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const list = tickets || [];

  const openTicket = (id: string) => {
    const idx = list.findIndex((t) => t.id === id);
    if (idx === -1) return;
    setViewingIndex(idx);
    setDrawerOpen(true);
  };

  const totalPages = Math.max(1, Math.ceil(list.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedTickets = list.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds(new Set());
  }, [list.length]);

  const selectAllOnPage = paginatedTickets.length > 0 && paginatedTickets.every((t) => selectedIds.has(t.id));

  const handleSelectAllOnPage = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      paginatedTickets.forEach((t) => (checked ? next.add(t.id) : next.delete(t.id)));
      return next;
    });
  };

  const handleSelectTicket = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleSelectAllMatching = () => {
    setSelectedIds(new Set(list.map((t) => t.id)));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const bulkPrimaryActions: BulkAction[] = [
    {
      label: 'Export Selected',
      onClick: () => {
        const selected = list.filter((t) => selectedIds.has(t.id));
        exportTicketsToCSV(selected);
      },
    },
  ];

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

  const renderActions = (row: Ticket, compact = false) => {
    const textClass = compact ? 'text-xs' : 'text-sm';

    if (row.stage === 'LODGED') {
      return (
        <button
          type="button"
          onClick={() => onBookReturn(row)}
          className={`${textClass} font-medium text-primary transition-all duration-150 hover:text-primary/70 hover:scale-105 inline-block`}
        >
          Book Return
        </button>
      );
    }
    if (row.stage === 'RETURN_PENDING') {
      return (
        <button
          type="button"
          onClick={() => onReceive(row.id)}
          className={`${textClass} font-medium text-primary transition-all duration-150 hover:text-primary/70 hover:scale-105 inline-block`}
        >
          Mark Received
        </button>
      );
    }
    if (row.stage === 'RETURN_RECEIVED') {
      return (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => onQCAction(row, 'APPROVE')}
            className={`${textClass} font-medium text-primary transition-all duration-150 hover:text-primary/70 hover:scale-105 inline-block`}
          >
            Approve
          </button>
          <button
            type="button"
            onClick={() => onQCAction(row, 'DENY')}
            className={`${textClass} font-medium text-destructive transition-all duration-150 hover:text-destructive/70 hover:scale-105 inline-block`}
          >
            Deny
          </button>
        </div>
      );
    }
    if (row.stage === 'WAREHOUSE_APPROVED') {
      return (
        <button
          type="button"
          onClick={() => onBookExchange(row)}
          className={`${textClass} font-medium text-primary transition-all duration-150 hover:text-primary/70 hover:scale-105 inline-block`}
        >
          Book Exchange
        </button>
      );
    }
    if (row.stage === 'EXCHANGE_BOOKED') {
      return <span className="text-xs text-muted-foreground italic">Exchange Booked</span>;
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading tickets...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Mobile list (< lg) */}
      <div className="block lg:hidden rounded-2xl overflow-hidden border border-border bg-card">
        {paginatedTickets.length === 0 ? (
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
                      onClick={() => openTicket(ticket.id)}
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
                          {renderActions(ticket, true)}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                    </div>
                  );
                })}
              </div>
            ))}
            <MobilePagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </>
        )}
      </div>

      {/* Desktop table (≥ lg) */}
      <div className="hidden lg:block">
        <Card className="border shadow-card overflow-hidden">
          <Table className="table-fixed">
            <colgroup>
              <col className="w-[4%]" />
              <col className="w-[14%]" />
              <col className="w-[16%]" />
              <col className="w-[20%]" />
              <col className="w-[14%]" />
              <col className="w-[12%]" />
              <col className="w-[20%]" />
            </colgroup>
            <TableHeader>
              {selectedIds.size > 0 ? (
                <TableRow>
                  <TableHead colSpan={7} className="p-2">
                    <BulkActionToolbar
                      selectedCount={selectedIds.size}
                      totalMatching={list.length}
                      onSelectAllMatching={handleSelectAllMatching}
                      onClearSelection={clearSelection}
                      primaryActions={bulkPrimaryActions}
                      itemLabel="selected"
                    />
                  </TableHead>
                </TableRow>
              ) : (
                <TableRow>
                  <TableHead>
                    <Checkbox
                      id="select-all-warehouse-tickets"
                      name="select-all-warehouse-tickets"
                      checked={selectAllOnPage}
                      onCheckedChange={(checked) => handleSelectAllOnPage(checked === true)}
                      aria-label="Select all tickets on this page"
                    />
                  </TableHead>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>AWB Info</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              )}
            </TableHeader>
            <TableBody>
              {paginatedTickets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    No tickets found
                  </TableCell>
                </TableRow>
              ) : (
                paginatedTickets.map((ticket) => {
                  const showExchange = ticket.stage === 'WAREHOUSE_APPROVED' || ticket.stage === 'EXCHANGE_BOOKED';
                  const items = showExchange ? ticket.exchange_items : ticket.return_items;

                  return (
                    <TableRow
                      key={ticket.id}
                      className="transition-colors"
                      data-state={selectedIds.has(ticket.id) ? 'selected' : undefined}
                    >
                      <TableCell>
                        <Checkbox
                          id={`select-warehouse-ticket-${ticket.id}`}
                          name={`select-warehouse-ticket-${ticket.id}`}
                          checked={selectedIds.has(ticket.id)}
                          onCheckedChange={(checked) => handleSelectTicket(ticket.id, checked === true)}
                          aria-label={`Select ticket ${ticket.order_id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => openTicket(ticket.id)}
                          className="text-primary hover:underline font-medium text-left"
                        >
                          {ticket.order_id}
                        </button>
                      </TableCell>
                      <TableCell>
                        <div className="min-w-0">
                          <p className="font-medium truncate text-sm">{ticket.customer_name}</p>
                          <p className="text-sm text-muted-foreground truncate">{ticket.customer_phone}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs text-muted-foreground mb-1">
                          {showExchange ? 'Exchange Items' : 'Return Items'}
                        </div>
                        {items.map((item, idx) => (
                          <div key={idx} className="text-xs bg-muted px-2 py-1 rounded mb-1 truncate">
                            {item.product_name}
                            {showExchange && item.size ? ` ${item.size}` : ''}
                            {` (${item.qty})`}
                          </div>
                        ))}
                      </TableCell>
                      <TableCell className="text-xs space-y-1">
                        {ticket.return_awb && (
                          <div>Return: <span className="font-mono">{ticket.return_awb}</span></div>
                        )}
                        {ticket.exchange_awb && (
                          <div>Exchange: <span className="font-mono">{ticket.exchange_awb}</span></div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{STAGE_LABELS[ticket.stage]}</Badge>
                      </TableCell>
                      <TableCell>
                        {renderActions(ticket)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Card>

        {/* Desktop Footer Stats and Pagination */}
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-muted-foreground">
            Showing {paginatedTickets.length > 0 ? startIndex + 1 : 0} to {Math.min(endIndex, list.length)} of {list.length} tickets
          </div>
          <DataTablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            pageSize={itemsPerPage}
            setPageSize={setItemsPerPage}
          />
        </div>
      </div>

      <TicketDetailsDrawer
        tickets={list}
        currentIndex={viewingIndex ?? -1}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onNavigate={(index) => setViewingIndex(index)}
      />
    </>
  );
}
