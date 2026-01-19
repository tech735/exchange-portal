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
    pending: ['EXCHANGE_COMPLETED', 'INVOICING_PENDING'],
    done: ['INVOICED', 'CLOSED'],
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
      closed_at: new Date().toISOString(),
      eventType: 'CLOSED',
    });
    toast({ title: 'Closed', description: 'Ticket closed' });
  };

  return (
    <Layout>
      <div className="p-4 sm:p-6 lg:p-8 animate-fade-in">
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">Invoicing</h1>
              <p className="text-muted-foreground">Complete invoicing for exchanges</p>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                disabled={!tickets || tickets.length === 0}
                className="flex items-center gap-2 w-full sm:w-auto"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                disabled={!tickets || tickets.length === 0}
                className="flex items-center gap-2 w-full sm:w-auto"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Export Excel
              </Button>
            </div>
          </div>
        </div>

        <div className="mb-4 sm:mb-6">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by order ID, name, or phone..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="done">Done</TabsTrigger>
          </TabsList>
          <TabsContent value={tab} className="mt-6">
            <InvoicingTable tickets={tickets} isLoading={isLoading} onInvoiceDone={handleInvoiceDone} onClose={handleClose} />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
