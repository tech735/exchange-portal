import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface DataTableProps<T extends { id: string | number } = { id: string }> {
  data: T[];
  columns: {
    key: string;
    label: string;
    render?: (value: unknown, row: T) => React.ReactNode;
  }[];
  isLoading?: boolean;
  emptyMessage?: string;
  children?: React.ReactNode;
  title?: string;
  onSelectionChange?: (selectedRows: T[]) => void;
}

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  itemsPerPage: number;
  onItemsPerPageChange: (itemsPerPage: number) => void;
}

function Pagination({ currentPage, totalPages, onPageChange, itemsPerPage, onItemsPerPageChange }: PaginationProps) {
  const pages = [];
  const maxVisiblePages = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
  
  if (endPage - startPage < maxVisiblePages - 1) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  const exportToCSV = () => {
    // This will be implemented by parent component
    console.log('Export to CSV');
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 border-t">
      <div className="flex items-center gap-2 w-full sm:w-auto">
        <span className="text-sm text-muted-foreground whitespace-nowrap">Items per page:</span>
        <Select value={itemsPerPage.toString()} onValueChange={(value) => onItemsPerPageChange(Number(value))}>
          <SelectTrigger className="w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10</SelectItem>
            <SelectItem value="25">25</SelectItem>
            <SelectItem value="50">50</SelectItem>
            <SelectItem value="100">100</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="flex items-center gap-1 w-full sm:w-auto">
        <Button
          variant="outline"
          size="sm"
          onClick={exportToCSV}
          className="flex items-center gap-2 w-full sm:w-auto"
        >
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">Export CSV</span>
          <span className="sm:hidden">Export</span>
        </Button>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <div className="flex items-center gap-1">
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function DataTable<T extends { id: string | number }>({
  data, 
  columns, 
  isLoading, 
  emptyMessage = "No data found", 
  children,
  title,
  onSelectionChange
}: DataTableProps<T>) {
  const [selectedRows, setSelectedRows] = useState<T[]>([]);
  const [showExportDialog, setShowExportDialog] = useState(false);

  const handleSelectAll = () => {
    if (selectedRows.length === data.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(data);
    }
  };

  const handleSelectRow = (row: T) => {
    setSelectedRows(prev => {
      const isSelected = prev.some(selected => selected.id === row.id);
      if (isSelected) {
        return prev.filter(selected => selected.id !== row.id);
      } else {
        return [...prev, row];
      }
    });
  };

  const handleExportSelected = () => {
    if (selectedRows.length === 0) {
      alert('Please select at least one item to export');
      return;
    }

    if (!onSelectionChange) return;

    const headers = columns.map(col => col.label);
    const csvContent = [
      headers.join(','),
      ...selectedRows.map(row => 
        columns.map(col => {
          const value = row[col.key];
          return typeof value === 'string' ? `"${value}"` : value;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `selected-records-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportDialog(false);
    setSelectedRows([]);
  };

  return (
    <>
      <Card>
        {title && (
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold">{title}</h2>
          </div>
        )}
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={selectedRows.length === data.length && data.length > 0}
                onChange={handleSelectAll}
                className="w-4 h-4"
              />
              <span className="text-sm text-muted-foreground">
                Select All ({selectedRows.length}/{data.length})
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowExportDialog(true)}
              disabled={selectedRows.length === 0}
              className="flex items-center gap-2 w-full sm:w-auto"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export Selected ({selectedRows.length})</span>
              <span className="sm:hidden">Export ({selectedRows.length})</span>
            </Button>
          </div>
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="w-12 py-3 px-4 font-medium">
                    <input
                      type="checkbox"
                      checked={selectedRows.length === data.length && data.length > 0}
                      onChange={handleSelectAll}
                      className="w-4 h-4"
                    />
                  </th>
                  {columns.map((column) => (
                    <th key={column.key} className="text-left py-3 px-2 sm:px-4 font-medium whitespace-nowrap">
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data?.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length + 1} className="py-8 text-center text-muted-foreground">
                      {emptyMessage}
                    </td>
                  </tr>
                ) : (
                  data?.map((row, index) => (
                    <tr key={row.id || index} className="data-table-row border-b">
                      <td className="w-12 py-3 px-4">
                        <input
                          type="checkbox"
                          checked={selectedRows.some(selected => selected.id === row.id)}
                          onChange={() => handleSelectRow(row)}
                          className="w-4 h-4"
                        />
                      </td>
                      {columns.map((column) => (
                        <td key={column.key} className="py-3 px-2 sm:px-4 whitespace-nowrap">
                          {column.render ? column.render(row[column.key], row) : row[column.key]}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Export Selected Records</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              You have selected {selectedRows.length} record(s) to export.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowExportDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleExportSelected}>
                <Download className="h-4 w-4 mr-2" />
                Export {selectedRows.length} Records
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {children && (
        <div className="flex items-center justify-between px-4 py-3 border-t">
          {children}
        </div>
      )}
    </>
  );
}

export { Pagination, type DataTableProps };
