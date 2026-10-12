import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDay, statusOptions, toDateInput, trackShipment, type ShipmentSettings } from '@/lib/shipmentTracking';
import type { ShipmentPatch } from '@/hooks/useShipments';
import {
  AGGREGATOR_LABELS,
  DELIVERY_ZONE_LABELS,
  NOTIFICATION_CHANNEL_LABELS,
  type DeliveryZone,
  type NotificationChannel,
  type Shipment,
  type ShipmentStatus,
} from '@/types/database';

type FormValues = {
  order_name: string;
  order_date: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  city: string;
  state: string;
  pincode: string;
  delivery_zone: DeliveryZone | 'AUTO';
  courier: string;
  awb_number: string;
  tracking_url: string;
  status: ShipmentStatus;
  pickup_date: string;
  expected_delivery_date: string;
  delivered_date: string;
  customer_notified: boolean;
  notified_on: string;
  notified_via: NotificationChannel | 'NONE';
  notes: string;
  resolution: string;
  resolved_on: string;
};

const today = () => toDateInput(new Date());

function initialValues(shipment?: Shipment): FormValues {
  return {
    order_name: shipment?.order_name ?? '',
    order_date: shipment?.order_date ?? today(),
    customer_name: shipment?.customer_name ?? '',
    customer_phone: shipment?.customer_phone ?? '',
    customer_email: shipment?.customer_email ?? '',
    city: shipment?.city ?? '',
    state: shipment?.state ?? '',
    pincode: shipment?.pincode ?? '',
    delivery_zone: shipment?.delivery_zone ?? 'AUTO',
    courier: shipment?.courier ?? '',
    awb_number: shipment?.awb_number ?? '',
    tracking_url: shipment?.tracking_url ?? '',
    status: shipment?.status ?? 'AWAITING_PICKUP',
    pickup_date: shipment?.pickup_date ?? '',
    expected_delivery_date: shipment?.expected_delivery_date ?? '',
    delivered_date: shipment?.delivered_date ?? '',
    customer_notified: shipment?.customer_notified ?? false,
    notified_on: shipment?.notified_on ?? '',
    notified_via: shipment?.notified_via ?? 'NONE',
    notes: shipment?.notes ?? '',
    resolution: shipment?.resolution ?? '',
    resolved_on: shipment?.resolved_on ?? '',
  };
}

// Where the courier status came from: the aggregator once it has the AWB,
// otherwise Shopify.
function courierHint(shipment?: Shipment): string | undefined {
  if (!shipment) return undefined;
  if (shipment.aggregator && shipment.courier_status) {
    return `${AGGREGATOR_LABELS[shipment.aggregator]} status: ${shipment.courier_status}`;
  }
  if (shipment.tracking_error) return `Courier tracking: ${shipment.tracking_error}`;
  if (shipment.courier_status) return `Shopify carrier status: ${shipment.courier_status.replace(/_/g, ' ')}`;
  return undefined;
}

const orNull = (value: string) => (value.trim() === '' ? null : value.trim());

