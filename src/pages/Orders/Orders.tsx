import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { shopifyService, type ShopifyOrder } from '@/services/shopify';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, ExternalLink, RefreshCw, Package, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ShopifyExchangeCreate } from '../ExchangeLodging/ShopifyExchangeCreate';

export default function Orders() {
    const [orders, setOrders] = useState<ShopifyOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    const [exchangeOpen, setExchangeOpen] = useState(false);
    const [selectedOrderForExchange, setSelectedOrderForExchange] = useState<ShopifyOrder | null>(null);

    const [detailsOpen, setDetailsOpen] = useState(false);
    const [selectedOrderDetails, setSelectedOrderDetails] = useState<ShopifyOrder | null>(null);

    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(50);

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

    const filteredOrders = orders.filter(
        (o) =>
            o.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            o.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            o.customer?.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            o.customer?.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            o.phone?.includes(searchQuery)
    );

    const totalPages = Math.max(1, Math.ceil(filteredOrders.length / itemsPerPage));
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedOrders = filteredOrders.slice(startIndex, startIndex + itemsPerPage);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery]);

    return (
        <Layout>
            <div className="page-shell animate-fade-in">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div>
                        <h1 className="text-3xl font-semibold text-foreground mt-2">
                            {/* <ShoppingCart className="h-8 w-8 text-primary" /> */}
                            Shopify Orders
                        </h1>
                        <p className="text-muted-foreground mt-2">Latest 50 orders synced from Shopify</p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 text-sm w-full lg:w-auto">
                        <div className="relative w-full sm:w-80">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search orders, customers..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 h-10 bg-background"
                            />
                        </div>
                        <Button
                            variant="outline"
                            onClick={fetchOrders}
                            disabled={isLoading}
                            className="flex items-center gap-2 whitespace-nowrap h-10"
                        >
                            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                            Refresh Sync
                        </Button>
                    </div>
                </div>

                <div className="card-base mt-8">
                    <div className="rounded-md border overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="w-[150px] whitespace-nowrap">Order</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead className="w-[200px]">Customer</TableHead>
                                    <TableHead className="w-[150px] whitespace-nowrap">Total</TableHead>
                                    <TableHead>Payment</TableHead>
                                    <TableHead>Fulfillment</TableHead>
                                    <TableHead className="text-right">Items</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-48 text-center text-muted-foreground">
                                            <div className="flex flex-col items-center justify-center space-y-3">
                                                <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                                                <p>Syncing orders from Shopify...</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : orders.length === 0 && !searchQuery ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                                            No orders found in Shopify.
                                        </TableCell>
                                    </TableRow>
                                ) : filteredOrders.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                                            No orders found matching "{searchQuery}".
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedOrders.map((order) => (
                                        <TableRow
                                            key={order.id}
                                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                                            onClick={() => {
                                                setSelectedOrderDetails(order);
                                                setDetailsOpen(true);
                                            }}
                                        >
                                            <TableCell className="font-medium whitespace-nowrap">
                                                <div className="flex items-center gap-1.5 text-primary hover:underline">
                                                    {order.name}
                                                    <ExternalLink className="h-3 w-3" />
                                                </div>
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
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    className="flex items-center gap-1.5"
                                                    onClick={() => {
                                                        setSelectedOrderForExchange(order);
                                                        setExchangeOpen(true);
                                                    }}
                                                >
                                                    <Package className="h-3.5 w-3.5" />
                                                    Exchange
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination Footer */}
                    {orders.length > 0 && (
                        <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t border-b border-l border-r rounded-b-md bg-muted/10 gap-4 mt-[-1px]">
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">Items per page:</span>
                                <select
                                    value={itemsPerPage}
                                    onChange={(e) => {
                                        setItemsPerPage(Number(e.target.value));
                                        setCurrentPage(1);
                                    }}
                                    className="w-16 px-2 py-1 border rounded text-sm bg-background"
                                >
                                    <option value="10">10</option>
                                    <option value="25">25</option>
                                    <option value="50">50</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="h-8 px-2 lg:px-3"
                                >
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                    </svg>
                                </Button>
                                <span className="text-sm text-muted-foreground min-w-[5rem] text-center">
                                    Page {currentPage} of {totalPages}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="h-8 px-2 lg:px-3"
                                >
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                <Dialog open={exchangeOpen} onOpenChange={setExchangeOpen}>
                    <DialogContent className="max-w-[1200px] w-[95vw] max-h-[90vh] overflow-y-auto">
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

                <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
                    <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Order Details: {selectedOrderDetails?.name}</DialogTitle>
                        </DialogHeader>
                        {selectedOrderDetails && (
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    {/* Main Content: Line Items & Fulfillments */}
                                    <div className="lg:col-span-2 space-y-6">
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
                                    <div className="space-y-6">
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
                    </DialogContent>
                </Dialog>
            </div>
        </Layout>
    );
}
