import { ToneBadge } from '@/components/app';
import { DELIVERY_CHECK_LABELS, type DeliveryCheck } from '@/lib/shipmentTracking';
import { CHECK_META } from './constants';

export function DeliveryCheckBadge({ check, className }: { check: DeliveryCheck; className?: string }) {
  const meta = CHECK_META[check];
  return (
    <span title={DELIVERY_CHECK_LABELS[check]} className="inline-flex">
      <ToneBadge tone={meta.tone} className={className}>{meta.short}</ToneBadge>
    </span>
  );
}
