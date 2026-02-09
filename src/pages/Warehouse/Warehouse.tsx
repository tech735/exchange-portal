import { useState } from 'react';
import Layout from '@/components/Layout';
import { useTickets, useUpdateTicket } from '@/hooks/useTickets';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Search } from 'lucide-react';
import { type TicketStage } from '@/types/database';
import { WarehouseTable } from './WarehouseTable';
import { AWBFormDialog } from '@/components/AWBFormDialog';

export default function Warehouse() {
  const [tab, setTab] = useState('pending');
  const [search, setSearch] = useState('');
  const [awbDialogOpen, setAwbDialogOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [awbType, setAwbType] = useState<'return' | 'exchange'>('return');
  const { toast } = useToast();
  const updateTicket = useUpdateTicket();

  const stageFilters: Record<string, TicketStage[]> = {
    pending: ['LODGED', 'WAREHOUSE_PENDING'],
    approved: ['WAREHOUSE_APPROVED'],
    completed: ['EXCHANGE_COMPLETED', 'INVOICING_PENDING', 'INVOICED', 'CLOSED'],
    denied: ['WAREHOUSE_DENIED'],
  };

  const { data: tickets, isLoading } = useTickets({ stage: stageFilters[tab], search });

  const handleReceive = async (id: string) => {
    await updateTicket.mutateAsync({
      id,
      stage: 'WAREHOUSE_PENDING',
      status: 'IN_PROCESS',
      warehouse_received_at: new Date().toISOString(),
      assigned_team: 'warehouse',
      eventType: 'RECEIVED',
    });
    toast({ title: 'Received', description: 'Items received at warehouse' });
  };

  const handleApprove = (ticketId: string, orderId: string) => {
    setSelectedTicketId(ticketId);
    setSelectedOrderId(orderId);
    setAwbType('return');
    setAwbDialogOpen(true);
  };

  const handleAwbSubmit = async (awb: string) => {
    if (!selectedTicketId) return;
    
    if (awbType === 'return') {
      await updateTicket.mutateAsync({
        id: selectedTicketId,
        stage: 'WAREHOUSE_APPROVED',
        warehouse_approved_at: new Date().toISOString(),
        return_awb: awb,
        eventType: 'APPROVED',
      });
      toast({ title: 'Approved', description: `Return approved with AWB: ${awb}` });
    } else {
      await updateTicket.mutateAsync({
        id: selectedTicketId,
        stage: 'EXCHANGE_COMPLETED',
        exchange_completed_at: new Date().toISOString(),
        exchange_awb: awb,
        eventType: 'EXCHANGE_DONE',
      });
      toast({ title: 'Completed', description: `Exchange completed with AWB: ${awb}` });
    }
  };

  const handleExchangeComplete = async (ticketId: string, orderId: string) => {
    // Update ticket stage immediately to EXCHANGE_COMPLETED
    await updateTicket.mutateAsync({
      id: ticketId,
      stage: 'EXCHANGE_COMPLETED',
      exchange_completed_at: new Date().toISOString(),
      eventType: 'EXCHANGE_DONE',
    });
    toast({ title: 'Exchange Completed', description: 'Exchange marked as completed' });
    
    // Optionally open AWB dialog for tracking
    setSelectedTicketId(ticketId);
    setSelectedOrderId(orderId);
    setAwbType('exchange');
    setAwbDialogOpen(true);
  };

  const handleDeny = async (id: string) => {
    await updateTicket.mutateAsync({
      id,
      stage: 'WAREHOUSE_DENIED',
      status: 'DENIED',
      warehouse_denied_at: new Date().toISOString(),
      eventType: 'DENIED',
    });
    toast({ title: 'Denied', description: 'Return denied' });
  };

  const handleSendToInvoicing = async (id: string) => {
    await updateTicket.mutateAsync({
      id,
      stage: 'INVOICING_PENDING',
      sent_to_invoicing_at: new Date().toISOString(),
      assigned_team: 'invoicing',
      eventType: 'SENT_TO_INVOICE',
    });
    toast({ title: 'Sent to Invoicing', description: 'Exchange sent to invoicing team' });
  };

  return (
    <Layout>
      <div className="page-shell animate-fade-in">
        <div>
          <h1 className="text-3xl font-semibold">Warehouse Processing</h1>
          <p className="text-muted-foreground mt-2">Process returns and exchanges</p>
        </div>

        <div className="card-base">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>

          <Tabs value={tab} onValueChange={setTab} className="mt-6">
            <TabsList>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
              <TabsTrigger value="denied">Denied</TabsTrigger>
            </TabsList>
            <TabsContent value={tab} className="mt-6">
              <WarehouseTable
                tickets={tickets}
                isLoading={isLoading}
                onReceive={handleReceive}
                onApprove={handleApprove}
                onDeny={handleDeny}
                onExchangeComplete={handleExchangeComplete}
                onSendToInvoicing={handleSendToInvoicing}
              />
            </TabsContent>
          </Tabs>
        </div>

        <AWBFormDialog
          open={awbDialogOpen}
          onOpenChange={setAwbDialogOpen}
          onSubmit={handleAwbSubmit}
          orderId={selectedOrderId || ''}
          awbType={awbType}
          isLoading={updateTicket.isPending}
        />
      </div>
    </Layout>
  );
}
