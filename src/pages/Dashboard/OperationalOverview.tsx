import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, ComposedChart, Area } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, startOfDay } from 'date-fns';

interface ChartData {
  date: string;
  created: number;
  completed: number;
  pending: number;
}

interface OperationalOverviewProps {
  className?: string;
}

export function OperationalOverview({ className }: OperationalOverviewProps) {
  const { data: chartData, isLoading } = useQuery({
    queryKey: ['operational-overview'],
    queryFn: async (): Promise<ChartData[]> => {
      const endDate = startOfDay(new Date());
      const startDate = subDays(endDate, 6); // Last 7 days
      
      const { data, error } = await supabase
        .from('tickets')
        .select('created_at, status, stage')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;

      const tickets = data as Array<{
        created_at: string;
        status: string;
        stage: string;
      }>;

      // Process data for each day
      const dailyData: ChartData[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = subDays(endDate, i);
        const dateStr = format(date, 'MMM dd');
        
        const dayTickets = tickets?.filter(ticket => 
          startOfDay(new Date(ticket.created_at)).getTime() === date.getTime()
        ) || [];

        const created = dayTickets.length;
        const completed = dayTickets.filter(t => t.status === 'COMPLETED').length;
        const pending = dayTickets.filter(t => !['CLOSED', 'INVOICED'].includes(t.stage)).length;

        dailyData.push({
          date: dateStr,
          created,
          completed,
          pending
        });
      }

      return dailyData;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <div className="h-56 rounded-2xl bg-gradient-to-br from-blue-50 via-white to-blue-100/70 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className={`h-56 ${className}`}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
          <defs>
            <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.3}/>
            </linearGradient>
            <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.3}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 12, fill: '#6b7280' }}
            axisLine={{ stroke: '#e5e7eb' }}
          />
          <YAxis 
            tick={{ fontSize: 12, fill: '#6b7280' }}
            axisLine={{ stroke: '#e5e7eb' }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'white', 
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '12px'
            }}
            labelStyle={{ fontWeight: 600, marginBottom: '4px' }}
          />
          <Area
            type="monotone"
            dataKey="created"
            stroke="#3b82f6"
            fillOpacity={1}
            fill="url(#colorCreated)"
            strokeWidth={2}
            name="Created"
          />
          <Bar
            dataKey="completed"
            fill="#10b981"
            radius={[4, 4, 0, 0]}
            name="Completed"
          />
          <Line
            type="monotone"
            dataKey="pending"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={{ fill: '#f59e0b', r: 3 }}
            name="Pending"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
