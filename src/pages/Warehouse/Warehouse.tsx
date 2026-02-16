import { useState } from 'react';
import Layout from '@/components/Layout';
import { useTickets, useUpdateTicket } from '@/hooks/useTickets';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Search } from 'lucide-react';
import { type TicketStage, type Ticket } from '@/types/database';
import { WarehouseTable } from './WarehouseTable';
import { AggregatorSelector } from '@/components/AggregatorSelector';
import { QCActionDialog } from '@/components/QCActionDialog';

export default function Warehouse() {
  const [tab, setTab] = useState('new_warehouse');
  const [search, setSearch] = useState('');

  // Dialog States
  const [aggregatorDialogOpen, setAggregatorDialogOpen] = useState(false);
  const [qcDialogOpen, setQcDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  // To track which action opened the aggregator dialog (RETURN or EXCHANGE)
  const [aggregatorActionType, setAggregatorActionType] = useState<'RETURN' | 'EXCHANGE'>('RETURN');

  // To track QC action
  const [qcActionType, setQcActionType] = useState<'APPROVE' | 'DENY'>('APPROVE');

  const { toast } = useToast();
  const updateTicket = useUpdateTicket();

  const stageFilters: Record<string, TicketStage[]> = {
    new_warehouse: ['LODGED'], // AND payment collected (handled by backend or assumed for now based on flow)
    return_pending: ['RETURN_PENDING'],
    return_received: ['RETURN_RECEIVED'],
    approved: ['WAREHOUSE_APPROVED'],
    denied: ['WAREHOUSE_DENIED'],
    exchange_booked: ['EXCHANGE_BOOKED'], // Removed EXCHANGE_COMPLETED to avoid potential query issues if enum missing
  };

  const { data: rawTickets, isLoading } = useTickets({ stage: stageFilters[tab], search });

  // Filter tickets: For 'new_warehouse', only show tickets where payment is collected.
  const tickets = rawTickets?.filter(ticket => {
    if (tab === 'new_warehouse') {
      // Show tickets that have been processed by Exchange team (either Paid or Refund Marked)
      return ticket.status === 'IN_PROCESS';
    }
    return true;
  });

  // HANDLERS

  const handleBookReturn = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setAggregatorActionType('RETURN');
    setAggregatorDialogOpen(true);
  };

  const handleAggregatorSubmit = async (aggregator: 'SHIPDELIGHT' | 'ITHINK' | 'SHIPROCKET', awb: string) => {
    if (!selectedTicket) {
      toast({ title: 'Error', description: 'No ticket selected', variant: 'destructive' });
      return;
    }

    try {
      if (aggregatorActionType === 'RETURN') {
        await updateTicket.mutateAsync({
          id: selectedTicket.id,
          stage: 'RETURN_PENDING',
          return_aggregator: aggregator,
          return_awb: awb,
          return_booked_at: new Date().toISOString(),
          eventType: 'UPDATED',
        });
        toast({ title: 'Return Booked', description: 'Ticket moved to Return Pending' });
      } else {
        await updateTicket.mutateAsync({
          id: selectedTicket.id,
          stage: 'EXCHANGE_BOOKED',
          exchange_aggregator: aggregator,
          exchange_awb: awb,
          exchange_booked_at: new Date().toISOString(),
          eventType: 'EXCHANGE_DONE',
        });
        toast({ title: 'Exchange Booked', description: 'Ticket moved to Exchange Booked' });
      }
      setAggregatorDialogOpen(false); // Close dialog on success
    } catch (error: any) {
      console.error('Aggregator Submit Error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to submit booking. Please check console.',
        variant: 'destructive'
      });
      throw error;
    }
  };

  const handleReceive = async (id: string) => {
    try {
      await updateTicket.mutateAsync({
        id,
        stage: 'RETURN_RECEIVED',
        return_received_at: new Date().toISOString(),
        eventType: 'RECEIVED',
      });
      toast({ title: 'Received', description: 'Return received. Moved to QC Pending.' });
    } catch (error: any) {
      toast({ title: 'Error', description: 'Failed to receive return.', variant: 'destructive' });
    }
  };

  const handleQCAction = (ticket: Ticket, action: 'APPROVE' | 'DENY') => {
    setSelectedTicket(ticket);
    setQcActionType(action);
    setQcDialogOpen(true);
  };

  const handleQCSubmit = async (decision: 'APPROVED' | 'DENIED', notes: string) => {
    if (!selectedTicket) {
      toast({ title: 'Error', description: 'No ticket selected', variant: 'destructive' });
      return;
    }

    try {
      if (decision === 'APPROVED') {
        await updateTicket.mutateAsync({
          id: selectedTicket.id,
          stage: 'WAREHOUSE_APPROVED',
          qc_decision: 'APPROVED',
          qc_notes: notes,
          eventType: 'APPROVED',
        });
        toast({ title: 'Approved', description: 'Ticket moved to Approved tab.' });
      } else {
        await updateTicket.mutateAsync({
          id: selectedTicket.id,
          stage: 'WAREHOUSE_DENIED',
          qc_decision: 'DENIED',
          qc_notes: notes,
          eventType: 'DENIED',
        });
        toast({ title: 'Denied', description: 'Ticket moved to Denied tab.' });
      }
      setQcDialogOpen(false); // Close dialog on success
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to submit QC decision.',
        variant: 'destructive'
      });
      throw error;
    }
  };

  const handleBookExchange = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setAggregatorActionType('EXCHANGE');
    setAggregatorDialogOpen(true);
  };

  return (
    <Layout>
      <div className="page-shell animate-fade-in">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-semibold">Warehouse Processing</h1>
            <p className="text-muted-foreground mt-2">Process returns and exchanges</p>
          </div>
        </div>

        <div className="card-base">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>

          <Tabs value={tab} onValueChange={setTab} className="mt-6">
            <TabsList className="inline-flex h-auto w-auto items-center justify-start rounded-lg bg-muted p-1 text-muted-foreground overflow-x-auto">
              <TabsTrigger value="new_warehouse" className="rounded-md px-3 py-1.5">New</TabsTrigger>
              <TabsTrigger value="return_pending" className="rounded-md px-3 py-1.5">Return Pending</TabsTrigger>
              <TabsTrigger value="return_received" className="rounded-md px-3 py-1.5">QC Pending</TabsTrigger>
              <TabsTrigger value="approved" className="rounded-md px-3 py-1.5">Approved</TabsTrigger>
              <TabsTrigger value="denied" className="rounded-md px-3 py-1.5">Denied</TabsTrigger>
              <TabsTrigger value="exchange_booked" className="rounded-md px-3 py-1.5">Exchange Booked</TabsTrigger>
            </TabsList>
            <TabsContent value={tab} className="mt-6">
              <WarehouseTable
                tickets={tickets}
                isLoading={isLoading}
                onBookReturn={handleBookReturn}
                onReceive={handleReceive}
                onQCAction={handleQCAction}
                onBookExchange={handleBookExchange}
              />
            </TabsContent>
          </Tabs>
        </div>

        <AggregatorSelector
          open={aggregatorDialogOpen}
          onOpenChange={setAggregatorDialogOpen}
          onSubmit={handleAggregatorSubmit}
          title={aggregatorActionType === 'RETURN' ? 'Book Return Request' : 'Book Exchange Shipment'}
          description={aggregatorActionType === 'RETURN'
            ? 'Select an aggregator to book the return pickup. You must enter the generated Return AWB.'
            : 'Select an aggregator to ship the exchange item. You must enter the generated Exchange AWB.'}
          isLoading={updateTicket.isPending}
        />

        <QCActionDialog
          open={qcDialogOpen}
          onOpenChange={setQcDialogOpen}
          onSubmit={handleQCSubmit}
          title={qcActionType === 'APPROVE' ? 'Approve Return' : 'Deny Return'}
          actionType={qcActionType}
          isLoading={updateTicket.isPending}
        />
      </div>
    </Layout>
  );
}
