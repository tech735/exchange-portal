import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableProps, Pagination } from '@/components/ui/DataTable';
import { AlertTriangle, CheckCircle, Clock, IndianRupee } from 'lucide-react';
import { Link } from 'react-router-dom';
import { STAGE_LABELS, type Ticket } from '@/types/database';
import { format } from 'date-fns';
import { useState } from 'react';
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

  const totalPages = Math.ceil((tickets?.length || 0) / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedTickets = tickets?.slice(startIndex, endIndex) || [];

  // Calculate refund amount for a ticket
  const calculateRefundAmount = (ticket: Ticket): number => {
    const calculateItemValue = (items: any[]): number => {
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
      render: (_: any, row: Ticket) => {
        const isCollected = row.sent_to_invoicing_at ? true : false;
        const refundAmount = calculateRefundAmount(row);
        const needsRefund = refundAmount > 0;
        
        return (
          <div className="flex flex-col gap-1">
            {needsRefund ? (
              <div className="flex items-center gap-2">
                <div>
                  <div className="text-sm font-medium text-orange-500">Refund ₹{refundAmount.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">To be refunded</div>
                </div>
              </div>
            ) : isCollected ? (
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <div>
                  <div className="text-sm font-medium text-green-600">Collected</div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(row.sent_to_invoicing_at!), 'MMM d, HH:mm')}
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
      render: (_: any, row: Ticket) => {
        const refundAmount = calculateRefundAmount(row);
        const needsRefund = refundAmount > 0;
        
        return (
          <div className="flex gap-2">
            {['EXCHANGE_COMPLETED', 'INVOICING_PENDING'].includes(row.stage) && (
              <Button size="sm" onClick={() => onInvoiceDone(row.id)}>
                <CheckCircle className="h-4 w-4 mr-1" />
                Invoice Done
              </Button>
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
  );
}
