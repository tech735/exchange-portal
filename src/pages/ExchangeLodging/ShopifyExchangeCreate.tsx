import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { shopifyService, ShopifyOrder, ShopifyOrderLineItem } from '@/services/shopify';
import { Search, Package, AlertCircle, X, Plus, Minus } from 'lucide-react';
import { REASON_LABELS, type ReasonCode, type TicketItem, type ProductCatalog } from '@/types/database';
import { ImprovedItemSelector } from './ImprovedItemSelector';
import { useCreateTicket } from '@/hooks/useTickets';
import { useProductPrices } from '@/hooks/useProductPrices';

interface ShopifyExchangeCreateProps {
    onSuccess: () => void;
    initialOrder?: ShopifyOrder;
}

export function ShopifyExchangeCreate({ onSuccess, initialOrder }: ShopifyExchangeCreateProps) {
    const [orderId, setOrderId] = useState(initialOrder?.name || '');
    const [isSearching, setIsSearching] = useState(false);
    const [order, setOrder] = useState<ShopifyOrder | null>(initialOrder || null);

    // Return shipping state
    const [isReturnShippingOpen, setIsReturnShippingOpen] = useState(false);
    const [returnShipping, setReturnShipping] = useState<number>(0);
    const [tempReturnShipping, setTempReturnShipping] = useState<string>('0.00');

    useEffect(() => {
        if (initialOrder) {
            setOrder(initialOrder);
            setOrderId(initialOrder.name);
        }
    }, [initialOrder]);

    // Return items selection
    const [selectedReturnItems, setSelectedReturnItems] = useState(new Map<number, { qty: number, reason: ReasonCode }>());

    // Exchange items
    const [exchangeItems, setExchangeItems] = useState<TicketItem[]>([]);

    const { toast } = useToast();
    const createTicket = useCreateTicket();
    const { data: productPrices } = useProductPrices();

    const handleSearch = async () => {
        if (!orderId.trim()) return;

        setIsSearching(true);
        setOrder(null);
        setSelectedReturnItems(new Map());

        try {
            const fetchedOrder = await shopifyService.getOrder(orderId);
            setOrder(fetchedOrder);
            toast({
                title: 'Order found',
                description: `Successfully loaded order details for ${fetchedOrder.name}`,
            });
        } catch (error: any) {
            toast({
                title: 'Error finding order',
                description: error.message || 'Could not find order. Please check the ID.',
                variant: 'destructive'
            });
        } finally {
            setIsSearching(false);
        }
    };

    const handleReturnItemToggle = (itemId: number) => {
        const newSelected = new Map(selectedReturnItems);
        if (newSelected.has(itemId)) {
            newSelected.delete(itemId);
        } else {
            newSelected.set(itemId, { qty: 1, reason: 'WRONG_SIZE' });
        }
        setSelectedReturnItems(newSelected);
    };

    const updateReturnItemQty = (itemId: number, qty: number, maxQty: number) => {
        if (qty < 1 || qty > maxQty) return;
        const newSelected = new Map(selectedReturnItems);
        if (newSelected.has(itemId)) {
            newSelected.set(itemId, { ...newSelected.get(itemId)!, qty });
            setSelectedReturnItems(newSelected);
        }
    };

    const updateReturnItemReason = (itemId: number, reason: ReasonCode) => {
        const newSelected = new Map(selectedReturnItems);
        if (newSelected.has(itemId)) {
            newSelected.set(itemId, { ...newSelected.get(itemId)!, reason });
            setSelectedReturnItems(newSelected);
        }
    };

    const addExchangeItem = (product: ProductCatalog, size: string, qty: number) => {
        let itemSku = product.sku;
        
        if (product.variants && product.variant_skus) {
            const sizeIndex = product.variants.indexOf(size);
            if (sizeIndex !== -1 && product.variant_skus[sizeIndex]) {
                itemSku = product.variant_skus[sizeIndex];
            }
        }
        
        setExchangeItems([...exchangeItems, { sku: itemSku, product_name: product.product_name, size, qty }]);
    };

    const removeExchangeItem = (index: number) => {
        setExchangeItems(exchangeItems.filter((_, i) => i !== index));
    };

    // Calculations
    const returnItemsTotal = Array.from(selectedReturnItems.entries()).reduce((sum, [id, data]) => {
        const item = order?.line_items.find(i => i.id === id);
        if (item) {
            return sum + (parseFloat(item.price) * data.qty);
        }
        return sum;
    }, 0);

    const exchangeItemsTotal = exchangeItems.reduce((sum, item) => {
        const itemPrice = productPrices?.[item.sku] || 1000; // Fallback to 1000 if not found, mirroring the default logic in ExchangeLodging
        return sum + (itemPrice * item.qty);
    }, 0);

    const restockingFee = 0; // Default or calculated
    const estimatedTaxes = 1.90; // Mocked tax

    const subtotal = exchangeItemsTotal - returnItemsTotal;
    const expectedAmountToCollect = subtotal + returnShipping + restockingFee;

    const handleSubmit = async () => {
        if (selectedReturnItems.size === 0) {
            toast({ title: 'Error', description: 'Please select at least one item to return.', variant: 'destructive' });
            return;
        }

        if (!order) {
            toast({ title: 'Error', description: 'No valid order selected.', variant: 'destructive' });
            return;
        }

        try {
            const return_items: TicketItem[] = Array.from(selectedReturnItems.entries()).map(([id, data]) => {
                const item = order.line_items.find(i => i.id === id)!;
                let size = 'Unknown';
                // Attempt to extract size from variant_title if applicable
                if (item.variant_title && item.variant_title !== 'Default Title') {
                    size = item.variant_title;
                }

                return {
                    sku: item.sku || `SKU-${item.product_id}`,
                    product_name: item.name,
                    qty: data.qty,
                    size: size,
                };
            });

            // Just picking the first reason for the main ticket record
            const mainReason = Array.from(selectedReturnItems.values())[0].reason;

            const fulfillmentDetails = order.fulfillments && order.fulfillments.length > 0
                ? `Order fulfilled via: ${order.fulfillments.map(f => `${f.tracking_company || 'Unknown'} (AWB: ${f.tracking_number || 'N/A'}, Location: ${f.location_id || 'Unknown'})`).join(' | ')}`
                : 'Order not yet fulfilled.';

            const payload = {
                order_id: order.name,
                customer_name: order.customer?.first_name ? `${order.customer.first_name} ${order.customer.last_name || ''}`.trim() : (order.email || 'Unknown'),
                customer_phone: order.phone || order.customer?.phone || 'N/A',
                student_name: 'N/A', // Mapped from somewhere if available in tags/notes
                student_grade: 'N/A',
                student_section: 'N/A',
                school_name: 'Unknown', // Mapped from tags/notes if available
                reason_code: mainReason,
                reason_notes: `Processed via Shopify UI. Return for ${return_items.length} items.`,
                notes: fulfillmentDetails,
                return_items,
                exchange_items: exchangeItems,
            };

            await createTicket.mutateAsync(payload);
            toast({ title: 'Success', description: 'Exchange ticket created successfully.' });
            onSuccess();
        } catch (error: any) {
            console.error('Submit error:', error);
            toast({ title: 'Error', description: error.message || 'Failed to create ticket', variant: 'destructive' });
        }
    };

    return (
        <div className="flex flex-col h-full gap-6">
            {/* Search Bar section */}
            {!order && (
                <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-lg bg-muted/50">
                    <Package className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">Find a Shopify Order</h3>
                    <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">
                        Enter an order number (e.g. KO-1256) to retrieve its details and begin an exchange.
                    </p>
                    <div className="flex w-full max-w-sm items-center space-x-2">
                        <Input
                            placeholder="Order ID..."
                            value={orderId}
                            onChange={(e) => setOrderId(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        />
                        <Button disabled={isSearching || !orderId.trim()} onClick={handleSearch}>
                            {isSearching ? 'Searching...' : 'Search'}
                        </Button>
                    </div>
                </div>
            )}

            {order && (
                <div className="flex flex-col lg:flex-row gap-6">
                    {/* Main content area */}
                    <div className="flex-1 space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-semibold flex items-center gap-2">
                                    <Package className="h-5 w-5" />
                                    {order.name} - Return and exchange
                                </h2>
                                <p className="text-sm text-muted-foreground">
                                    Customer: {order.customer?.first_name} {order.customer?.last_name} ({order.email})
                                </p>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => setOrder(null)}>
                                Change Order
                            </Button>
                        </div>

                        {/* Select Return Items */}
                        <div className="border rounded-md p-4 bg-card">
                            <h3 className="font-medium mb-4">Select return items</h3>
                            <div className="space-y-4">
                                {order.line_items.map((item) => {
                                    const isSelected = selectedReturnItems.has(item.id);
                                    const selectedData = selectedReturnItems.get(item.id);

                                    return (
                                        <div key={item.id} className={`flex items-start gap-4 p-4 border rounded-md transition-colors ${isSelected ? 'border-primary/50 bg-primary/5' : 'hover:border-primary/20 cursor-pointer'}`} onClick={() => !isSelected && handleReturnItemToggle(item.id)}>
                                            {/* Checkbox proxy */}
                                            <div className="pt-1">
                                                <div className={`h-5 w-5 rounded border flex items-center justify-center cursor-pointer ${isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-input bg-background'}`} onClick={(e) => { e.stopPropagation(); handleReturnItemToggle(item.id); }}>
                                                    {isSelected && <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                                </div>
                                            </div>

                                            {/* Item Details */}
                                            <div className="flex-1">
                                                <div className="flex justify-between">
                                                    <div>
                                                        <p className="font-medium text-sm text-primary hover:underline cursor-pointer">{item.name}</p>
                                                        {item.variant_title && item.variant_title !== 'Default Title' && (
                                                            <div className="inline-flex items-center px-2 py-0.5 mt-1 rounded text-xs font-medium bg-secondary text-secondary-foreground">
                                                                {item.variant_title}
                                                            </div>
                                                        )}
                                                        <p className="text-xs text-muted-foreground mt-1">SKU: {item.sku || 'N/A'}</p>
                                                    </div>

                                                    <div className="flex flex-col items-end gap-2">
                                                        {isSelected ? (
                                                            <div className="flex items-center border rounded-md h-9" onClick={e => e.stopPropagation()}>
                                                                <button type="button" className="px-3 h-full flex items-center justify-center hover:bg-muted" onClick={() => updateReturnItemQty(item.id, (selectedData?.qty || 1) - 1, item.quantity)}><Minus className="h-3 w-3" /></button>
                                                                <span className="text-sm px-2 w-8 text-center">{selectedData?.qty || 1}</span>
                                                                <button type="button" className="px-3 h-full flex items-center justify-center hover:bg-muted" onClick={() => updateReturnItemQty(item.id, (selectedData?.qty || 1) + 1, item.quantity)}><Plus className="h-3 w-3" /></button>
                                                            </div>
                                                        ) : (
                                                            <div className="text-sm text-muted-foreground">{item.quantity} available</div>
                                                        )}
                                                        <p className="text-sm font-medium">₹{parseFloat(item.price).toFixed(2)}</p>
                                                    </div>
                                                </div>

                                                {isSelected && (
                                                    <div className="mt-4" onClick={e => e.stopPropagation()}>
                                                        <p className="text-xs text-muted-foreground mb-1.5">Return reason</p>
                                                        <Select value={selectedData?.reason} onValueChange={(v) => updateReturnItemReason(item.id, v as ReasonCode)}>
                                                            <SelectTrigger className="h-9">
                                                                <SelectValue placeholder="Select reason" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {Object.entries(REASON_LABELS).map(([k, v]) => (
                                                                    <SelectItem key={k} value={k}>{v}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Exchange Items */}
                        <div className="border rounded-md p-4 bg-card">
                            <div className="mb-4">
                                <h3 className="font-medium">Exchange items</h3>
                                <p className="text-xs text-muted-foreground">Items to be sent to the customer.</p>
                            </div>

                            <ImprovedItemSelector
                                title=""
                                items={exchangeItems}
                                filterOutOfStock={true}
                                onRemove={(i) => removeExchangeItem(i)}
                                onAdd={(p, s, q) => addExchangeItem(p, s, q)}
                            />
                        </div>
                    </div>

                    {/* Sidebar Summary */}
                    <div className="w-full lg:w-80 flex-shrink-0">
                        <div className="border rounded-md p-4 bg-card sticky top-4">
                            <h3 className="font-medium mb-4">Summary</h3>

                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between items-center text-muted-foreground">
                                    <span>Return item ({Array.from(selectedReturnItems.values()).reduce((sum, item) => sum + item.qty, 0)})</span>
                                    <span>-₹{returnItemsTotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center text-muted-foreground">
                                    <span>Exchange item ({exchangeItems.reduce((sum, item) => sum + item.qty, 0)})</span>
                                    <span>₹{exchangeItemsTotal.toFixed(2)}</span>
                                </div>

                                <div className="pt-3 border-t flex justify-between items-center font-medium">
                                    <span>Subtotal</span>
                                    <span>₹{Math.abs(subtotal).toFixed(2)} {subtotal < 0 ? '(Refund)' : ''}</span>
                                </div>

                                <div
                                    className="flex justify-between items-center text-primary hover:underline cursor-pointer"
                                    onClick={() => {
                                        setTempReturnShipping(returnShipping.toFixed(2));
                                        setIsReturnShippingOpen(true);
                                    }}
                                >
                                    <span>Return shipping</span>
                                    <span className={returnShipping > 0 ? "text-foreground no-underline font-medium" : "text-muted-foreground no-underline"}>
                                        {returnShipping > 0 ? `₹${returnShipping.toFixed(2)}` : '—'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-primary hover:underline cursor-pointer">
                                    <span>Restocking fee</span>
                                    <span className="text-muted-foreground no-underline">—</span>
                                </div>

                                <div className="flex justify-between items-center text-muted-foreground text-xs">
                                    <span>Estimated taxes (Included)</span>
                                    <span>₹{estimatedTaxes.toFixed(2)}</span>
                                </div>

                                <div className="pt-3 border-t flex justify-between items-center font-semibold text-base">
                                    <span>Expected amount to collect</span>
                                    <span>₹{Math.max(0, expectedAmountToCollect).toFixed(2)}</span>
                                </div>
                            </div>

                            <p className="text-xs text-muted-foreground mt-4 mb-4">
                                A <span className="underline cursor-pointer text-foreground">return notification</span> will be sent to the customer
                            </p>

                            <Button
                                className="w-full"
                                onClick={handleSubmit}
                                disabled={createTicket.isPending || selectedReturnItems.size === 0}
                            >
                                {createTicket.isPending ? 'Creating...' : 'Create return'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Return Shipping Dialog */}
            <Dialog open={isReturnShippingOpen} onOpenChange={setIsReturnShippingOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Add return shipping</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none">Return shipping</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                                <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={tempReturnShipping}
                                    onChange={(e) => setTempReturnShipping(e.target.value)}
                                    className="pl-7 pr-12"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-semibold uppercase">INR</span>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsReturnShippingOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={() => {
                            setReturnShipping(parseFloat(tempReturnShipping) || 0);
                            setIsReturnShippingOpen(false);
                        }}>
                            Done
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
