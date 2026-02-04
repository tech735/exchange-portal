import { useState } from 'react';
import Layout from '@/components/Layout';
import { useTickets, useUpdateTicket } from '@/hooks/useTickets';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Search, Download, FileSpreadsheet } from 'lucide-react';
import { type TicketStage } from '@/types/database';
import { InvoicingTable } from './InvoicingTable';
import { exportTicketsToCSV, exportTicketsToExcel } from '@/utils/exportUtils';

export default function Invoicing() {
  const [tab, setTab] = useState('pending');
  const [search, setSearch] = useState('');
  const { toast } = useToast();
  const updateTicket = useUpdateTicket();

  const stageFilters: Record<string, TicketStage[]> = {
    pending: ['EXCHANGE_COMPLETED', 'INVOICING_PENDING', 'INVOICED', 'TO_BE_REFUNDED'],
    done: ['CLOSED'],
  };

  const { data: tickets, isLoading } = useTickets({ stage: stageFilters[tab], search });

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

  const handleInvoiceDone = async (id: string) => {
    await updateTicket.mutateAsync({
      id,
      stage: 'INVOICED',
      status: 'COMPLETED',
      invoicing_done_at: new Date().toISOString(),
      eventType: 'INVOICED',
    });
    toast({ title: 'Done', description: 'Invoicing completed' });
  };

  const handleClose = async (id: string) => {
    await updateTicket.mutateAsync({
      id,
      stage: 'CLOSED',
      status: 'COMPLETED',
      refund_status: 'PROCESSED',
      closed_at: new Date().toISOString(),
      eventType: 'CLOSED',
    });
    toast({ title: 'Ticket Finalized', description: 'Ticket has been finalized and closed' });
  };

  const handleSendToRefund = async (id: string) => {
    await updateTicket.mutateAsync({
      id,
      stage: 'CLOSED',
      status: 'COMPLETED',
      refund_sent_at: new Date().toISOString(),
      refund_status: 'PROCESSED',
      eventType: 'REFUND_SENT',
    });
    toast({ title: 'Refund Processed', description: 'Ticket marked as refunded and closed' });
  };

  return (
    <Layout>
      <div className="page-shell animate-fade-in">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-semibold">Invoicing</h1>
            <p className="text-muted-foreground mt-2">Complete invoicing for exchanges</p>
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
          </div>
        </div>

        <div className="card-base">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by order ID, name, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <Tabs value={tab} onValueChange={setTab} className="mt-6">
            <TabsList>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="done">Done</TabsTrigger>
            </TabsList>
            <TabsContent value={tab} className="mt-6">
              <InvoicingTable tickets={tickets} isLoading={isLoading} onInvoiceDone={handleInvoiceDone} onClose={handleClose} onSendToRefund={handleSendToRefund} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
}
