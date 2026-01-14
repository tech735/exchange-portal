import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableProps } from '@/components/ui/DataTable';
import { AlertTriangle, CheckCircle } from 'lucide-react';
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7 7" />
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
