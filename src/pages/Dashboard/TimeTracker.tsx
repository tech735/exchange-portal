import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { Clock, TrendingUp, Activity } from 'lucide-react';

interface TimeTrackerProps {
  className?: string;
}

export function TimeTracker({ className }: TimeTrackerProps) {
  const { data: timeData, isLoading } = useQuery({
    queryKey: ['time-tracker'],
    queryFn: async () => {
      const today = new Date();
      const todayStart = startOfDay(today);
      const todayEnd = endOfDay(today);

      // Get today's ticket activity
      const { data: todayTickets, error } = await supabase
        .from('tickets')
        .select('created_at, updated_at, status, stage')
        .gte('created_at', todayStart.toISOString())
        .lte('created_at', todayEnd.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      const tickets = todayTickets as Array<{
        created_at: string;
        updated_at: string;
        status: string;
        stage: string;
      }>;

      // Calculate active processing time
      const activeTickets = tickets.filter(t => 
        ['NEW', 'IN_PROCESS'].includes(t.status) && 
        !['CLOSED', 'INVOICED'].includes(t.stage)
      );

      // Calculate total time spent on tickets today (simplified calculation)
      const totalProcessingTime = tickets.reduce((acc, ticket) => {
        const created = new Date(ticket.created_at);
        const updated = new Date(ticket.updated_at);
        const processingTime = (updated.getTime() - created.getTime()) / (1000 * 60); // in minutes
        return acc + processingTime;
      }, 0);

      // Get comparison data from yesterday
      const yesterday = subDays(today, 1);
      const yesterdayStart = startOfDay(yesterday);
      const yesterdayEnd = endOfDay(yesterday);

      const { data: yesterdayTickets } = await supabase
        .from('tickets')
        .select('created_at')
        .gte('created_at', yesterdayStart.toISOString())
        .lte('created_at', yesterdayEnd.toISOString());

      const yesterdayCount = yesterdayTickets?.length || 0;
      const todayCount = tickets.length;
      const trend = todayCount >= yesterdayCount ? 'up' : 'down';
      const trendPercentage = yesterdayCount > 0 
        ? Math.round(((todayCount - yesterdayCount) / yesterdayCount) * 100)
        : 0;

      // Format time display
      const hours = Math.floor(totalProcessingTime / 60);
      const minutes = Math.round(totalProcessingTime % 60);
      const timeString = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

      return {
        totalTime: timeString,
        totalMinutes: Math.round(totalProcessingTime),
        activeTickets: activeTickets.length,
        todayTickets: todayCount,
        trend,
        trendPercentage,
        avgTimePerTicket: tickets.length > 0 ? Math.round(totalProcessingTime / tickets.length) : 0
      };
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <div className={`rounded-2xl p-6 bg-slate-900 text-white shadow-lg ${className}`}>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Time Tracker</p>
        <div className="h-8 w-20 bg-slate-700 rounded mt-3 mb-1 animate-pulse"></div>
        <div className="h-4 w-32 bg-slate-700 rounded mt-1 animate-pulse"></div>
      </div>
    );
  }

  const data = timeData;

  return (
    <div className={`rounded-2xl p-6 bg-slate-900 text-white shadow-lg ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Time Tracker</p>
        <div className="flex items-center gap-1">
          {data?.trend === 'up' ? (
            <TrendingUp className="h-3 w-3 text-green-400" />
          ) : (
            <TrendingUp className="h-3 w-3 text-red-400 rotate-180" />
          )}
          <span className={`text-xs ${data?.trend === 'up' ? 'text-green-400' : 'text-red-400'}`}>
            {data?.trend === 'up' ? '+' : ''}{data?.trendPercentage}%
          </span>
        </div>
      </div>
      
      <h3 className="text-2xl font-semibold mt-3">{data?.totalTime || '0m'}</h3>
      <p className="text-sm text-slate-300 mt-1">Active exchange processing</p>
      
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-blue-400" />
          <div>
            <p className="text-xs text-slate-400">Active</p>
            <p className="text-sm font-medium">{data?.activeTickets || 0}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-amber-400" />
          <div>
            <p className="text-xs text-slate-400">Avg/Ticket</p>
            <p className="text-sm font-medium">{data?.avgTimePerTicket || 0}m</p>
          </div>
        </div>
      </div>
      
      <div className="mt-4 pt-4 border-t border-slate-700">
        <div className="flex justify-between items-center">
          <span className="text-xs text-slate-400">Today's tickets</span>
          <span className="text-sm font-medium">{data?.todayTickets || 0}</span>
        </div>
      </div>
    </div>
  );
}
