import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  SHIPMENT_KIND_LABELS,
  formatDay,
  shipmentKind,
  statusOptions,
  toDateInput,
  trackShipment,
  type ShipmentKind,
  type ShipmentSettings,
} from '@/lib/shipmentTracking';
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
  kind: ShipmentKind; // new shipments only; sets the ref's suffix
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
    kind: 'FORWARD',
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

// A new shipment's ref: the order no. with the suffix its type needs
// (-F2 exchange, -R1 return), unless the right one was typed already.
function newShipmentRef(orderNo: string, kind: ShipmentKind): string {
  const typed = orderNo.trim();
  if (shipmentKind(typed) === kind) return typed;
  const base = typed.replace(/-[FR]\d+$/i, '');
  return kind === 'EXCHANGE' ? `${base}-F2` : kind === 'RETURN' ? `${base}-R1` : base;
}

function toPatch(values: FormValues, shipment?: Shipment): ShipmentPatch {
  // Adding: the type decides the ref, and an exchange / return counts its
  // deadlines from today, when it was raised.
  const newRef = shipment ? null : newShipmentRef(values.order_name, values.kind);
  const patch: ShipmentPatch = {
    ...(newRef && {
      shipment_ref: newRef,
      raised_date: values.kind === 'FORWARD' ? null : today(),
    }),
    order_name: newRef ? newRef.replace(/-[FR]\d+$/i, '') : values.order_name.trim(),
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
      <Label htmlFor={htmlFor} className="text-[13px] font-medium text-foreground">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 border-t border-border pt-6 first:border-t-0 first:pt-0">
      <div className="space-y-0.5">
        <h3 className="font-heading text-sm font-semibold text-foreground">{title}</h3>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
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

  const shipmentRef = shipment?.shipment_ref ?? newShipmentRef(values.order_name, values.kind);

  // Preview the deadline the tracker will use when no courier date is set.
  const ruleDate = values.order_date
    ? trackShipment(
        {
          shipment_ref: shipmentRef,
          order_date: values.order_date,
          raised_date: shipment ? shipment.raised_date : values.kind === 'FORWARD' ? null : today(),
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
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
        <Section title="Shipment" description={courierHint(shipment)}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Status" htmlFor="shipment-status">
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
              <Input id="shipment-courier" value={values.courier} onChange={(e) => set('courier', e.target.value)} placeholder="e.g. Delhivery" />
            </Field>
            <Field label="AWB no." htmlFor="shipment-awb">
              <Input id="shipment-awb" value={values.awb_number} onChange={(e) => set('awb_number', e.target.value)} />
            </Field>
            <Field label="Tracking link" htmlFor="shipment-tracking-url">
              <Input id="shipment-tracking-url" type="url" value={values.tracking_url} onChange={(e) => set('tracking_url', e.target.value)} placeholder="https://" />
            </Field>
            <Field label="Pickup date" htmlFor="shipment-pickup">
              <DatePicker id="shipment-pickup" value={values.pickup_date} onChange={(v) => set('pickup_date', v)} />
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
              <DatePicker id="shipment-expected" value={values.expected_delivery_date} onChange={(v) => set('expected_delivery_date', v)} />
            </Field>
            {values.status === 'DELIVERED' && (
              <Field label="Delivered date" htmlFor="shipment-delivered">
                <DatePicker id="shipment-delivered" required value={values.delivered_date} onChange={(v) => set('delivered_date', v)} />
              </Field>
            )}
          </div>
        </Section>

        <Section title="Customer notification">
          <label
            htmlFor="shipment-notified"
            className="flex min-h-9 cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          >
            <Checkbox
              id="shipment-notified"
              checked={values.customer_notified}
              onCheckedChange={(checked) => {
                const on = checked === true;
                setValues((prev) => ({ ...prev, customer_notified: on, notified_on: on && !prev.notified_on ? today() : prev.notified_on }));
              }}
            />
            Customer has been told about the delay
          </label>
          {values.customer_notified && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 animate-fade-in">
              <Field label="Notified on" htmlFor="shipment-notified-on">
                <DatePicker id="shipment-notified-on" value={values.notified_on} onChange={(v) => set('notified_on', v)} />
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
        </Section>

        {isSpecialCase && (
          <Section title="RTO / special case" description="Stays open as a case until a resolved date is set.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Resolution" htmlFor="shipment-resolution">
                <Input id="shipment-resolution" value={values.resolution} onChange={(e) => set('resolution', e.target.value)} placeholder="e.g. Re-shipped, refunded" />
              </Field>
              <Field label="Resolved on" htmlFor="shipment-resolved-on">
                <DatePicker id="shipment-resolved-on" value={values.resolved_on} onChange={(v) => set('resolved_on', v)} />
              </Field>
            </div>
          </Section>
        )}

        <Section
          title="Order & customer"
          description={fromShopify ? 'Synced from Shopify. A field you change here stops being updated by the sync.' : undefined}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {!shipment && (
              <Field label="Type" htmlFor="shipment-kind">
                <Select value={values.kind} onValueChange={(v) => set('kind', v as ShipmentKind)}>
                  <SelectTrigger id="shipment-kind"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(SHIPMENT_KIND_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            <Field
              label="Order no."
              htmlFor="shipment-order"
              hint={!shipment && values.kind !== 'FORWARD' && values.order_name.trim() ? `Saved as ${shipmentRef}` : undefined}
            >
              <Input id="shipment-order" required value={values.order_name} onChange={(e) => set('order_name', e.target.value)} placeholder="K-2627-3254" />
            </Field>
            <Field label="Order date" htmlFor="shipment-order-date">
              <DatePicker id="shipment-order-date" required value={values.order_date} onChange={(v) => set('order_date', v)} />
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
        </Section>
      </div>

      {/* Sticky footer */}
      <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-border bg-card px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
        <p className="min-w-0 truncate text-xs text-muted-foreground">
          {shipment?.last_synced_at && `Last synced ${format(parseISO(shipment.last_synced_at), 'd MMM, h:mm a')}`}
        </p>
        <div className="flex shrink-0 gap-2">
          {onDelete && (
            <Button type="button" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={onDelete} disabled={submitting}>
              Delete
            </Button>
          )}
          <Button type="submit" disabled={submitting}>{submitting ? 'Saving…' : submitLabel}</Button>
        </div>
      </div>
    </form>
  );
}
