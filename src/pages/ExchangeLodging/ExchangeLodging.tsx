import { useState } from 'react';
import Layout from '@/components/Layout';
import { useTickets, useUpdateTicket } from '@/hooks/useTickets';
import { useToast } from '@/hooks/use-toast';
import { useProductPrices } from '@/hooks/useProductPrices';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Search, AlertTriangle, Calculator, IndianRupee, CheckCircle, Clock, Download, FileSpreadsheet } from 'lucide-react';
import { REASON_LABELS, STAGE_LABELS, type TicketStatus, type Ticket, type TicketItem } from '@/types/database';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { ExchangeForm } from './ExchangeForm';
import { TicketsTable } from './TicketsTable';
import { ExchangeCalculator } from './ExchangeCalculator';
import { exportTicketsToCSV, exportTicketsToExcel } from '@/utils/exportUtils';

export default function ExchangeLodging() {
  const [tab, setTab] = useState<'NEW' | 'IN_PROCESS' | 'COMPLETED'>('NEW');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  const statusFilters: Record<string, TicketStatus[]> = {
    NEW: ['NEW'],
    IN_PROCESS: ['IN_PROCESS'],
    COMPLETED: ['COMPLETED'],
  };

  const { data: tickets, isLoading } = useTickets({
    status: statusFilters[tab],
    search
  });

  const updateTicket = useUpdateTicket();
  const { toast } = useToast();
  const { data: productPrices } = useProductPrices();

  const handleTicketSelect = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setCalculatorOpen(true);
  };

  const handleMarkCollected = async (ticket: Ticket) => {
    // Calculate total exchange value
    const deliveryCharge = 150; // Default delivery charge

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
    const absAmount = Math.abs(netAmount);

    const message = isRefund
      ? `Confirm refund due of ₹${absAmount}? This will mark the ticket as processed.`
      : `Confirm payment collection of ₹${netAmount}?`;

    if (confirm(message)) {
      try {
        await updateTicket.mutateAsync({
          id: ticket.id,
          stage: 'LODGED',
          status: 'IN_PROCESS', // Keep in Process tab
          amount_collected: isRefund ? 0 : netAmount,
          refund_amount: isRefund ? absAmount : 0,
          exchange_completed_at: new Date().toISOString(),
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
    if (tickets && tickets.length > 0) {
      exportTicketsToCSV(tickets);
    } else {
      alert('No tickets to export');
    }
  };

  const handleExportExcel = () => {
    if (tickets && tickets.length > 0) {
      exportTicketsToExcel(tickets);
    } else {
      alert('No tickets to export');
    }
  };

  return (
    <Layout>
      <div className="page-shell animate-fade-in">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-semibold">Exchange Lodging</h1>
            <p className="text-muted-foreground mt-2">Create and manage exchange requests</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={!tickets || tickets.length === 0}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              disabled={!tickets || tickets.length === 0}
              className="flex items-center gap-2"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Export Excel
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Exchange
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>New Exchange Request</DialogTitle>
                </DialogHeader>
                <ExchangeForm onSuccess={() => setOpen(false)} />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="card-base">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="relative w-full lg:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by order ID, name, or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Tabs value={tab} onValueChange={(v) => setTab(v as 'NEW' | 'IN_PROCESS' | 'COMPLETED')} className="mt-6">
            <TabsList>
              <TabsTrigger value="NEW">New</TabsTrigger>
              <TabsTrigger value="IN_PROCESS">In Process</TabsTrigger>
              <TabsTrigger value="COMPLETED">Completed</TabsTrigger>
            </TabsList>
            <TabsContent value={tab} className="mt-6">
              <TicketsTable
                tickets={tickets}
                isLoading={isLoading}
                onTicketSelect={handleTicketSelect}
                onMarkCollected={handleMarkCollected}
                productPrices={productPrices}
              />
            </TabsContent>

            <Dialog open={calculatorOpen} onOpenChange={setCalculatorOpen}>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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
          </Tabs>
        </div>
      </div>
    </Layout>
  );
}
