import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { shopifyService } from '@/services/shopify';
import { DEFAULT_SHIPMENT_SETTINGS, toDateInput, type ShipmentSettings } from '@/lib/shipmentTracking';
import { parseTrackerCsv } from '@/lib/trackerImport';
import type { Shipment, ShipmentStatus, SpecialCase } from '@/types/database';

// The hand-written Database type has no Relationships, so supabase-js types
// writes as `never`; writes go through this untyped handle, as in useTickets.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = (name: 'order_shipments' | 'order_shipment_settings' | 'order_special_cases') => supabase.from(name) as any;

// Fields the hourly Shopify sync refreshes. When someone edits one by hand it
// is recorded in manual_overrides so the next sync leaves it alone.
const SYNC_OWNED_FIELDS = [
  'order_name', 'shipment_ref', 'order_date', 'customer_name', 'customer_phone', 'customer_email',
  'city', 'state', 'pincode', 'delivery_zone', 'courier', 'awb_number', 'tracking_url',
] as const;

const STATUS_RANK: Record<ShipmentStatus, number> = {
  AWAITING_PICKUP: 0,
  PICKED_UP: 1,
  IN_TRANSIT: 2,
  OUT_FOR_DELIVERY: 3,
  DELIVERED: 4,
  RTO: 4,
  CANCELLED: 4,
};

export type ShipmentPatch = Partial<Omit<Shipment, 'id' | 'created_at' | 'updated_at' | 'manual_overrides'>>;

/**
 * Shipments ordered in the last `lookbackDays` days, plus every shipment that
 * is still open (or an unresolved RTO) regardless of age, so an old parcel
 * never drops off the tracker. Refetches whenever a row changes (the courier
 * tracking job, the Shopify sync or a teammate's edit), so statuses update live.
 */
export function useShipments(lookbackDays: number | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    // One tracking run can touch many rows; refetch once they settle.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const channel = supabase
      .channel('order_shipments-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_shipments' }, () => {
        clearTimeout(timer);
        timer = setTimeout(() => queryClient.invalidateQueries({ queryKey: ['shipments'] }), 1000);
      })
      .subscribe();

    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ['shipments', lookbackDays],
    queryFn: async () => {
      let query = supabase.from('order_shipments').select('*').order('order_date', { ascending: false });

      if (lookbackDays !== null) {
        const since = toDateInput(subDays(new Date(), lookbackDays));
        query = query.or(
          `order_date.gte.${since},status.not.in.(DELIVERED,CANCELLED,RTO),and(status.eq.RTO,resolved_on.is.null)`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Shipment[];
    },
  });
}

export function useShipmentSettings() {
  return useQuery({
    queryKey: ['shipment-settings'],
    queryFn: async (): Promise<ShipmentSettings> => {
      const { data, error } = await supabase.from('order_shipment_settings').select('*').eq('id', 1).maybeSingle();
      if (error) throw error;
      return { ...DEFAULT_SHIPMENT_SETTINGS, ...(data || {}) };
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateShipmentSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settings: ShipmentSettings) => {
      const { error } = await table('order_shipment_settings').upsert({ id: 1, ...settings });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipment-settings'] });
      // A new NCR list re-derives zones server-side.
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
    },
  });
}

export function useSyncShipments() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (lookbackDays?: number) => shopifyService.syncShipments(lookbackDays),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shipments'] }),
  });
}

export function useUpdateShipment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ shipment, patch }: { shipment: Shipment; patch: ShipmentPatch }) => {
      const edited = SYNC_OWNED_FIELDS.filter(
        (field) => field in patch && patch[field] !== shipment[field]
      );
      const manual_overrides = Array.from(new Set([...shipment.manual_overrides, ...edited]));

      const { error } = await table('order_shipments')
        .update({ ...patch, manual_overrides })
        .eq('id', shipment.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shipments'] }),
  });
}

export function useCreateShipment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: ShipmentPatch & Pick<Shipment, 'order_name' | 'order_date'>) => {
      const { error } = await table('order_shipments').insert({
        ...values,
        source: 'MANUAL',
        shipment_ref: values.shipment_ref || values.order_name,
        // A zone picked by hand on a manual row should stick.
        manual_overrides: values.delivery_zone ? ['delivery_zone'] : [],
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shipments'] }),
  });
}

export function useDeleteShipment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await table('order_shipments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shipments'] }),
  });
}

