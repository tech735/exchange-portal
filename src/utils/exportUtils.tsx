import { format, parseISO } from 'date-fns';
import { type Ticket, DELIVERY_ZONE_LABELS, NOTIFICATION_CHANNEL_LABELS, SHIPMENT_STATUS_LABELS } from '@/types/database';
import { type ShopifyOrder } from '@/services/shopify';
import { DELIVERY_CHECK_LABELS, type DailyReportRow, type ShipmentStats, type TrackedShipment } from '@/lib/shipmentTracking';

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

export function exportOrdersToCSV(orders: ShopifyOrder[]): void {
  if (orders.length === 0) {
    alert('No orders to export');
    return;
  }

  const exportData = orders.map(order => ({
    'Order': order.name,
    'Date': order.created_at ? new Date(order.created_at).toLocaleString() : '',
    'Customer': [order.customer?.first_name, order.customer?.last_name].filter(Boolean).join(' '),
    'Email': order.email || '',
    'Phone': order.phone || '',
    'Total': `${order.currency} ${order.total_price}`,
    'Payment Status': order.financial_status || '',
    'Fulfillment Status': order.fulfillment_status || 'unfulfilled',
    'Items': order.line_items.reduce((sum, item) => sum + item.quantity, 0),
  }));

  const headers = Object.keys(exportData[0]) as (keyof typeof exportData[number])[];
  const csvContent = [
    headers.join(','),
    ...exportData.map(row =>
      headers.map(header => {
        const escapedValue = String(row[header]).replace(/"/g, '""');
        return `"${escapedValue}"`;
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `orders-export-${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Shipment tracker workbook: the tracker rows (same columns as the old
// "Ecom Order Tracker" sheet), the day-by-day report and the headline numbers.
// exceljs is loaded only when someone downloads.
export async function exportShipmentsToExcel({
  shipments,
  daily,
  stats,
}: {
  shipments: TrackedShipment[];
  daily: DailyReportRow[];
  stats: ShipmentStats;
}): Promise<void> {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const day = (value: string | null) => (value ? format(parseISO(value), 'dd/MMM/yyyy') : '');

  const addSheet = (name: string, columns: { header: string; key: string; width: number }[], rows: Record<string, unknown>[]) => {
    const sheet = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
    sheet.columns = columns;
    sheet.addRows(rows);
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF7' } };
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
    return sheet;
  };

  addSheet(
    'Shipments',
    [
      { header: 'Order No.', key: 'ref', width: 18 },
      { header: 'Order Date', key: 'orderDate', width: 13 },
      { header: 'Customer Name', key: 'customer', width: 22 },
      { header: 'Phone', key: 'phone', width: 15 },
      { header: 'Email', key: 'email', width: 28 },
      { header: 'City', key: 'city', width: 16 },
      { header: 'Delivery Zone', key: 'zone', width: 14 },
      { header: 'Courier', key: 'courier', width: 12 },
      { header: 'AWB No.', key: 'awb', width: 16 },
      { header: 'Pickup Date', key: 'pickup', width: 13 },
      { header: 'Expected Delivery', key: 'expected', width: 16 },
      { header: 'Delivered Date', key: 'delivered', width: 14 },
      { header: 'Shipment Status', key: 'status', width: 16 },
      { header: 'Days in Transit', key: 'transit', width: 14 },
      { header: 'Delivery Check', key: 'check', width: 20 },
      { header: 'Days Delayed', key: 'delayed', width: 12 },
      { header: 'Customer Notified', key: 'notified', width: 16 },
      { header: 'Notified On', key: 'notifiedOn', width: 13 },
      { header: 'Notified Via', key: 'notifiedVia', width: 12 },
      { header: 'Notes', key: 'notes', width: 40 },
    ],
    shipments.map((s) => ({
      ref: s.shipment_ref,
      orderDate: day(s.order_date),
      customer: s.customer_name || '',
      phone: s.customer_phone || '',
      email: s.customer_email || '',
      city: s.city || '',
      zone: DELIVERY_ZONE_LABELS[s.delivery_zone],
      courier: s.courier || '',
      awb: s.awb_number || '',
      pickup: day(s.pickup_date),
      expected: day(s.expectedDelivery),
      delivered: s.status === 'DELIVERED' ? day(s.delivered_date) : '',
      status: SHIPMENT_STATUS_LABELS[s.status],
      transit: s.daysInTransit ?? '',
      check: DELIVERY_CHECK_LABELS[s.check],
      delayed: s.daysDelayed ?? '',
      notified: s.customer_notified ? 'Yes' : 'No',
      notifiedOn: day(s.notified_on),
      notifiedVia: s.notified_via ? NOTIFICATION_CHANNEL_LABELS[s.notified_via] : '',
      notes: s.notes || '',
    }))
  );

  addSheet(
    'Daily Report',
    [
      { header: 'Date', key: 'date', width: 13 },
      { header: 'Orders Placed', key: 'placed', width: 14 },
      { header: 'Picked Up', key: 'pickedUp', width: 11 },
      { header: 'Picked Up Late', key: 'pickedUpLate', width: 15 },
      { header: 'Delivered', key: 'delivered', width: 11 },
      { header: 'Delivered On Time', key: 'onTime', width: 17 },
      { header: 'Delivered Late', key: 'late', width: 14 },
      { header: 'Returns', key: 'returns', width: 10 },
    ],
    daily.map((r) => ({
      date: day(r.date),
      placed: r.placed,
      pickedUp: r.pickedUp,
      pickedUpLate: r.pickedUpLate,
      delivered: r.delivered,
      onTime: r.deliveredOnTime,
      late: r.deliveredLate,
      returns: r.returns,
    }))
  );

  const fixed = (value: number | null) => (value === null ? '' : Number(value.toFixed(1)));
  addSheet(
    'Summary',
    [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Value', key: 'value', width: 12 },
    ],
    [
      ['Total orders', stats.total],
      ["Today's orders", stats.todaysOrders],
      ['Awaiting pickup', stats.awaitingPickup],
      ['Pickup delayed', stats.pickupDelayed],
      ['On track', stats.onTrack],
      ['Out for delivery', stats.outForDelivery],
      ['Delayed – notify now', stats.delayedNotify],
      ['Delayed – notified', stats.delayedNotified],
      ['Escalated – RTO review', stats.escalated],
      ['Delivered on time', stats.deliveredOnTime],
      ['Delivered late', stats.deliveredLate],
      ['RTO', stats.rto],
      ['On-time %', stats.onTimePercent === null ? '' : `${stats.onTimePercent}%`],
      ['Avg days to deliver (NCR)', fixed(stats.avgDaysNcr)],
      ['Avg days to deliver (Outside NCR)', fixed(stats.avgDaysOutside)],
    ].map(([metric, value]) => ({ metric, value }))
  );

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `shipment-tracker-${new Date().toISOString().split('T')[0]}.xlsx`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
