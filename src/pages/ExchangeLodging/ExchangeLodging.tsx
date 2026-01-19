import { useState } from 'react';
import Layout from '@/components/Layout';
import { useTickets } from '@/hooks/useTickets';
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
import { ExchangeCalculator } from './ExchangeCalculator.tsx';
import { exportTicketsToCSV, exportTicketsToExcel } from '@/utils/exportUtils';

export default function ExchangeLodging() {
  const [tab, setTab] = useState<'NEW' | 'IN_PROCESS' | 'COMPLETED'>('NEW');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);

  const statusFilters: Record<string, TicketStatus[]> = {
    NEW: ['NEW'],
    IN_PROCESS: ['IN_PROCESS'],
    COMPLETED: ['COMPLETED'],
  };

  const { data: tickets, isLoading } = useTickets({ 
    status: statusFilters[tab], 
    search 
  });

  const handleTicketSelect = (ticket: any) => {
    setSelectedTicket(ticket);
    setTab('IN_PROCESS');
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
      <div className="p-4 sm:p-6 lg:p-8 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-3xl font-bold">Exchange Lodging</h1>
            <p className="text-muted-foreground">Create and manage exchange requests</p>
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
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
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

        <div className="mb-4 sm:mb-6">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by order ID, name, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="NEW">New</TabsTrigger>
            <TabsTrigger value="IN_PROCESS">In Process</TabsTrigger>
            <TabsTrigger value="COMPLETED">Completed</TabsTrigger>
          </TabsList>
          <TabsContent value={tab} className="mt-6">
            {tab === 'IN_PROCESS' && selectedTicket ? (
              <ExchangeCalculator ticket={selectedTicket} />
            ) : (
              <TicketsTable 
                tickets={tickets} 
                isLoading={isLoading} 
                onTicketSelect={handleTicketSelect}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
