import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Users, Clock, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QueueStats {
  name: string;
  count: number;
  status: 'active' | 'pending' | 'idle';
  avgTime?: string;
}

interface TeamCollaborationProps {
  className?: string;
}

export function TeamCollaboration({ className }: TeamCollaborationProps) {
  const { data: queueStats, isLoading } = useQuery({
    queryKey: ['team-collaboration'],
    queryFn: async (): Promise<QueueStats[]> => {
      // Get ticket counts by stage
      const { data: tickets, error } = await supabase
        .from('tickets')
        .select('stage, status, created_at, updated_at')
        .in('stage', ['LODGED', 'RETURN_PENDING', 'INVOICING_PENDING'])
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const ticketData = tickets as Array<{
        stage: string;
        status: string;
        created_at: string;
        updated_at: string;
      }>;

      const queues: QueueStats[] = [
        {
          name: 'Support Queue',
          count: ticketData.filter(t => t.stage === 'LODGED').length,
          status: ticketData.filter(t => t.stage === 'LODGED').length > 0 ? 'active' : 'idle'
        },
        {
          name: 'Warehouse Queue',
          count: ticketData.filter(t => t.stage === 'RETURN_PENDING').length,
          status: ticketData.filter(t => t.stage === 'RETURN_PENDING').length > 0 ? 'active' : 'idle'
        },
        {
          name: 'Invoicing Queue',
          count: ticketData.filter(t => t.stage === 'INVOICING_PENDING').length,
          status: ticketData.filter(t => t.stage === 'INVOICING_PENDING').length > 0 ? 'active' : 'idle'
        }
      ];

      return queues.sort((a, b) => b.count - a.count).slice(0, 3);
    },
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });

  const getStatusBadge = (status: QueueStats['status'], count: number) => {
    if (count === 0) return { text: 'No items', variant: 'outline' as const };
    if (status === 'active') return { text: 'Processing', variant: 'default' as const };
    return { text: 'Idle', variant: 'secondary' as const };
  };

  const getIcon = (name: string) => {
    if (name.includes('Support')) return Users;
    if (name.includes('Warehouse')) return Clock;
    return CheckCircle;
  };

  const getToneClasses = (name: string) => {
    if (name.includes('Support')) return 'bg-stage-lodged/10 text-stage-lodged';
    if (name.includes('Warehouse')) return 'bg-stage-warehouse/10 text-stage-warehouse';
    return 'bg-stage-invoicing/10 text-stage-invoicing';
  };

  if (isLoading) {
    return (
      <Card className={cn('flex flex-col', className)}>
        <CardContent className="p-6 flex flex-col flex-1">
          <p className="text-sm text-muted-foreground">Queue Overview</p>
          <h3 className="text-xl font-semibold mt-2">Active Queues</h3>
          <div className="flex-1 flex items-center justify-center">
            <div className="loader" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('flex flex-col', className)}>
      <CardContent className="p-6 flex flex-col flex-1">
        <p className="text-sm text-muted-foreground">Queue Overview</p>
        <h3 className="text-xl font-semibold mt-2">Active Queues</h3>
        <div className="mt-4 flex-1 flex flex-col justify-center gap-4">
          {queueStats?.map((queue) => {
            const Icon = getIcon(queue.name);
            const statusBadge = getStatusBadge(queue.status, queue.count);

            return (
              <div key={queue.name} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-full flex items-center justify-center ${getToneClasses(queue.name)}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{queue.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {queue.count} {queue.count === 1 ? 'item' : 'items'} pending
                    </p>
                  </div>
                </div>
                <Badge variant={statusBadge.variant} className="text-xs">
                  {statusBadge.text}
                </Badge>
              </div>
            );
          })}

          {queueStats?.length === 0 && (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">All queues are clear</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
