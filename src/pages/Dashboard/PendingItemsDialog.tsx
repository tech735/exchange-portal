import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { STAGE_LABELS, STATUS_LABELS, Ticket } from '@/types/database';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface PendingItemsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function PendingItemsDialog({ open, onOpenChange }: PendingItemsDialogProps) {
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        let cancelled = false;

        if (open) {
            setTickets([]);
            setLoading(true);
            setError(null);

            const fetchPendingTickets = async () => {
                try {
                    const { data, error: fetchError } = await supabase
                        .from('tickets')
                        .select('*')
                        .in('stage', ['LODGED', 'RETURN_PENDING', 'INVOICING_PENDING'])
                        .order('updated_at', { ascending: false })
                        .limit(200);

                    if (fetchError) throw fetchError;

                    if (!cancelled) {
                        setTickets(data || []);
                    }
                } catch (err: unknown) {
                    console.error('Error fetching pending tickets:', err);
                    if (!cancelled) {
                        let errorMessage = 'Failed to fetch pending tickets';
                        if (err && typeof err === 'object' && 'message' in err) {
                            errorMessage = String((err as Record<string, unknown>).message);
                        } else if (err instanceof Error) {
                            errorMessage = err.message;
                        } else if (typeof err === 'string') {
                            errorMessage = err;
                        }
                        setError(errorMessage);
                        setTickets([]);
                    }
                } finally {
                    if (!cancelled) {
                        setLoading(false);
                    }
                }
            };

            fetchPendingTickets();
        }

        return () => {
            cancelled = true;
        };
    }, [open]);

    const getStageColor = (stage: string) => {
        switch (stage) {
            case 'LODGED':
                return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'RETURN_PENDING':
                return 'bg-amber-100 text-amber-800 border-amber-200';
            case 'INVOICING_PENDING':
                return 'bg-purple-100 text-purple-800 border-purple-200';
            default:
                return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'NEW':
                return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'IN_PROCESS':
                return 'bg-amber-100 text-amber-800 border-amber-200';
            case 'ESCALATED':
                return 'bg-red-100 text-red-800 border-red-200';
            default:
                return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const navigateToTicket = (ticketId: string) => {
        onOpenChange(false);
        navigate(`/exchange-lodging?search=${encodeURIComponent(ticketId)}`);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px] max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="text-xl">Review Pending Items</DialogTitle>
                </DialogHeader>

                {loading ? (
                    <div className="flex h-[300px] items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : error ? (
                    <div className="flex h-[200px] flex-col items-center justify-center text-destructive">
                        <AlertCircle className="h-8 w-8 mb-2" />
                        <p className="font-medium text-center">{error}</p>
                    </div>
                ) : tickets.length === 0 ? (
                    <div className="flex h-[200px] flex-col items-center justify-center text-muted-foreground">
                        <p>No pending items found.</p>
                        <p className="text-sm">All queues are clear!</p>
                    </div>
                ) : (
                    <ScrollArea className="flex-1 pr-4 -mr-4">
                        <div className="space-y-4 py-4">
                            {tickets.length === 200 && (
                                <div className="text-xs text-center text-muted-foreground pb-2">
                                    Showing first 200 pending items
                                </div>
                            )}
                            {tickets.map((ticket) => (
                                <div
                                    key={ticket.id}
                                    onClick={() => navigateToTicket(ticket.id)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            navigateToTicket(ticket.id);
                                        }
                                    }}
                                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                                >
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-sm">
                                                {ticket.id.slice(0, 8).toUpperCase()}
                                            </span>
                                            <span className="text-sm text-muted-foreground">
                                                Order #{ticket.order_id}
                                            </span>
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                            {ticket.customer_name ?? ''} • {ticket.assigned_team ?? ''}
                                        </p>
                                    </div>

                                    <div className="flex flex-wrap gap-2 sm:justify-end">
                                        <Badge variant="outline" className={getStageColor(ticket.stage)}>
                                            {STAGE_LABELS[ticket.stage as keyof typeof STAGE_LABELS] || ticket.stage}
                                        </Badge>
                                        <Badge variant="outline" className={getStatusColor(ticket.status)}>
                                            {STATUS_LABELS[ticket.status as keyof typeof STATUS_LABELS] || ticket.status}
                                        </Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                )}
            </DialogContent>
        </Dialog>
    );
}