function toPatch(values: FormValues, shipment?: Shipment): ShipmentPatch {
  const patch: ShipmentPatch = {
    order_name: values.order_name.trim(),
    order_date: values.order_date,
    customer_name: orNull(values.customer_name),
    customer_phone: orNull(values.customer_phone),
    customer_email: orNull(values.customer_email),
    city: orNull(values.city),
    state: orNull(values.state),
    pincode: orNull(values.pincode),
    courier: orNull(values.courier),
    awb_number: orNull(values.awb_number),
    tracking_url: orNull(values.tracking_url),
    status: values.status,
    pickup_date: orNull(values.pickup_date),
    expected_delivery_date: orNull(values.expected_delivery_date),
    delivered_date: values.status === 'DELIVERED' ? orNull(values.delivered_date) : null,
    customer_notified: values.customer_notified,
    notified_on: values.customer_notified ? orNull(values.notified_on) : null,
    notified_via: values.customer_notified && values.notified_via !== 'NONE' ? values.notified_via : null,
    notes: orNull(values.notes),
    resolution: orNull(values.resolution),
    resolved_on: orNull(values.resolved_on),
  };
  // Only send the zone when it was picked by hand, so the table trigger keeps
  // deriving it from the city otherwise.
  if (values.delivery_zone !== 'AUTO' && values.delivery_zone !== shipment?.delivery_zone) {
    patch.delivery_zone = values.delivery_zone;
  }
  return patch;
}

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function ShipmentForm({
  shipment,
  settings,
  onSubmit,
  submitting,
  submitLabel,
  onDelete,
}: {
  shipment?: Shipment;
  settings: ShipmentSettings;
  onSubmit: (patch: ShipmentPatch) => void;
  submitting: boolean;
  submitLabel: string;
  onDelete?: () => void;
}) {
  const [values, setValues] = useState<FormValues>(() => initialValues(shipment));
  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const fromShopify = shipment?.source === 'SHOPIFY';
  const zoneLocked = shipment?.manual_overrides.includes('delivery_zone');
  const isSpecialCase = values.status === 'RTO' || !!values.resolution || !!values.resolved_on;

  // A new shipment's ref is the order no. typed in (e.g. K-2627-3232-R1).
  const shipmentRef = shipment?.shipment_ref ?? values.order_name;

  // Preview the deadline the tracker will use when no courier date is set.
  const ruleDate = values.order_date
    ? trackShipment(
        {
          shipment_ref: shipmentRef,
          order_date: values.order_date,
          raised_date: shipment?.raised_date ?? null,
          pickup_date: orNull(values.pickup_date),
          expected_delivery_date: null,
          delivered_date: null,
          status: values.status,
          delivery_zone: values.delivery_zone === 'AUTO' ? shipment?.delivery_zone ?? 'OUTSIDE_NCR' : values.delivery_zone,
          customer_notified: false,
        },
        settings
      ).expectedDelivery
    : null;

  const handleStatusChange = (status: ShipmentStatus) => {
    setValues((prev) => ({
      ...prev,
      status,
      pickup_date:
        status === 'AWAITING_PICKUP' ? '' : status !== 'CANCELLED' && !prev.pickup_date ? today() : prev.pickup_date,
      delivered_date: status === 'DELIVERED' && !prev.delivered_date ? today() : prev.delivered_date,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(toPatch(values, shipment));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Shipment</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Status" htmlFor="shipment-status" hint={courierHint(shipment)}>
            <Select value={values.status} onValueChange={(v) => handleStatusChange(v as ShipmentStatus)}>
              <SelectTrigger id="shipment-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                {statusOptions(shipmentRef).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Courier" htmlFor="shipment-courier">
            <Input id="shipment-courier" value={values.courier} onChange={(e) => set('courier', e.target.value)} placeholder="e.g. Amazon" />
          </Field>
          <Field label="AWB No." htmlFor="shipment-awb">
            <Input id="shipment-awb" value={values.awb_number} onChange={(e) => set('awb_number', e.target.value)} />
          </Field>
          <Field label="Tracking link" htmlFor="shipment-tracking-url">
            <Input id="shipment-tracking-url" type="url" value={values.tracking_url} onChange={(e) => set('tracking_url', e.target.value)} placeholder="https://" />
          </Field>
          <Field label="Pickup date" htmlFor="shipment-pickup">
            <Input id="shipment-pickup" type="date" value={values.pickup_date} onChange={(e) => set('pickup_date', e.target.value)} />
          </Field>
          <Field
            label="Expected delivery"
            htmlFor="shipment-expected"
            hint={
              values.expected_delivery_date
                ? 'Courier date — replaces the deadline rule'
                : ruleDate
                  ? `Blank = deadline rule (${formatDay(ruleDate, 'dd MMM yyyy')})`
                  : 'Blank = deadline rule, once picked up'
            }
          >
            <Input id="shipment-expected" type="date" value={values.expected_delivery_date} onChange={(e) => set('expected_delivery_date', e.target.value)} />
          </Field>
          {values.status === 'DELIVERED' && (
            <Field label="Delivered date" htmlFor="shipment-delivered">
              <Input id="shipment-delivered" type="date" required value={values.delivered_date} onChange={(e) => set('delivered_date', e.target.value)} />
            </Field>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Customer notification</h3>
        <label htmlFor="shipment-notified" className="flex items-center gap-2 text-sm">
          <Checkbox
            id="shipment-notified"
            checked={values.customer_notified}
            onCheckedChange={(checked) => {
              const on = checked === true;
              setValues((prev) => ({ ...prev, customer_notified: on, notified_on: on && !prev.notified_on ? today() : prev.notified_on }));
            }}
          />
          Customer has been informed about the delay
        </label>
        {values.customer_notified && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Notified on" htmlFor="shipment-notified-on">
              <Input id="shipment-notified-on" type="date" value={values.notified_on} onChange={(e) => set('notified_on', e.target.value)} />
            </Field>
            <Field label="Notified via" htmlFor="shipment-notified-via">
              <Select value={values.notified_via} onValueChange={(v) => set('notified_via', v as FormValues['notified_via'])}>
                <SelectTrigger id="shipment-notified-via"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Not recorded</SelectItem>
                  {Object.entries(NOTIFICATION_CHANNEL_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        )}
        <Field label="Notes" htmlFor="shipment-notes">
          <Textarea id="shipment-notes" rows={2} value={values.notes} onChange={(e) => set('notes', e.target.value)} placeholder="e.g. Customer asked to deliver after 5 pm" />
        </Field>
      </section>

      {isSpecialCase && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">RTO / special case</h3>
          <p className="text-xs text-muted-foreground">Stays under Special cases until a resolved date is set.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Resolution" htmlFor="shipment-resolution">
              <Input id="shipment-resolution" value={values.resolution} onChange={(e) => set('resolution', e.target.value)} placeholder="e.g. Re-shipped, refunded" />
            </Field>
            <Field label="Resolved on" htmlFor="shipment-resolved-on">
              <Input id="shipment-resolved-on" type="date" value={values.resolved_on} onChange={(e) => set('resolved_on', e.target.value)} />
            </Field>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Order &amp; customer</h3>
        {fromShopify && (
          <p className="text-xs text-muted-foreground">
            Synced from Shopify. A field you change here stops being updated by the sync.
          </p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Order No." htmlFor="shipment-order">
            <Input id="shipment-order" required value={values.order_name} onChange={(e) => set('order_name', e.target.value)} placeholder="K-2627-3254" />
          </Field>
          <Field label="Order date" htmlFor="shipment-order-date">
            <Input id="shipment-order-date" type="date" required value={values.order_date} onChange={(e) => set('order_date', e.target.value)} />
          </Field>
          <Field label="Customer name" htmlFor="shipment-customer">
            <Input id="shipment-customer" value={values.customer_name} onChange={(e) => set('customer_name', e.target.value)} />
          </Field>
          <Field label="Phone" htmlFor="shipment-phone">
            <Input id="shipment-phone" type="tel" value={values.customer_phone} onChange={(e) => set('customer_phone', e.target.value)} />
          </Field>
          <Field label="Email" htmlFor="shipment-email">
            <Input id="shipment-email" type="email" value={values.customer_email} onChange={(e) => set('customer_email', e.target.value)} />
          </Field>
          <Field label="City" htmlFor="shipment-city">
            <Input id="shipment-city" value={values.city} onChange={(e) => set('city', e.target.value)} />
          </Field>
          <Field label="State" htmlFor="shipment-state">
            <Input id="shipment-state" value={values.state} onChange={(e) => set('state', e.target.value)} />
          </Field>
          <Field label="PIN code" htmlFor="shipment-pincode">
            <Input id="shipment-pincode" inputMode="numeric" value={values.pincode} onChange={(e) => set('pincode', e.target.value)} />
          </Field>
          <Field
            label="Delivery zone"
            htmlFor="shipment-zone"
            hint={shipment && !zoneLocked ? 'Set automatically from city / PIN code' : undefined}
          >
            <Select value={values.delivery_zone} onValueChange={(v) => set('delivery_zone', v as FormValues['delivery_zone'])}>
              <SelectTrigger id="shipment-zone"><SelectValue /></SelectTrigger>
              <SelectContent>
                {!shipment && <SelectItem value="AUTO">Auto (from city / PIN)</SelectItem>}
                {Object.entries(DELIVERY_ZONE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </section>

      <div className="flex items-center justify-between gap-3 pt-2 border-t">
        <div className="text-xs text-muted-foreground">
          {shipment?.last_synced_at && `Last synced ${format(parseISO(shipment.last_synced_at), 'd MMM, h:mm a')}`}
        </div>
        <div className="flex gap-2">
          {onDelete && (
            <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={onDelete} disabled={submitting}>
              Delete
            </Button>
          )}
          <Button type="submit" disabled={submitting}>{submitting ? 'Saving…' : submitLabel}</Button>
        </div>
      </div>
    </form>
  );
}
