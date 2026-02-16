import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableProps } from '@/components/ui/DataTable';
import { AlertTriangle, Check, Package, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { STAGE_LABELS, type Ticket, type TicketItem } from '@/types/database';
import { useState } from 'react';

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

  const totalPages = Math.max(1, Math.ceil((tickets?.length || 0) / itemsPerPage));
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
      key: 'return_items',
      label: 'Items',
      render: (value: TicketItem[]) => (
        <div className="max-w-xs">
          {value.map((item, idx) => (
            <div key={idx} className="text-xs bg-muted px-2 py-1 rounded mb-1">
              <Package className="h-3 w-3 inline mr-1" />
              {item.product_name} ({item.qty})
            </div>
          ))}
        </div>
      )
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
          </select >
        </div >

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
      </div >
    </DataTable>
  );
}
