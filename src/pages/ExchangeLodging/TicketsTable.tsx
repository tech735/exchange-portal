import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BulkActionToolbar, BulkAction } from '@/components/ui/bulk-action-toolbar';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { MoreHorizontal, Eye, Trash2, Calculator, ChevronRight, ExternalLink } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { REASON_LABELS, STAGE_LABELS, STATUS_LABELS, type Ticket, type TicketStatus, type TicketStage } from '@/types/database';
import { format } from 'date-fns';
import { useUser } from '@/contexts/UserContext';
import { useDeleteTicket } from '@/hooks/useTickets';
import { useToast } from '@/hooks/use-toast';
import { exportTicketsToCSV } from '@/utils/exportUtils';
import { TicketDetailsDrawer } from './TicketDetailsDrawer';

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

interface TicketsTableProps {
  tickets?: Ticket[];
  isLoading?: boolean;
  onTicketSelect?: (ticket: Ticket) => void;
  onMarkCollected?: (ticket: Ticket) => void;
  productPrices?: Record<string, number>;
}

export function TicketsTable({ tickets = [], isLoading, onTicketSelect, onMarkCollected, productPrices }: TicketsTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // The drawer stays mounted and is driven by `drawerOpen` so Radix runs its own
  // close sequence — unmounting it instead strands the body pointer-events lock.
  const [viewingIndex, setViewingIndex] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const openDrawerForTicket = (ticketId: string) => {
    const globalIdx = tickets.findIndex((t) => t.id === ticketId);
    if (globalIdx < 0) return;
    setViewingIndex(globalIdx);
    setDrawerOpen(true);
  };

  const location = useLocation();
  const navigate = useNavigate();
  const { user, hasFullAccess } = useUser();
  const deleteTicket = useDeleteTicket();
  const { toast } = useToast();

  const totalPages = Math.max(1, Math.ceil(tickets.length / itemsPerPage));
  const indexOfFirstItem = (currentPage - 1) * itemsPerPage;
  const indexOfLastItem = indexOfFirstItem + itemsPerPage;
  const currentTickets = tickets.slice(indexOfFirstItem, indexOfLastItem);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds(new Set());
  }, [tickets.length]);

  const selectAllOnPage = currentTickets.length > 0 && currentTickets.every((t) => selectedIds.has(t.id));

  const handleSelectAllOnPage = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      currentTickets.forEach((t) => (checked ? next.add(t.id) : next.delete(t.id)));
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
    setSelectedIds(new Set(tickets.map((t) => t.id)));
  };

  const clearSelection = () => setSelectedIds(new Set());

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

  const handleBulkDelete = async () => {
    if (window.confirm(`Delete ${selectedIds.size} selected tickets? This cannot be undone.`)) {
      for (const id of selectedIds) {
        try {
          await deleteTicket.mutateAsync(id);
        } catch {}
      }
      clearSelection();
      toast({ title: 'Tickets Deleted', description: `${selectedIds.size} tickets deleted.` });
    }
  };

  const bulkPrimaryActions: BulkAction[] = [
    {
      label: 'Export Selected',
      onClick: () => {
        const selected = tickets.filter((t) => selectedIds.has(t.id));
        exportTicketsToCSV(selected);
      },
    },
  ];

  const bulkOverflowActions: BulkAction[] = [
    ...(hasFullAccess() || user?.role === 'ADMIN'
      ? [{ label: 'Delete Selected', onClick: handleBulkDelete, destructive: true }]
      : []),
  ];

  const calculateNetAmount = (ticket: Ticket): number => {
    const deliveryCharge = 150;
    const calculateItemValue = (items: any[]): number => {
      return items.reduce((total: number, item: any) => {
        const itemPrice = productPrices?.[item.sku] || 1000;
        return total + (itemPrice * (item.qty || 0));
      }, 0);
    };
    const returnItemsValue = calculateItemValue(ticket.return_items || []);
    const exchangeItemsValue = calculateItemValue(ticket.exchange_items || []);
    return exchangeItemsValue - returnItemsValue + deliveryCharge;
  };

  const getPaymentBadge = (ticket: Ticket) => {
    const isPaid = !!(ticket.is_paid || ticket.exchange_completed_at);
    const isRefundedAlready = (ticket.refund_amount || 0) > 0;
    if (isPaid) {
      return isRefundedAlready
        ? <Badge variant="warning">Refunded</Badge>
        : <Badge variant="paid">Paid</Badge>;
    }
    return <Badge variant="unpaid">Unpaid</Badge>;
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
      {/* Mobile card list (< lg) */}
      <div className="block lg:hidden rounded-xl overflow-hidden border border-border bg-card">
        {currentTickets.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No exchange tickets found matching your criteria
          </p>
        ) : (
          <>
            {currentTickets.map((ticket, idx) => (
              <div
                key={ticket.id}
                className={`px-4 py-3 flex items-center gap-3 cursor-pointer active:bg-muted/50 transition-colors ${idx < currentTickets.length - 1 ? 'border-b border-border' : ''}`}
                onClick={() => openDrawerForTicket(ticket.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-[15px] text-foreground leading-snug truncate">#{ticket.order_id}</span>
                    <Badge variant={statusVariants[ticket.status] as any} className="shrink-0 text-[11px]">
                      {STATUS_LABELS[ticket.status]}
                    </Badge>
                  </div>
                  <p className="text-[13px] text-foreground mt-0.5 leading-snug truncate">
                    {ticket.customer_name}
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-snug truncate">
                    {ticket.customer_phone}
                  </p>
                  <p className="text-[12px] text-muted-foreground leading-snug">
                    {REASON_LABELS[ticket.reason_code]} · {format(new Date(ticket.created_at), 'MMM d, HH:mm')}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0" />
              </div>
            ))}

            {/* Mobile pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <span className="text-xs text-muted-foreground">
                {indexOfFirstItem + 1}–{Math.min(indexOfLastItem, tickets.length)} of {tickets.length}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline" size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="h-8 w-8 p-0"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </Button>
                <Button
                  variant="outline" size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="h-8 w-8 p-0"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Desktop table (>= lg) */}
      <div className="hidden lg:block">
        <Card className="border shadow-card overflow-hidden">
          <Table className="table-fixed">
            <colgroup>
              <col className="w-[4%]" />
              <col className="w-[18%]" />
              <col className="w-[20%]" />
              <col className="w-[14%]" />
              <col className="w-[15%]" />
              <col className="w-[14%]" />
              <col className="w-[10%]" />
              <col className="w-[5%]" />
            </colgroup>
            <TableHeader>
              {selectedIds.size > 0 ? (
                <TableRow>
                  <TableHead colSpan={8} className="p-2">
                    <BulkActionToolbar
                      selectedCount={selectedIds.size}
                      totalMatching={tickets.length}
                      onSelectAllMatching={handleSelectAllMatching}
                      onClearSelection={clearSelection}
                      primaryActions={bulkPrimaryActions}
                      overflowActions={bulkOverflowActions}
                      itemLabel="selected"
                    />
                  </TableHead>
                </TableRow>
              ) : (
                <TableRow>
                  <TableHead>
                    <Checkbox
                      id="select-all-tickets"
                      name="select-all-tickets"
                      checked={selectAllOnPage}
                      onCheckedChange={(checked) => handleSelectAllOnPage(checked === true)}
                      aria-label="Select all tickets on this page"
                    />
                  </TableHead>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              )}
            </TableHeader>
            <TableBody>
              {currentTickets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                    No exchange tickets found matching your criteria
                  </TableCell>
                </TableRow>
              ) : (
                currentTickets.map((ticket) => (
                  <TableRow
                    key={ticket.id}
                    className="transition-colors"
                    data-state={selectedIds.has(ticket.id) ? 'selected' : undefined}
                  >
                    <TableCell>
                      <Checkbox
                        id={`select-ticket-${ticket.id}`}
                        name={`select-ticket-${ticket.id}`}
                        checked={selectedIds.has(ticket.id)}
                        onCheckedChange={(checked) => handleSelectTicket(ticket.id, checked === true)}
                        aria-label={`Select ticket ${ticket.order_id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="font-medium truncate text-sm">{ticket.order_id}</p>
                        <Badge variant={statusVariants[ticket.status] as any} className="text-[10px] shrink-0">
                          {STATUS_LABELS[ticket.status]}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="min-w-0">
                        <p className="font-medium truncate text-sm leading-snug">{ticket.customer_name}</p>
                        <p className="text-xs text-muted-foreground truncate leading-snug">{ticket.customer_phone}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {REASON_LABELS[ticket.reason_code]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={stageVariants[ticket.stage] as any || 'outline'}>
                        {STAGE_LABELS[ticket.stage as keyof typeof STAGE_LABELS] || ticket.stage}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(ticket.created_at), 'MMM d, HH:mm')}
                    </TableCell>
                    <TableCell>
                      {getPaymentBadge(ticket)}
                    </TableCell>
                    <TableCell>
                      {/* modal={false} keeps the menu from adding a second body
                          pointer-events lock underneath the details drawer. */}
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem
                            className="gap-2"
                            onSelect={() => openDrawerForTicket(ticket.id)}
                          >
                            <Eye className="w-4 h-4 text-muted-foreground" />View details
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2" asChild>
                            <Link to={`/ticket/${ticket.id}`} state={{ from: location.pathname }}>
                              <ExternalLink className="w-4 h-4 text-muted-foreground" />Full page view
                            </Link>
                          </DropdownMenuItem>
                          {onTicketSelect && ticket.status !== 'IN_PROCESS' && (
                            <DropdownMenuItem className="gap-2" onClick={() => onTicketSelect(ticket)}>
                              <Calculator className="w-4 h-4 text-muted-foreground" />Calculator
                            </DropdownMenuItem>
                          )}
                          {onMarkCollected && !ticket.is_paid && !ticket.exchange_completed_at && (ticket.status === 'IN_PROCESS' || ticket.status === 'NEW') && (
                            <DropdownMenuItem className="gap-2" onClick={() => onMarkCollected(ticket)}>
                              <Calculator className="w-4 h-4 text-muted-foreground" />Mark Paid
                            </DropdownMenuItem>
                          )}
                          {(hasFullAccess() || user?.role === 'ADMIN') && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="gap-2 text-destructive focus:text-destructive"
                                onClick={() => handleDelete(ticket.id)}
                              >
                                <Trash2 className="w-4 h-4" />Delete ticket
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        {/* Desktop Footer Stats and Pagination */}
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-muted-foreground">
            Showing {currentTickets.length > 0 ? indexOfFirstItem + 1 : 0} to {Math.min(indexOfLastItem, tickets.length)} of {tickets.length} tickets
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

      {/* Right Drawer — matches Asset Tracker's Sheet pattern. Kept mounted and
          toggled via `open` so Radix always runs its own close/cleanup. */}
      <TicketDetailsDrawer
        tickets={tickets}
        currentIndex={viewingIndex ?? -1}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onNavigate={(index) => setViewingIndex(index)}
        onDelete={handleDelete}
        onMarkCollected={onMarkCollected}
        productPrices={productPrices}
      />
    </>
  );
}
