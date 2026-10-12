import { Badge, type BadgeProps } from '@/components/ui/badge';
import { DELIVERY_CHECK_LABELS, type DeliveryCheck } from '@/lib/shipmentTracking';

const CHECK_VARIANTS: Record<DeliveryCheck, BadgeProps['variant']> = {
  AWAITING_PICKUP: 'secondary',
  PICKUP_DELAYED: 'destructive',
  ON_TRACK: 'info',
  DELAYED_NOTIFY: 'destructive',
  DELAYED_NOTIFIED: 'warning',
  ESCALATED: 'escalated',
  DELIVERED_ON_TIME: 'success',
  DELIVERED_LATE: 'warning',
  RTO: 'denied',
  CANCELLED: 'closed',
};

export function DeliveryCheckBadge({ check }: { check: DeliveryCheck }) {
  return (
    <Badge variant={CHECK_VARIANTS[check]} className="whitespace-nowrap">
      {DELIVERY_CHECK_LABELS[check]}
    </Badge>
  );
}
