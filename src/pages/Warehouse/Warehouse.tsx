import { useState } from 'react';
import Layout from '@/components/Layout';
import { useTickets, useUpdateTicket } from '@/hooks/useTickets';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Search } from 'lucide-react';
import { type TicketStage, type Ticket } from '@/types/database';
import { WarehouseTable } from './WarehouseTable';
import { AggregatorSelector } from '@/components/AggregatorSelector';
import { QCActionDialog } from '@/components/QCActionDialog';

const stageTabs = [
  { key: 'new_warehouse', label: 'New Requests' },
  { key: 'return_pending', label: 'Return Pending' },
  { key: 'return_received', label: 'QC Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'denied', label: 'Denied' },
  { key: 'exchange_booked', label: 'Exchange Booked' },
];

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

  // Filter tickets: For 'new_warehouse', show tickets where payment is confirmed OR status is In Process and marked as paid
  const tickets = rawTickets?.filter(ticket => {
    if (tab === 'new_warehouse') {
      return ticket.is_paid === true || (ticket.status === 'IN_PROCESS' && ticket.exchange_completed_at != null);
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
          // Booking the exchange is the end of the support workflow, so the
          // ticket's status settles at COMPLETED even though later stages
          // (invoicing, closure) still move the stage forward.
          status: 'COMPLETED',
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl lg:text-2xl font-semibold tracking-tight">Warehouse Processing</h1>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2">
          <div className="relative w-full sm:w-64 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search warehouse tickets..."
              className="pl-10 w-full rounded-full bg-card border-border/60 shadow-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Select value={tab} onValueChange={setTab}>
            <SelectTrigger className="w-full sm:w-[180px] rounded-full bg-card border-border/60 shadow-sm">
              <SelectValue placeholder="Stage" />
            </SelectTrigger>
            <SelectContent>
              {stageTabs.map(({ key, label }) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <WarehouseTable
          tickets={tickets}
          isLoading={isLoading}
          onBookReturn={handleBookReturn}
          onReceive={handleReceive}
          onQCAction={handleQCAction}
          onBookExchange={handleBookExchange}
        />

        <AggregatorSelector
          open={aggregatorDialogOpen}
          onOpenChange={setAggregatorDialogOpen}
          onSubmit={handleAggregatorSubmit}
          title={aggregatorActionType === 'RETURN' ? 'Book Return Request' : 'Book Exchange Shipment'}
          description={aggregatorActionType === 'RETURN'
            ? 'Select an aggregator to book the return pickup. You must enter the generated Return AWB.'
            : 'Select an aggregator to ship the exchange item. You must enter the generated Exchange AWB.'}
          isLoading={updateTicket.isPending}
          previousAggregatorInfo={selectedTicket?.notes}
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
