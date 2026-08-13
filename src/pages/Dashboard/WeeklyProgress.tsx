import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfWeek, endOfWeek } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface WeeklyProgressProps {
  className?: string;
}

export function WeeklyProgress({ className }: WeeklyProgressProps) {
  const { data: progressData, isLoading } = useQuery({
    queryKey: ['weekly-progress'],
    queryFn: async () => {
      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 }); // Sunday

      // Get all tickets from this week
      const { data: weeklyTickets, error } = await supabase
        .from('tickets')
        .select('status, created_at, updated_at')
        .gte('created_at', weekStart.toISOString())
        .lte('created_at', weekEnd.toISOString());

      if (error) throw error;

      const tickets = weeklyTickets as Array<{
        status: string;
        created_at: string;
        updated_at: string;
      }>;

      const totalTickets = tickets.length;
      const completedTickets = tickets.filter(t => t.status === 'COMPLETED').length;
      const deniedTickets = tickets.filter(t => t.status === 'DENIED').length;
      const inProgressTickets = tickets.filter(t => t.status === 'IN_PROCESS').length;
      
      // Calculate completion percentage (excluding denied tickets from denominator)
      const eligibleTickets = totalTickets - deniedTickets;
      const completionRate = eligibleTickets > 0 ? Math.round((completedTickets / eligibleTickets) * 100) : 0;

      // Calculate average processing time for completed tickets
      const completedWithTimes = tickets
        .filter(t => t.status === 'COMPLETED')
        .map(t => ({
          created: new Date(t.created_at),
          updated: new Date(t.updated_at)
        }));

      const avgProcessingTime = completedWithTimes.length > 0
        ? completedWithTimes.reduce((acc, t) => 
            acc + (t.updated.getTime() - t.created.getTime()), 0
          ) / completedWithTimes.length / (1000 * 60 * 60) // Convert to hours
        : 0;

      return {
        completionRate,
        totalTickets,
        completedTickets,
        inProgressTickets,
        deniedTickets,
        avgProcessingTime: Math.round(avgProcessingTime * 10) / 10
      };
    },
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });

  if (isLoading) {
    return (
      <Card className={cn('flex items-center justify-between', className)}>
        <CardContent className="p-6 flex items-center justify-between w-full">
          <div>
            <p className="text-sm text-muted-foreground">Progress</p>
            <div className="h-8 w-16 bg-muted rounded mt-2 mb-1"></div>
            <div className="h-3 w-24 bg-muted rounded mt-1"></div>
          </div>
          <div className="h-24 w-24 rounded-full border-8 border-muted animate-pulse"></div>
        </CardContent>
      </Card>
    );
  }

  const completionRate = progressData?.completionRate || 0;
  const avgProcessingTime = progressData?.avgProcessingTime || 0;
  const breakdown = [
    { label: 'Completed', count: progressData?.completedTickets ?? 0, dot: 'bg-success' },
    { label: 'In Progress', count: progressData?.inProgressTickets ?? 0, dot: 'bg-info' },
    { label: 'Denied', count: progressData?.deniedTickets ?? 0, dot: 'bg-destructive' },
  ];

  return (
    <Card className={cn('flex items-center justify-between', className)}>
      <CardContent className="p-6 flex items-center justify-between w-full">
        <div>
          <p className="text-sm text-muted-foreground">Progress</p>
          <h3 className="text-3xl font-semibold mt-2 tabular-nums">{completionRate}%</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Weekly completion • Avg: {avgProcessingTime}h
          </p>
          <div className="mt-3 flex flex-col gap-1.5">
            {breakdown.map(({ label, count, dot }) => (
              <div key={label} className="flex items-center gap-2 text-xs">
                <span className={`h-2 w-2 rounded-full shrink-0 ${dot}`} aria-hidden />
                <span className="text-muted-foreground">{label}</span>
                <span className="ml-auto font-medium tabular-nums">{count}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="relative">
          <div className="h-24 w-24 rounded-full border-8 border-primary/20 flex items-center justify-center">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-semibold text-primary">{completionRate}%</span>
            </div>
          </div>
          {/* Progress ring */}
          <svg className="absolute inset-0 h-24 w-24 -rotate-90">
            <circle
              cx="48"
              cy="48"
              r="36"
              stroke="currentColor"
              strokeWidth="8"
              fill="none"
              className="text-primary/20"
            />
            <circle
              cx="48"
              cy="48"
              r="36"
              stroke="currentColor"
              strokeWidth="8"
              fill="none"
              strokeDasharray={`${2 * Math.PI * 36}`}
              strokeDashoffset={`${2 * Math.PI * 36 * (1 - completionRate / 100)}`}
              className="text-primary transition-all duration-500 ease-out"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </CardContent>
    </Card>
  );
}
