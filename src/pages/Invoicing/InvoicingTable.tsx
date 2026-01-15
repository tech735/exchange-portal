import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableProps, Pagination } from '@/components/ui/DataTable';
import { AlertTriangle, CheckCircle, Clock, IndianRupee } from 'lucide-react';
import { Link } from 'react-router-dom';
import { STAGE_LABELS, type Ticket } from '@/types/database';
import { format } from 'date-fns';
import { useState } from 'react';

interface InvoicingTableProps {
  tickets?: Ticket[];
  isLoading?: boolean;
  onInvoiceDone: (id: string) => Promise<void>;
  onClose: (id: string) => Promise<void>;
}

export function InvoicingTable({ tickets, isLoading, onInvoiceDone, onClose }: InvoicingTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  const totalPages = Math.ceil((tickets?.length || 0) / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedTickets = tickets?.slice(startIndex, endIndex) || [];

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
      label: 'Payment Collected',
      render: (_: any, row: Ticket) => {
        const isCollected = row.sent_to_invoicing_at ? true : false;
        return (
          <div className="flex items-center gap-2">
            {isCollected ? (
              <>
                <CheckCircle className="h-4 w-4 text-green-600" />
                <div>
                  <div className="text-sm font-medium text-green-600">Collected</div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(row.sent_to_invoicing_at!), 'MMM d, HH:mm')}
                  </div>
                </div>
              </>
            ) : (
              <>
                <Clock className="h-4 w-4 text-orange-500" />
                <div className="text-sm font-medium text-orange-500">Pending</div>
              </>
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
      render: (_: any, row: Ticket) => (
        <div className="flex gap-2">
          {['EXCHANGE_COMPLETED', 'INVOICING_PENDING'].includes(row.stage) && (
            <Button size="sm" onClick={() => onInvoiceDone(row.id)}>
              <CheckCircle className="h-4 w-4 mr-1" />
              Invoice Done
            </Button>
          )}
          {row.stage === 'INVOICED' && (
            <Button size="sm" variant="outline" onClick={() => onClose(row.id)}>
              Close Ticket
            </Button>
          )}
        </div>
      )
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