// Special cases log: open first, then most recently updated.
export function useSpecialCases() {
  return useQuery({
    queryKey: ['special-cases'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_special_cases')
        .select('*')
        .order('status', { ascending: true })
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data || []) as SpecialCase[];
    },
  });
}

export type SpecialCaseValues = Omit<SpecialCase, 'id' | 'created_at' | 'updated_at'>;

export function useSaveSpecialCase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: SpecialCaseValues }) => {
      const { error } = id
        ? await table('order_special_cases').update(values).eq('id', id)
        : await table('order_special_cases').insert(values);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['special-cases'] }),
  });
}

export function useDeleteSpecialCase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await table('order_special_cases').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['special-cases'] }),
  });
}

export interface ImportResult {
  rows: number;
  matched: number;
  created: number;
}

/**
 * Bring the old Google Sheet's history in. Optionally pulls `backfillDays` of
 * Shopify orders first so most sheet rows land on their synced shipment; the
 * sheet only fills what Shopify doesn't know (dates, notified flags, notes)
 * and never moves a status backwards. Rows with no Shopify match are added as
 * manual shipments, which the sync adopts later by order name.
 */
export function useImportTracker() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ csv, backfillDays }: { csv: string; backfillDays: number | null }): Promise<ImportResult> => {
      const sheetRows = parseTrackerCsv(csv);
      if (sheetRows.length === 0) throw new Error('No orders found in this file.');

      if (backfillDays) await shopifyService.syncShipments(backfillDays);

      const { data, error } = await supabase.from('order_shipments').select('*');
      if (error) throw error;
      const shipments = (data || []) as Shipment[];

      const claimed = new Set<string>();
      const find = (ref: string, orderName: string) => {
        const match =
          shipments.find((s) => !claimed.has(s.id) && s.shipment_ref === ref) ??
          shipments.find((s) => !claimed.has(s.id) && (s.order_name === ref || s.order_name === orderName));
        if (match) claimed.add(match.id);
        return match;
      };

      const inserts: Record<string, unknown>[] = [];
      const updates: { id: string; patch: Record<string, unknown> }[] = [];
      let matched = 0;

      for (const row of sheetRows) {
        const existing = find(row.shipment_ref, row.order_name);

        if (!existing) {
          if (!row.order_date) continue;
          inserts.push({
            source: 'MANUAL',
            order_name: row.order_name,
            shipment_ref: row.shipment_ref,
            order_date: row.order_date,
            customer_name: row.customer_name,
            customer_phone: row.customer_phone,
            customer_email: row.customer_email,
            city: row.city,
            courier: row.courier,
            awb_number: row.awb_number,
            status: row.status ?? (row.pickup_date ? 'PICKED_UP' : 'AWAITING_PICKUP'),
            pickup_date: row.pickup_date,
            delivered_date: row.status === 'DELIVERED' ? row.delivered_date : null,
            customer_notified: row.customer_notified,
            notified_on: row.customer_notified ? row.notified_on : null,
            notes: row.notes,
          });
          continue;
        }

        matched++;
        const patch: Record<string, unknown> = {};
        if (row.status && STATUS_RANK[row.status] > STATUS_RANK[existing.status]) patch.status = row.status;
        if (!existing.pickup_date && row.pickup_date) patch.pickup_date = row.pickup_date;
        if (!existing.delivered_date && row.delivered_date && (patch.status ?? existing.status) === 'DELIVERED') {
          patch.delivered_date = row.delivered_date;
        }
        if (!existing.courier && row.courier) patch.courier = row.courier;
        if (!existing.awb_number && row.awb_number) patch.awb_number = row.awb_number;
        if (!existing.customer_phone && row.customer_phone) patch.customer_phone = row.customer_phone;
        if (row.customer_notified && !existing.customer_notified) {
          patch.customer_notified = true;
          patch.notified_on = row.notified_on;
        }
        if (row.notes && !(existing.notes ?? '').includes(row.notes)) {
          patch.notes = existing.notes ? `${existing.notes}\n${row.notes}` : row.notes;
        }
        if (Object.keys(patch).length) updates.push({ id: existing.id, patch });
      }

      if (inserts.length) {
        const { error: insertError } = await table('order_shipments').insert(inserts);
        if (insertError) throw insertError;
      }
      for (const { id, patch } of updates) {
        const { error: updateError } = await table('order_shipments').update(patch).eq('id', id);
        if (updateError) throw updateError;
      }

      return { rows: sheetRows.length, matched, created: inserts.length };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shipments'] }),
  });
}
