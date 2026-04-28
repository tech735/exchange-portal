import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableProps } from '@/components/ui/DataTable';
import { AlertTriangle, Calculator, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { REASON_LABELS, STAGE_LABELS, type Ticket } from '@/types/database';
import { format } from 'date-fns';
import { useState } from 'react';
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
  const { user, hasFullAccess } = useUser();
  const deleteTicket = useDeleteTicket();
  const { toast } = useToast();

  const totalPages = Math.max(1, Math.ceil((tickets?.length || 0) / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedTickets = tickets?.slice(startIndex, endIndex) || [];

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
          <Link to={`/ticket/${row.id}`} className="text-primary hover:underline font-medium">
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(currentPage - 1)}
            disabled={currentPage === 1}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Button>

          <div className="flex items-center gap-1">
            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Button>
        </div>
      </div>
    </DataTable>
  );
}
