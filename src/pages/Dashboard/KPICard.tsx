import { Card, CardContent } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KPICardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  color: string;
  variant?: 'default' | 'primary';
}

export function KPICard({ title, value, icon: Icon, color, variant = 'default' }: KPICardProps) {
  return (
    <Card
      className={cn(
        'transition-shadow hover:shadow-md',
        variant === 'primary' ? 'border-primary/30 bg-primary/[0.03]' : 'border-border bg-white'
      )}
    >
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted', color)}>
            <Icon className="h-3.5 w-3.5" />
          </span>
        </div>
        <p className="font-heading text-2xl font-semibold tracking-tight mt-3">{value}</p>
      </CardContent>
    </Card>
  );
}
