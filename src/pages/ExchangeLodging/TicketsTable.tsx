import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableProps } from '@/components/ui/DataTable';
import { AlertTriangle, Calculator } from 'lucide-react';
import { Link } from 'react-router-dom';
import { REASON_LABELS, STAGE_LABELS, type Ticket } from '@/types/database';
import { format } from 'date-fns';
import { useState } from 'react';

interface TicketsTableProps {
  tickets?: Ticket[];
  isLoading?: boolean;
  onTicketSelect?: (ticket: Ticket) => void;
}

export function TicketsTable({ tickets, isLoading, onTicketSelect }: TicketsTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  const totalPages = Math.max(1, Math.ceil((tickets?.length || 0) / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedTickets = tickets?.slice(startIndex, endIndex) || [];

  const columns = [
    {
      key: 'order_id',
      label: 'Order ID',
      render: (value: string, row: Ticket) => (
        <div className="flex items-center gap-2">
          <Link to={`/ticket/${row.id}`} className="text-primary hover:underline font-medium">
            {value}
          </Link>
          {onTicketSelect && (
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
          <div className="text-xs text-muted-foreground">{row.customer_phone}</div>
          {row.sla_breached && (
            <span className="sla-breach-badge ml-2">
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
