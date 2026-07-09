import { Line, LineChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, type TooltipProps } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, startOfDay } from 'date-fns';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

const PERIOD_DAYS = 14;

interface DayPoint {
  dayIndex: number;
  currentDate: string;
  currentLabel: string;
  currentValue: number;
  previousDate: string;
  previousLabel: string;
  previousValue: number;
}

interface OperationalOverviewProps {
  className?: string;
}

function CustomTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload as DayPoint;
  const delta = point.previousValue > 0
    ? Math.round(((point.currentValue - point.previousValue) / point.previousValue) * 100)
    : point.currentValue > 0 ? 100 : 0;
  const isUp = delta >= 0;

  return (
    <div className="bg-white rounded-xl border border-border shadow-lg p-3 text-xs min-w-[170px]">
      <p className="font-semibold text-foreground mb-2">Tickets Lodged</p>
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
        <span className="text-muted-foreground">{point.currentLabel}</span>
      </div>
      <p className="font-heading text-base font-semibold text-foreground mt-0.5">
        {point.currentValue}
        <span className={`ml-1.5 text-[11px] font-medium ${isUp ? 'text-success' : 'text-destructive'}`}>
          {isUp ? '+' : ''}{delta}% <span className="text-muted-foreground font-normal">from comparison</span>
        </span>
      </p>
      <div className="flex items-center gap-1.5 mt-2">
        <span className="h-2 w-2 rounded-full bg-muted-foreground/30 shrink-0" />
        <span className="text-muted-foreground">{point.previousLabel}</span>
      </div>
      <p className="text-sm text-muted-foreground mt-0.5">{point.previousValue}</p>
    </div>
  );
}

export function OperationalOverview({ className }: OperationalOverviewProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['operational-overview'],
    queryFn: async (): Promise<DayPoint[]> => {
      const today = startOfDay(new Date());
      const currentStart = subDays(today, PERIOD_DAYS - 1);
      const previousStart = subDays(currentStart, PERIOD_DAYS);

      const { data: rows, error } = await supabase
        .from('tickets')
        .select('created_at')
        .gte('created_at', previousStart.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;
      const tickets = (rows ?? []) as Array<{ created_at: string }>;

      const countOnDay = (day: Date) =>
        tickets.filter((t) => startOfDay(new Date(t.created_at)).getTime() === day.getTime()).length;

      const points: DayPoint[] = [];
      for (let i = 0; i < PERIOD_DAYS; i++) {
        const currentDay = subDays(today, PERIOD_DAYS - 1 - i);
        const previousDay = subDays(currentDay, PERIOD_DAYS);
        points.push({
          dayIndex: i,
          currentDate: format(currentDay, 'MMM d'),
          currentLabel: format(currentDay, 'MMM d, yyyy'),
          currentValue: countOnDay(currentDay),
          previousDate: format(previousDay, 'MMM d'),
          previousLabel: format(previousDay, 'MMM d, yyyy'),
          previousValue: countOnDay(previousDay),
        });
      }
      return points;
    },
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });

  const currentTotal = (data ?? []).reduce((sum, p) => sum + p.currentValue, 0);
  const previousTotal = (data ?? []).reduce((sum, p) => sum + p.previousValue, 0);
  const totalDelta = previousTotal > 0
    ? Math.round(((currentTotal - previousTotal) / previousTotal) * 100)
    : currentTotal > 0 ? 100 : 0;
  const isUp = totalDelta >= 0;

  const today = startOfDay(new Date());
  const currentStart = subDays(today, PERIOD_DAYS - 1);
  const previousStart = subDays(currentStart, PERIOD_DAYS);
  const previousEnd = subDays(currentStart, 1);
  const currentRangeLabel = `${format(currentStart, 'MMM d')} – ${format(today, 'MMM d, yyyy')}`;
  const previousRangeLabel = `${format(previousStart, 'MMM d')} – ${format(previousEnd, 'MMM d, yyyy')}`;

  if (isLoading) {
    return (
      <div className={`h-64 rounded-xl bg-muted/40 flex items-center justify-center ${className ?? ''}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="mb-4">
        <p className="text-xs text-muted-foreground">Tickets lodged over time</p>
        <div className="flex items-baseline gap-2 mt-1">
          <span className="font-heading text-2xl font-semibold text-foreground tracking-tight">{currentTotal}</span>
          <span className={`inline-flex items-center text-xs font-medium ${isUp ? 'text-success' : 'text-destructive'}`}>
            {isUp ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
            {isUp ? '+' : ''}{totalDelta}%
          </span>
        </div>
      </div>

      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis
              dataKey="currentDate"
              tick={{ fontSize: 12, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 12, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              width={28}
              allowDecimals={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#cbd5e1', strokeDasharray: '3 3' }} />
            <Line
              type="monotone"
              dataKey="previousValue"
              stroke="#cbd5e1"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={false}
              activeDot={false}
              name="Previous period"
            />
            <Line
              type="monotone"
              dataKey="currentValue"
              stroke="rgb(var(--primary))"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4, fill: 'rgb(var(--primary))', stroke: '#fff', strokeWidth: 2 }}
              name="Current period"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-center gap-6 mt-2">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-primary" />
          <span className="text-xs text-muted-foreground">{currentRangeLabel}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
          <span className="text-xs text-muted-foreground">{previousRangeLabel}</span>
        </div>
      </div>
    </div>
  );
}
