import { useState } from 'react';
import Layout from '@/components/Layout';
import { useTickets } from '@/hooks/useTickets';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Search, AlertTriangle } from 'lucide-react';
import { REASON_LABELS, STAGE_LABELS, type TicketStatus, type Ticket } from '@/types/database';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { ExchangeForm } from './ExchangeForm';
import { TicketsTable } from './TicketsTable';

export default function ExchangeLodging() {
  const [tab, setTab] = useState<TicketStatus>('NEW');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const statusFilters: Record<string, TicketStatus[]> = {
    NEW: ['NEW'],
    IN_PROCESS: ['IN_PROCESS'],
    COMPLETED: ['COMPLETED'],
  };

  const { data: tickets, isLoading } = useTickets({ status: statusFilters[tab], search });

  return (
    <Layout>
      <div className="p-8 animate-fade-in">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Exchange Lodging</h1>
            <p className="text-muted-foreground">Create and manage exchange requests</p>
          </div>
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

        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by order ID, name, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as TicketStatus)}>
          <TabsList>
            <TabsTrigger value="NEW">New</TabsTrigger>
            <TabsTrigger value="IN_PROCESS">In Process</TabsTrigger>
            <TabsTrigger value="COMPLETED">Completed</TabsTrigger>
          </TabsList>
          <TabsContent value={tab} className="mt-6">
            <TicketsTable tickets={tickets} isLoading={isLoading} />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
