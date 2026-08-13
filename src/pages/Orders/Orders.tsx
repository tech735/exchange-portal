import { useState, useEffect, useMemo } from 'react';
import Layout from '@/components/Layout';
import { shopifyService, type ShopifyOrder } from '@/services/shopify';
import { useToast } from '@/hooks/use-toast';
import { format, isToday, isYesterday, isThisWeek } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card } from '@/components/ui/card';
import { BulkActionToolbar, BulkAction } from '@/components/ui/bulk-action-toolbar';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { RefreshCw, Package, Search, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { ShopifyExchangeCreate } from '../ExchangeLodging/ShopifyExchangeCreate';
import { exportOrdersToCSV } from '@/utils/exportUtils';

export default function Orders() {
    const [orders, setOrders] = useState<ShopifyOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    const [exchangeOpen, setExchangeOpen] = useState(false);
    const [selectedOrderForExchange, setSelectedOrderForExchange] = useState<ShopifyOrder | null>(null);

    const [detailsOpen, setDetailsOpen] = useState(false);
    const [selectedOrderDetails, setSelectedOrderDetails] = useState<ShopifyOrder | null>(null);

    const [searchQuery, setSearchQuery] = useState('');
    const [paymentFilter, setPaymentFilter] = useState('all');
    const [fulfillmentFilter, setFulfillmentFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(50);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

    const fetchOrders = async () => {
        setIsLoading(true);
        try {
            const data = await shopifyService.getRecentOrders();
            setOrders(data);
        } catch (error: any) {
            console.error('Failed to fetch orders:', error);
            toast({
                title: 'Error',
                description: error.message || 'Failed to sync with Shopify',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchOrders();
    }, []);

    const filteredOrders = orders.filter((o) => {
        const matchesSearch =
            o.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            o.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            o.customer?.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            o.customer?.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            o.phone?.includes(searchQuery);

        const matchesPayment = paymentFilter === 'all' || o.financial_status?.toLowerCase() === paymentFilter;

        const matchesFulfillment =
            fulfillmentFilter === 'all' ||
            (fulfillmentFilter === 'unfulfilled' ? !o.fulfillment_status : o.fulfillment_status?.toLowerCase() === fulfillmentFilter);

        return matchesSearch && matchesPayment && matchesFulfillment;
    });

    const totalPages = Math.max(1, Math.ceil(filteredOrders.length / itemsPerPage));
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedOrders = filteredOrders.slice(startIndex, startIndex + itemsPerPage);

    useEffect(() => {
        setCurrentPage(1);
        setSelectedIds(new Set());
    }, [searchQuery, paymentFilter, fulfillmentFilter]);

    const selectAllOnPage = paginatedOrders.length > 0 && paginatedOrders.every((o) => selectedIds.has(o.id));

    const handleSelectAllOnPage = (checked: boolean) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            paginatedOrders.forEach((o) => (checked ? next.add(o.id) : next.delete(o.id)));
            return next;
        });
    };

    const handleSelectOrder = (id: number, checked: boolean) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (checked) next.add(id);
            else next.delete(id);
            return next;
        });
    };

    const handleSelectAllMatching = () => {
        setSelectedIds(new Set(filteredOrders.map((o) => o.id)));
    };

    const clearSelection = () => setSelectedIds(new Set());

    const bulkPrimaryActions: BulkAction[] = [
        {
            label: 'Export Selected',
            onClick: () => {
                const selected = filteredOrders.filter((o) => selectedIds.has(o.id));
                exportOrdersToCSV(selected);
            },
        },
    ];

    // Group paginated orders by date for the mobile list view
    const groupedOrders = useMemo(() => {
        const groups: { label: string; key: string; orders: ShopifyOrder[] }[] = [];
        const seen: Record<string, number> = {};

        paginatedOrders.forEach(order => {
            const date = new Date(order.created_at);
            const key = format(date, 'yyyy-MM-dd');

            let label: string;
            if (isToday(date)) label = 'Today';
            else if (isYesterday(date)) label = 'Yesterday';
            else if (isThisWeek(date, { weekStartsOn: 1 })) label = format(date, 'EEEE');
            else label = format(date, 'MMMM d');

            if (seen[key] === undefined) {
                seen[key] = groups.length;
                groups.push({ label, key, orders: [] });
            }
            groups[seen[key]].orders.push(order);
        });

        return groups;
    }, [paginatedOrders]);

    return (
        <Layout>
            <div className="page-shell animate-fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-xl lg:text-2xl font-semibold tracking-tight">Shopify Orders</h1>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button
                            variant="outline"
                            className="gap-2"
                            onClick={fetchOrders}
                            disabled={isLoading}
                        >
                            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                            <span className="hidden sm:inline">Refresh Sync</span>
                        </Button>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2">
                    <div className="relative w-full sm:w-64 shrink-0">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Search orders, customers..."
                            className="pl-10 w-full rounded-full bg-card border-border/60 shadow-sm"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                            <SelectTrigger className="w-[150px] rounded-full bg-card border-border/60 shadow-sm">
                                <SelectValue placeholder="All Payment" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Payment</SelectItem>
                                <SelectItem value="paid">Paid</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="partially_paid">Partially Paid</SelectItem>
                                <SelectItem value="refunded">Refunded</SelectItem>
                                <SelectItem value="partially_refunded">Partially Refunded</SelectItem>
                                <SelectItem value="voided">Voided</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={fulfillmentFilter} onValueChange={setFulfillmentFilter}>
                            <SelectTrigger className="w-[160px] rounded-full bg-card border-border/60 shadow-sm">
                                <SelectValue placeholder="All Fulfillment" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Fulfillment</SelectItem>
                                <SelectItem value="fulfilled">Fulfilled</SelectItem>
                                <SelectItem value="partial">Partial</SelectItem>
                                <SelectItem value="unfulfilled">Unfulfilled</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* ── Mobile list (< lg) ────────────────────────────── */}
                <div className="block lg:hidden mt-6 rounded-2xl overflow-hidden border border-border bg-card">
                    {isLoading ? (
                        <div className="flex justify-center py-16">
                            <div className="loader" />
                        </div>
                    ) : paginatedOrders.length === 0 ? (
                        <p className="py-10 text-center text-sm text-muted-foreground">
                            {orders.length === 0 ? 'No orders found in Shopify.' : `No orders matching "${searchQuery}".`}
                        </p>
                    ) : (
                        <>
                            {groupedOrders.map(({ label, key, orders: group }) => (
                                <div key={key}>
                                    {/* Date group header */}
                                    <div className="px-4 py-1.5 bg-muted/40 border-b border-border">
                                        <span className="text-xs font-medium text-muted-foreground">{label}</span>
                                    </div>

                                    {group.map((order, idx) => {
                                        const itemCount = order.line_items.reduce((s, i) => s + i.quantity, 0);
                                        const time = format(new Date(order.created_at), 'hh:mma');
                                        const customer = [order.customer?.first_name, order.customer?.last_name].filter(Boolean).join(' ') || order.email || '—';
                                        const price = `₹${parseFloat(order.total_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
                                        const financialLabel = order.financial_status
                                            ? order.financial_status.charAt(0).toUpperCase() + order.financial_status.slice(1)
                                            : 'Unknown';

                                        return (
                                            <div
                                                key={order.id}
                                                className={`px-4 py-3 flex items-center gap-2 cursor-pointer active:bg-muted/50 transition-colors ${idx < group.length - 1 ? 'border-b border-border' : ''}`}
                                                onClick={() => { setSelectedOrderDetails(order); setDetailsOpen(true); }}
                                            >
                                                <div className="flex-1 min-w-0">
                                                    {/* Row 1: order # + price */}
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="font-semibold text-[15px] text-foreground leading-snug">{order.name}</span>
                                                        <span className="text-[15px] text-foreground font-medium shrink-0">{price}</span>
                                                    </div>
                                                    {/* Row 2: customer • items • time */}
                                                    <p className="text-[13px] text-muted-foreground mt-0.5 leading-snug">
                                                        {customer} · {itemCount} {itemCount === 1 ? 'item' : 'items'} · {time}
                                                    </p>
                                                    {/* Row 3: status badge + exchange button */}
                                                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                                        <Badge variant="secondary" className="text-[11px] font-medium px-2 py-0.5 h-auto rounded-full">
                                                            {financialLabel}
                                                        </Badge>
                                                        {order.fulfillment_status && (
                                                            <span className="text-[11px] text-muted-foreground capitalize">
                                                                {order.fulfillment_status}
                                                            </span>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedOrderForExchange(order);
                                                                setExchangeOpen(true);
                                                            }}
                                                            className="text-[11px] font-medium text-primary transition-all duration-150 hover:text-primary/70 inline-block"
                                                        >
                                                            Exchange
                                                        </button>
                                                    </div>
                                                </div>
                                                <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}

                            {/* Mobile pagination */}
                            {orders.length > 0 && (
                                <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                                    <span className="text-xs text-muted-foreground">Page {currentPage} of {totalPages}</span>
                                    <div className="flex items-center gap-2">
                                        <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="h-8 w-8 p-0">
                                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="h-8 w-8 p-0">
                                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* ── Desktop table (≥ lg) ───────────────────────────── */}
                <div className="hidden lg:block">
                    <Card className="border shadow-card overflow-hidden">
                        <Table className="table-fixed">
                            <colgroup>
                                <col className="w-[4%]" />
                                <col className="w-[13%]" />
                                <col className="w-[11%]" />
                                <col className="w-[18%]" />
                                <col className="w-[11%]" />
                                <col className="w-[11%]" />
                                <col className="w-[11%]" />
                                <col className="w-[8%]" />
                                <col className="w-[13%]" />
                            </colgroup>
                            <TableHeader>
                                {selectedIds.size > 0 ? (
                                    <TableRow>
                                        <TableHead colSpan={9} className="p-2">
                                            <BulkActionToolbar
                                                selectedCount={selectedIds.size}
                                                totalMatching={filteredOrders.length}
                                                onSelectAllMatching={handleSelectAllMatching}
                                                onClearSelection={clearSelection}
                                                primaryActions={bulkPrimaryActions}
                                                itemLabel="selected"
                                            />
                                        </TableHead>
                                    </TableRow>
                                ) : (
                                    <TableRow className="bg-muted/50">
                                        <TableHead>
                                            <Checkbox
                                                id="select-all-orders"
                                                name="select-all-orders"
                                                checked={selectAllOnPage}
                                                onCheckedChange={(checked) => handleSelectAllOnPage(checked === true)}
                                                aria-label="Select all orders on this page"
                                            />
                                        </TableHead>
                                        <TableHead className="whitespace-nowrap">Order</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Customer</TableHead>
                                        <TableHead className="whitespace-nowrap">Total</TableHead>
                                        <TableHead>Payment</TableHead>
                                        <TableHead>Fulfillment</TableHead>
                                        <TableHead className="text-right">Items</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                )}
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className="h-48 text-center">
                                            <div className="flex justify-center">
                                                <div className="loader" />
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) :orders.length === 0 && !searchQuery ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                                            No orders found in Shopify.
                                        </TableCell>
                                    </TableRow>
                                ) : filteredOrders.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                                            No orders found matching "{searchQuery}".
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedOrders.map((order) => (
                                        <TableRow
                                            key={order.id}
                                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                                            data-state={selectedIds.has(order.id) ? 'selected' : undefined}
                                            onClick={() => {
                                                setSelectedOrderDetails(order);
                                                setDetailsOpen(true);
                                            }}
                                        >
                                            <TableCell onClick={(e) => e.stopPropagation()}>
                                                <Checkbox
                                                    id={`select-order-${order.id}`}
                                                    name={`select-order-${order.id}`}
                                                    checked={selectedIds.has(order.id)}
                                                    onCheckedChange={(checked) => handleSelectOrder(order.id, checked === true)}
                                                    aria-label={`Select order ${order.name}`}
                                                />
                                            </TableCell>
                                            <TableCell className="font-medium whitespace-nowrap">
                                                <span className="text-primary">{order.name}</span>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">
                                                {format(new Date(order.created_at), 'MMM d, h:mm a')}
                                            </TableCell>
                                            <TableCell className="max-w-[200px]">
                                                <div className="font-medium truncate">
                                                    {order.customer?.first_name} {order.customer?.last_name}
                                                </div>
                                                <div className="text-xs text-muted-foreground truncate">
                                                    {order.email}
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-medium whitespace-nowrap">
                                                {order.currency} {parseFloat(order.total_price).toFixed(2)}
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant={order.financial_status === 'paid' ? 'default' : 'secondary'}
                                                    className={order.financial_status === 'paid' ? 'bg-green-100 text-green-800 hover:bg-green-100' : ''}
                                                >
                                                    {order.financial_status?.toUpperCase() || 'UNKNOWN'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={order.fulfillment_status === 'fulfilled' ? 'bg-blue-50 text-blue-700 border-blue-200' : ''}>
                                                    {order.fulfillment_status ? order.fulfillment_status.toUpperCase() : 'UNFULFILLED'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right text-muted-foreground">
                                                {order.line_items.reduce((sum, item) => sum + item.quantity, 0)}
                                            </TableCell>
                                            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                                {/* Text action, matching the warehouse tickets table */}
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedOrderForExchange(order);
                                                        setExchangeOpen(true);
                                                    }}
                                                    className="text-sm font-medium text-primary transition-all duration-150 hover:text-primary/70 hover:scale-105 inline-block"
                                                >
                                                    Exchange
                                                </button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </Card>

                    {/* Desktop Footer Stats and Pagination */}
                    {orders.length > 0 && (
                        <div className="flex items-center justify-between mt-4">
                            <div className="text-sm text-muted-foreground">
                                Showing {paginatedOrders.length > 0 ? startIndex + 1 : 0} to {Math.min(startIndex + itemsPerPage, filteredOrders.length)} of {filteredOrders.length} orders
                            </div>
                            <DataTablePagination
                                currentPage={currentPage}
                                totalPages={totalPages}
                                onPageChange={setCurrentPage}
                                pageSize={itemsPerPage}
                                setPageSize={setItemsPerPage}
                            />
                        </div>
                    )}
                </div>

                <Dialog open={exchangeOpen} onOpenChange={setExchangeOpen}>
                    <DialogContent className="sm:max-w-[1200px] sm:w-[95vw] sm:max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Create Exchange from Shopify Order</DialogTitle>
                        </DialogHeader>
                        {selectedOrderForExchange && (
                            <ShopifyExchangeCreate
                                onSuccess={() => setExchangeOpen(false)}
                                initialOrder={selectedOrderForExchange}
                            />
                        )}
                    </DialogContent>
                </Dialog>

                <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
                    <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
                        <SheetHeader className="text-left">
                            <SheetTitle>Order Details: {selectedOrderDetails?.name}</SheetTitle>
                        </SheetHeader>
                        {selectedOrderDetails && (
                            <div className="space-y-6 mt-4">
                                <div className="grid grid-cols-1 gap-6">
                                    {/* Main Content: Line Items & Fulfillments */}
                                    <div className="space-y-6">
                                        {/* Fulfillment Cards */}
                                        {selectedOrderDetails.fulfillments && selectedOrderDetails.fulfillments.length > 0 ? (
                                            selectedOrderDetails.fulfillments.map((fulfillment, idx) => {
                                                // Create a map to quickly look up line item details by ID
                                                const lineItemMap = new Map(selectedOrderDetails.line_items.map(i => [i.id, i]));

                                                // If fulfillment has specific line_items, filter them, else show all (fallback for older API behavior)
                                                const fulfilledItems = fulfillment.line_items
                                                    ? fulfillment.line_items.map(fi => ({ ...lineItemMap.get(fi.id)!, quantity: fi.quantity }))
                                                    : selectedOrderDetails.line_items;

                                                return (
                                                    <div key={idx} className="bg-card border rounded-xl overflow-hidden shadow-sm">
                                                        {/* Card Header */}
                                                        <div className="bg-muted/30 px-6 py-4 border-b flex justify-between items-center text-sm">
                                                            <div className="flex items-center gap-2">
                                                                <Package className="h-4 w-4 text-muted-foreground" />
                                                                <span className="font-medium text-base">Fulfilled ({fulfilledItems.length})</span>
                                                            </div>
                                                            <div className="text-muted-foreground text-base">
                                                                {fulfillment.created_at ? format(new Date(fulfillment.created_at), 'MMM d, yyyy') : 'Recently'}
                                                            </div>
                                                        </div>

                                                        <div className="px-6 py-5 text-sm text-foreground">
                                                            <div className="text-base mb-2">
                                                                <span className="font-medium">{fulfillment.tracking_company || 'Carrier'}</span> tracking: {' '}
                                                                {fulfillment.tracking_url ? (
                                                                    <a href={fulfillment.tracking_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">
                                                                        {fulfillment.tracking_number}
                                                                    </a>
                                                                ) : (
                                                                    <span className="font-medium">{fulfillment.tracking_number || 'N/A'}</span>
                                                                )}
                                                            </div>

                                                            {/* Items List */}
                                                            <div className="space-y-5 pt-4 mt-2 border-t border-muted/30">
                                                                {fulfilledItems.map((item, idxi) => (
                                                                    <div key={idxi} className="grid grid-cols-[1fr_auto_auto] gap-6 items-center">
                                                                        <div>
                                                                            <p className="font-medium text-foreground text-base hover:underline cursor-pointer">{item.name}</p>
                                                                            <div className="flex flex-wrap items-center gap-2 mt-2">
                                                                                {item.variant_title && item.variant_title !== 'Default Title' && (
                                                                                    <Badge variant="secondary" className="font-normal rounded-md px-2 py-0.5 text-xs bg-muted/60 text-muted-foreground">{item.variant_title}</Badge>
                                                                                )}
                                                                                <span className="text-sm text-muted-foreground">{item.sku}</span>
                                                                            </div>
                                                                        </div>
                                                                        <div className="text-right text-base text-muted-foreground font-medium">
                                                                            {selectedOrderDetails.currency === 'INR' ? '₹' : selectedOrderDetails.currency}{parseFloat(item.price).toFixed(2)} × {item.quantity}
                                                                        </div>
                                                                        <div className="text-right font-medium text-foreground text-base w-24">
                                                                            {selectedOrderDetails.currency === 'INR' ? '₹' : selectedOrderDetails.currency}{(parseFloat(item.price) * item.quantity).toFixed(2)}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            /* Unfulfilled / Default List View */
                                            <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
                                                <div className="bg-yellow-50/50 dark:bg-yellow-900/10 px-6 py-4 border-b flex items-center gap-2 text-base text-yellow-800 dark:text-yellow-400">
                                                    <span className="h-2 w-2 rounded-full bg-yellow-500"></span>
                                                    <span className="font-medium">Unfulfilled ({selectedOrderDetails.line_items.length})</span>
                                                </div>
                                                <div className="px-6 py-5 space-y-5">
                                                    {selectedOrderDetails.line_items.map((item) => (
                                                        <div key={item.id} className="grid grid-cols-[1fr_auto_auto] gap-4 items-center">
                                                            <div>
                                                                <p className="font-medium text-foreground text-base hover:underline cursor-pointer">{item.name}</p>
                                                                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                                                    {item.variant_title && item.variant_title !== 'Default Title' && (
                                                                        <Badge variant="secondary" className="font-normal rounded-md px-2 py-0.5 text-xs bg-muted/60">{item.variant_title}</Badge>
                                                                    )}
                                                                    <span className="text-sm text-muted-foreground">{item.sku}</span>
                                                                </div>
                                                            </div>
                                                            <div className="text-right text-base text-muted-foreground">
                                                                {selectedOrderDetails.currency === 'INR' ? '₹' : selectedOrderDetails.currency}{parseFloat(item.price).toFixed(2)} × {item.quantity}
                                                            </div>
                                                            <div className="text-right font-medium text-foreground text-base w-24">
                                                                {selectedOrderDetails.currency === 'INR' ? '₹' : selectedOrderDetails.currency}{(parseFloat(item.price) * item.quantity).toFixed(2)}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Payment Summary Footer Card */}
                                        <div className="bg-card border rounded-lg p-5 shadow-sm space-y-3 text-sm">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Badge variant={selectedOrderDetails.financial_status === 'paid' ? 'default' : 'secondary'} className="rounded-sm font-medium">
                                                    {selectedOrderDetails.financial_status === 'paid' ? 'Paid' : selectedOrderDetails.financial_status?.toUpperCase() || 'UNKNOWN'}
                                                </Badge>
                                            </div>

                                            <div className="flex justify-between items-center text-muted-foreground">
                                                <span>Subtotal</span>
                                                <span>
                                                    {selectedOrderDetails.line_items.reduce((sum, item) => sum + item.quantity, 0)} items
                                                </span>
                                                <span className="text-foreground">{selectedOrderDetails.currency === 'INR' ? '₹' : selectedOrderDetails.currency}{parseFloat(selectedOrderDetails.subtotal_price || selectedOrderDetails.total_price).toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-muted-foreground">
                                                <span>Shipping</span>
                                                {/* Shopify summary often includes weight, we'll omit if not immediately available */}
                                                <span>Standard</span>
                                                <span className="text-foreground">
                                                    {/* Rough estimation if subtotal/total differ, otherwise 0 for demo */}
                                                    {parseFloat(selectedOrderDetails.total_price) > parseFloat(selectedOrderDetails.subtotal_price || selectedOrderDetails.total_price)
                                                        ? `${selectedOrderDetails.currency === 'INR' ? '₹' : selectedOrderDetails.currency}${(parseFloat(selectedOrderDetails.total_price) - parseFloat(selectedOrderDetails.subtotal_price || selectedOrderDetails.total_price)).toFixed(2)}`
                                                        : '₹0.00'}
                                                </span>
                                            </div>
                                            {parseFloat(selectedOrderDetails.total_tax) > 0 && (
                                                <div className="flex justify-between items-center text-muted-foreground">
                                                    <span>Taxes</span>
                                                    <span>Included</span>
                                                    <span className="text-foreground">{selectedOrderDetails.currency === 'INR' ? '₹' : selectedOrderDetails.currency}{parseFloat(selectedOrderDetails.total_tax).toFixed(2)}</span>
                                                </div>
                                            )}

                                            <div className="pt-3 border-t flex justify-between items-center font-medium text-base">
                                                <span>Total</span>
                                                <span>{selectedOrderDetails.currency === 'INR' ? '₹' : selectedOrderDetails.currency}{parseFloat(selectedOrderDetails.total_price).toFixed(2)}</span>
                                            </div>

                                            <div className="pt-3 border-t flex justify-between items-center font-medium">
                                                <span>Paid</span>
                                                <span>{selectedOrderDetails.financial_status === 'paid' ? `${selectedOrderDetails.currency === 'INR' ? '₹' : selectedOrderDetails.currency}${parseFloat(selectedOrderDetails.total_price).toFixed(2)}` : '₹0.00'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Sidebar: Notes, Customer, Details */}
                                    <div className="space-y-6 pt-2 border-t">
                                        {/* Customer Header Info */}
                                        <div className="bg-card border rounded-lg p-5 shadow-sm">
                                            <h3 className="font-medium text-sm text-muted-foreground flex justify-between items-center mb-3">
                                                Notes
                                                <Button variant="ghost" size="icon" className="h-6 w-6"><span className="sr-only">Edit node</span>✎</Button>
                                            </h3>
                                            <p className="text-sm text-muted-foreground">No notes from customer</p>
                                        </div>

                                        <div className="bg-card border rounded-lg p-5 shadow-sm space-y-4">
                                            <h3 className="font-medium text-sm text-foreground flex justify-between items-center mb-2">
                                                Customer
                                            </h3>
                                            <div>
                                                <a href={`mailto:${selectedOrderDetails.email}`} className="text-primary hover:underline text-sm font-medium">
                                                    {selectedOrderDetails.customer?.first_name} {selectedOrderDetails.customer?.last_name}
                                                </a>
                                                <p className="text-sm text-muted-foreground ">{selectedOrderDetails.email}</p>
                                                {selectedOrderDetails.phone && <p className="text-sm text-muted-foreground mt-1">{selectedOrderDetails.phone}</p>}
                                            </div>

                                            <div className="pt-4 border-t">
                                                <h3 className="font-medium text-sm text-foreground mb-2 flex justify-between items-center">
                                                    Shipping address
                                                </h3>
                                                {selectedOrderDetails.shipping_address ? (
                                                    <div className="text-sm text-muted-foreground space-y-0.5">
                                                        <p className="font-medium text-foreground">{selectedOrderDetails.shipping_address.first_name} {selectedOrderDetails.shipping_address.last_name}</p>
                                                        <p>{selectedOrderDetails.shipping_address.address1}</p>
                                                        {selectedOrderDetails.shipping_address.address2 && <p>{selectedOrderDetails.shipping_address.address2}</p>}
                                                        <p>{selectedOrderDetails.shipping_address.city}, {selectedOrderDetails.shipping_address.province} {selectedOrderDetails.shipping_address.zip}</p>
                                                        <p>{selectedOrderDetails.shipping_address.country}</p>
                                                        {selectedOrderDetails.shipping_address.phone && <p className="mt-2 text-foreground">{selectedOrderDetails.shipping_address.phone}</p>}
                                                    </div>
                                                ) : (
                                                    <p className="text-sm text-muted-foreground italic">No shipping address provided</p>
                                                )}
                                            </div>

                                            <div className="pt-4 border-t">
                                                <h3 className="font-medium text-sm text-foreground mb-2">
                                                    Billing address
                                                </h3>
                                                {selectedOrderDetails.billing_address || selectedOrderDetails.shipping_address ? (
                                                    <p className="text-sm text-muted-foreground">Same as shipping address</p>
                                                ) : null}
                                            </div>
                                        </div>

                                        <div className="bg-card border rounded-lg p-5 shadow-sm">
                                            <h3 className="font-medium text-sm text-muted-foreground flex justify-between items-center mb-3">
                                                Additional details
                                            </h3>
                                            <div className="space-y-4 text-sm">
                                                <div>
                                                    <p className="font-medium">Paid via</p>
                                                    <p className="text-muted-foreground">Standard Checkout</p>
                                                </div>
                                                <div className="pt-2">
                                                    <p className="text-muted-foreground">Order Date</p>
                                                    <p>{format(new Date(selectedOrderDetails.created_at), 'MMM d, yyyy h:mm a')}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </SheetContent>
                </Sheet>
            </div>
        </Layout>
    );
}
