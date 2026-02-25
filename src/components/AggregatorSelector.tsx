import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Truck, ExternalLink } from 'lucide-react';

interface AggregatorSelectorProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (aggregator: 'SHIPDELIGHT' | 'ITHINK' | 'SHIPROCKET', awb: string) => Promise<void>;
    title: string;
    description?: string;
    isLoading?: boolean;
    previousAggregatorInfo?: string | null;
}

const AGGREGATORS = [
    { id: 'SHIPDELIGHT', name: 'Shipdelight', url: 'https://app.shipdelight.com/shipments/manage' },
    { id: 'ITHINK', name: 'iThink Logistics', url: 'https://my.ithinklogistics.com/v4/order/store-order' },
    { id: 'SHIPROCKET', name: 'Shiprocket', url: 'https://app.shiprocket.in/newlogin?routestate=seller%2Forders' },
] as const;

export function AggregatorSelector({
    open,
    onOpenChange,
    onSubmit,
    title,
    description,
    isLoading,
    previousAggregatorInfo
}: AggregatorSelectorProps) {
    const [selectedAggregator, setSelectedAggregator] = useState<'SHIPDELIGHT' | 'ITHINK' | 'SHIPROCKET' | null>(null);
    const [awb, setAwb] = useState('');

    const handleAggregatorClick = (aggregator: typeof AGGREGATORS[number]) => {
        setSelectedAggregator(aggregator.id);
        window.open(aggregator.url, '_blank');
    };

    const handleSubmit = async () => {
        if (selectedAggregator && awb) {
            try {
                await onSubmit(selectedAggregator, awb);
                setAwb('');
                setSelectedAggregator(null);
                onOpenChange(false);
            } catch (error) {
                // Error is handled by parent (toast), keep dialog open
                console.error('Submission failed', error);
            }
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    {description && <DialogDescription>{description}</DialogDescription>}
                </DialogHeader>

                {previousAggregatorInfo && previousAggregatorInfo !== 'Order not yet fulfilled.' && (
                    <div className="bg-muted/50 p-3 rounded-md border text-sm mt-2">
                        <span className="font-semibold text-foreground">Previous Fulfillment:</span>
                        <p className="text-muted-foreground mt-1">{previousAggregatorInfo}</p>
                    </div>
                )}

                <div className="space-y-6 py-4">
                    <div className="space-y-3">
                        <Label>1. Select Aggregator & Book Shipment</Label>
                        <div className="grid grid-cols-1 gap-2">
                            {AGGREGATORS.map((agg) => (
                                <Button
                                    key={agg.id}
                                    variant={selectedAggregator === agg.id ? 'default' : 'outline'}
                                    className="justify-between h-auto py-3 px-4"
                                    onClick={() => handleAggregatorClick(agg)}
                                >
                                    <span className="flex items-center gap-2">
                                        <Truck className="h-4 w-4" />
                                        {agg.name}
                                    </span>
                                    <ExternalLink className="h-4 w-4 opacity-50" />
                                </Button>
                            ))}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Clicking an option will open the booking page in a new tab.
                        </p>
                    </div>

                    <div className="space-y-3">
                        <Label htmlFor="awb">2. Enter Generated AWB Number</Label>
                        <Input
                            id="awb"
                            value={awb}
                            onChange={(e) => setAwb(e.target.value.toUpperCase())}
                            placeholder="e.g. 1234567890"
                            disabled={!selectedAggregator}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={!selectedAggregator || !awb || isLoading}
                    >
                        {isLoading ? 'Processing...' : 'Submit Booking'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
