import { useState } from 'react';
import Layout from '@/components/Layout';
import { useTickets, useUpdateTicket } from '@/hooks/useTickets';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Search } from 'lucide-react';
import { type TicketStage } from '@/types/database';
import { InvoicingTable } from './InvoicingTable';

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
      <div className="p-8 animate-fade-in">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Invoicing</h1>
          <p className="text-muted-foreground">Complete invoicing for exchanges</p>
        </div>

        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
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
