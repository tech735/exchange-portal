import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { useTickets, useUpdateTicket } from '@/hooks/useTickets';
import { useToast } from '@/hooks/use-toast';
import { useProductPrices } from '@/hooks/useProductPrices';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Plus, Search, Download, Filter, Package } from 'lucide-react';
import { REASON_LABELS, STAGE_LABELS, type TicketStatus, type TicketStage, type ReasonCode, type Ticket, type TicketItem } from '@/types/database';
import { ExchangeForm } from './ExchangeForm';
import { TicketsTable } from './TicketsTable';
import { ExchangeCalculator } from './ExchangeCalculator';
import { exportTicketsToCSV, exportTicketsToExcel } from '@/utils/exportUtils';
import { ShopifyExchangeCreate } from './ShopifyExchangeCreate';

export default function ExchangeLodging() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [reasonFilter, setReasonFilter] = useState<string>('all');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');

  const [open, setOpen] = useState(false);
  const [shopifyOpen, setShopifyOpen] = useState(false);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  const { data: allTickets, isLoading } = useTickets({});
  const updateTicket = useUpdateTicket();
  const { toast } = useToast();
  const { data: productPrices } = useProductPrices();

  const filteredTickets = (allTickets || []).filter((ticket) => {
    const searchFields = [
      ticket.order_id,
      ticket.customer_name,
      ticket.customer_phone,
      ticket.customer_email,
      ticket.reason_code,
      ticket.stage,
      ticket.status,
    ];

    const matchesSearch = search === '' || searchFields.some(field =>
      field?.toLowerCase().includes(search.toLowerCase())
    );

    const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
    const matchesReason = reasonFilter === 'all' || ticket.reason_code === reasonFilter;
    const matchesStage = stageFilter === 'all' || ticket.stage === stageFilter;
    const matchesPayment = paymentFilter === 'all' ||
      (paymentFilter === 'paid' && ticket.is_paid) ||
      (paymentFilter === 'unpaid' && !ticket.is_paid);

    return matchesSearch && matchesStatus && matchesReason && matchesStage && matchesPayment;
  });

  const handleTicketSelect = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setCalculatorOpen(true);
  };

  const handleMarkCollected = async (ticket: Ticket) => {
    const deliveryCharge = 150;

    const calculateItemValue = (items: TicketItem[]): number => {
      return items.reduce((total, item) => {
        const itemPrice = productPrices?.[item.sku] || 1000;
        return total + (itemPrice * item.qty);
      }, 0);
    };

    const returnItemsValue = calculateItemValue(ticket.return_items || []);
    const exchangeItemsValue = calculateItemValue(ticket.exchange_items || []);
    const netAmount = exchangeItemsValue - returnItemsValue + deliveryCharge;

    const isRefund = netAmount < 0;
    const isZero = netAmount === 0;
    const absAmount = Math.abs(netAmount);

    const message = isRefund
      ? `Confirm refund due of ₹${absAmount}? This will mark the ticket as processed.`
      : isZero
      ? `No amount to collect or pay. Mark this ticket as settled?`
      : `Confirm payment collection of ₹${netAmount}?`;

    if (confirm(message)) {
      try {
        await updateTicket.mutateAsync({
          id: ticket.id,
          stage: 'LODGED',
          status: 'COMPLETED',
          amount_collected: isRefund ? 0 : netAmount,
          refund_amount: isRefund ? absAmount : 0,
          exchange_completed_at: new Date().toISOString(),
          is_paid: true,
          eventType: 'UPDATED'
        });
        toast({
          title: isRefund ? 'Refund Marked' : 'Payment Collected',
          description: 'Ticket moved to Warehouse processing',
        });
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to update ticket',
          variant: 'destructive'
        });
      }
    }
  };

  const handleExportCSV = () => {
    if (filteredTickets.length > 0) {
      exportTicketsToCSV(filteredTickets);
    }
  };

  return (
    <Layout>
      <div className="space-y-6 animate-fade-in">
        {/* Page Header — matches Asset Tracker */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl lg:text-2xl font-semibold tracking-tight">Exchange Tickets</h1>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="gap-2"
              onClick={handleExportCSV}
              disabled={filteredTickets.length === 0}
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export</span>
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Manual Exchange</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl sm:max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>New Manual Exchange Request</DialogTitle>
                </DialogHeader>
                <ExchangeForm onSuccess={() => setOpen(false)} />
              </DialogContent>
            </Dialog>

            <Dialog open={shopifyOpen} onOpenChange={setShopifyOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Package className="w-4 h-4" />
                  <span className="hidden sm:inline">Create Exchange</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[1200px] sm:w-[95vw] sm:max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create Exchange from Shopify Order</DialogTitle>
                </DialogHeader>
                <ShopifyExchangeCreate onSuccess={() => setShopifyOpen(false)} />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filters — matches Asset Tracker pattern */}
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2">
          <div className="relative w-full sm:w-64 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search exchange tickets..."
              className="pl-10 w-full rounded-full bg-card border-border/60 shadow-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px] rounded-full bg-card border-border/60 shadow-sm">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="NEW">New</SelectItem>
                <SelectItem value="IN_PROCESS">In Process</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="DENIED">Denied</SelectItem>
                <SelectItem value="ESCALATED">Escalated</SelectItem>
              </SelectContent>
            </Select>

            <Select value={reasonFilter} onValueChange={setReasonFilter}>
              <SelectTrigger className="w-[140px] rounded-full bg-card border-border/60 shadow-sm">
                <SelectValue placeholder="All Reasons" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Reasons</SelectItem>
                {(Object.entries(REASON_LABELS) as [ReasonCode, string][]).map(([code, label]) => (
                  <SelectItem key={code} value={code}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="w-[150px] rounded-full bg-card border-border/60 shadow-sm">
                <SelectValue placeholder="All Stages" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stages</SelectItem>
                {(Object.entries(STAGE_LABELS) as [TicketStage, string][]).map(([code, label]) => (
                  <SelectItem key={code} value={code}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="relative shrink-0 rounded-full bg-card border-border/60 shadow-sm">
                  <Filter className="w-4 h-4" />
                  {paymentFilter !== 'all' && (
                    <div className="w-2 h-2 rounded-full bg-primary absolute -top-1 -right-1" />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-4" align="start">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium leading-none">Additional Filters</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 text-muted-foreground hover:text-primary"
                      onClick={() => setPaymentFilter('all')}
                    >
                      Reset
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label>Payment Status</Label>
                    <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                      <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="unpaid">Unpaid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Table */}
        <TicketsTable
          tickets={filteredTickets}
          isLoading={isLoading}
          onTicketSelect={handleTicketSelect}
          onMarkCollected={handleMarkCollected}
          productPrices={productPrices}
        />

        {/* Calculator Dialog */}
        <Dialog open={calculatorOpen} onOpenChange={setCalculatorOpen}>
          <DialogContent className="sm:max-w-4xl sm:max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Exchange Calculator</DialogTitle>
            </DialogHeader>
            {selectedTicket && (
              <ExchangeCalculator
                ticket={selectedTicket}
                onProcessed={() => {
                  setCalculatorOpen(false);
                  setSelectedTicket(null);
                }}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
