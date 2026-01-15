import { type Ticket } from '@/types/database';

interface ExportData {
  'Ticket ID': string;
  'Order ID': string;
  'Customer Name': string;
  'Customer Phone': string;
  'Student Name': string;
  'Student Grade': string;
  'Student Section': string;
  'School Name': string;
  'Reason Code': string;
  'Reason Notes': string;
  'Stage': string;
  'Status': string;
  'Return Items': string;
  'Exchange Items': string;
  'Notes': string;
  'SLA Breached': string;
  'Created At': string;
  'Lodged At': string;
  'Warehouse Received At': string;
  'Warehouse Approved At': string;
  'Exchange Completed At': string;
  'Sent to Invoicing At': string;
  'Payment Collected': string;
  'Invoiced At': string;
  'Closed At': string;
  'Updated At': string;
}

export function exportTicketsToCSV(tickets: Ticket[]): void {
  if (tickets.length === 0) {
    alert('No tickets to export');
    return;
  }

  const exportData: ExportData[] = tickets.map(ticket => {
    // Format return items
    const returnItems = ticket.return_items.map(item => 
      `${item.product_name} (SKU: ${item.sku}, Size: ${item.size}, Qty: ${item.qty})`
    ).join(' | ');

    // Format exchange items
    const exchangeItems = ticket.exchange_items.map(item => 
      `${item.product_name} (SKU: ${item.sku}, Size: ${item.size}, Qty: ${item.qty})`
    ).join(' | ');

    return {
      'Ticket ID': ticket.id,
      'Order ID': ticket.order_id,
      'Customer Name': ticket.customer_name,
      'Customer Phone': ticket.customer_phone,
      'Student Name': ticket.student_name || '',
      'Student Grade': ticket.student_grade || '',
      'Student Section': ticket.student_section || '',
      'School Name': ticket.school_name || '',
      'Reason Code': ticket.reason_code,
      'Reason Notes': ticket.reason_notes || '',
      'Stage': ticket.stage,
      'Status': ticket.status,
      'Return Items': returnItems,
      'Exchange Items': exchangeItems,
      'Notes': ticket.notes || '',
      'SLA Breached': ticket.sla_breached ? 'Yes' : 'No',
      'Created At': ticket.created_at ? new Date(ticket.created_at).toLocaleString() : '',
      'Lodged At': ticket.lodged_at ? new Date(ticket.lodged_at).toLocaleString() : '',
      'Warehouse Received At': ticket.warehouse_received_at ? new Date(ticket.warehouse_received_at).toLocaleString() : '',
      'Warehouse Approved At': ticket.warehouse_approved_at ? new Date(ticket.warehouse_approved_at).toLocaleString() : '',
      'Exchange Completed At': ticket.exchange_completed_at ? new Date(ticket.exchange_completed_at).toLocaleString() : '',
      'Sent to Invoicing At': ticket.sent_to_invoicing_at ? new Date(ticket.sent_to_invoicing_at).toLocaleString() : '',
      'Payment Collected': ticket.sent_to_invoicing_at ? 'Yes' : 'No',
      'Invoiced At': ticket.invoicing_done_at ? new Date(ticket.invoicing_done_at).toLocaleString() : '',
      'Closed At': ticket.closed_at ? new Date(ticket.closed_at).toLocaleString() : '',
      'Updated At': ticket.updated_at ? new Date(ticket.updated_at).toLocaleString() : '',
    };
  });

  // Convert to CSV
  const headers = Object.keys(exportData[0]) as (keyof ExportData)[];
  const csvContent = [
    headers.join(','),
    ...exportData.map(row => 
      headers.map(header => {
        const value = row[header];
        // Escape quotes and commas in the value
        const escapedValue = String(value).replace(/"/g, '""');
        return `"${escapedValue}"`;
      }).join(',')
    )
  ].join('\n');

  // Create and download CSV file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `tickets-export-${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportTicketsToExcel(tickets: Ticket[]): void {
  // For Excel export, we can create a tab-separated values file
  // which Excel can open properly
  if (tickets.length === 0) {
    alert('No tickets to export');
    return;
  }

  const exportData: ExportData[] = tickets.map(ticket => {
    // Format return items
    const returnItems = ticket.return_items.map(item => 
      `${item.product_name} (SKU: ${item.sku}, Size: ${item.size}, Qty: ${item.qty})`
    ).join(' | ');

    // Format exchange items
    const exchangeItems = ticket.exchange_items.map(item => 
      `${item.product_name} (SKU: ${item.sku}, Size: ${item.size}, Qty: ${item.qty})`
    ).join(' | ');

    return {
      'Ticket ID': ticket.id,
      'Order ID': ticket.order_id,
      'Customer Name': ticket.customer_name,
      'Customer Phone': ticket.customer_phone,
      'Student Name': ticket.student_name || '',
      'Student Grade': ticket.student_grade || '',
      'Student Section': ticket.student_section || '',
      'School Name': ticket.school_name || '',
      'Reason Code': ticket.reason_code,
      'Reason Notes': ticket.reason_notes || '',
      'Stage': ticket.stage,
      'Status': ticket.status,
      'Return Items': returnItems,
      'Exchange Items': exchangeItems,
      'Notes': ticket.notes || '',
      'SLA Breached': ticket.sla_breached ? 'Yes' : 'No',
      'Created At': ticket.created_at ? new Date(ticket.created_at).toLocaleString() : '',
      'Lodged At': ticket.lodged_at ? new Date(ticket.lodged_at).toLocaleString() : '',
      'Warehouse Received At': ticket.warehouse_received_at ? new Date(ticket.warehouse_received_at).toLocaleString() : '',
      'Warehouse Approved At': ticket.warehouse_approved_at ? new Date(ticket.warehouse_approved_at).toLocaleString() : '',
      'Exchange Completed At': ticket.exchange_completed_at ? new Date(ticket.exchange_completed_at).toLocaleString() : '',
      'Sent to Invoicing At': ticket.sent_to_invoicing_at ? new Date(ticket.sent_to_invoicing_at).toLocaleString() : '',
      'Payment Collected': ticket.sent_to_invoicing_at ? 'Yes' : 'No',
      'Invoiced At': ticket.invoicing_done_at ? new Date(ticket.invoicing_done_at).toLocaleString() : '',
      'Closed At': ticket.closed_at ? new Date(ticket.closed_at).toLocaleString() : '',
      'Updated At': ticket.updated_at ? new Date(ticket.updated_at).toLocaleString() : '',
    };
  });

  // Convert to TSV (Tab-Separated Values) for Excel
  const headers = Object.keys(exportData[0]) as (keyof ExportData)[];
  const tsvContent = [
    headers.join('\t'),
    ...exportData.map(row => 
      headers.map(header => {
        const value = row[header];
        // Escape tabs in the value
        const escapedValue = String(value).replace(/\t/g, ' ');
        return escapedValue;
      }).join('\t')
    )
  ].join('\n');

  // Create and download TSV file
  const blob = new Blob([tsvContent], { type: 'text/tab-separated-values;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `tickets-export-${new Date().toISOString().split('T')[0]}.xlsx`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
