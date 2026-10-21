import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { AppSettings, CaseUpdate, Profile } from '@/types/database';

/** Defaults used until the app_settings rows exist (or if a key is missing). */
export const DEFAULT_SETTINGS: AppSettings = {
  exchange_policy: { window_days: 10, max_per_order: 2, block_final_sale: true, final_sale_tag: 'final-sale', allow_different_product: true },
  fees: { delivery_charge: 150, free_reasons: ['DEFECTIVE', 'WRONG_ITEM'], payment_provider: 'RAZORPAY' },
  qc_checklist: { items: ['Tags attached', 'Unworn & unwashed', 'No stains, tears or damage', 'Correct item and size returned'] },
};

// The new tables are not in the generated Supabase types yet.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as { from: (t: string) => any; storage: typeof supabase.storage };

export function useAppSettings() {
  return useQuery({
    queryKey: ['app-settings'],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<AppSettings> => {
      const { data, error } = await db.from('app_settings').select('key, value');
      if (error) return DEFAULT_SETTINGS; // table not migrated yet → defaults
      const out = structuredClone(DEFAULT_SETTINGS) as unknown as Record<string, unknown>;
      for (const row of (data ?? []) as { key: string; value: Record<string, unknown> }[]) {
        out[row.key] = { ...(out[row.key] as object), ...row.value };
      }
      return out as unknown as AppSettings;
    },
  });
}

export function useSaveSetting() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ key, value }: { key: keyof AppSettings; value: AppSettings[keyof AppSettings] }) => {
      const { error } = await db.from('app_settings').upsert({ key, value, updated_at: new Date().toISOString(), updated_by: user?.id ?? null });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['app-settings'] }),
  });
}

/** Staff directory for assignee / owner pickers. */
export function useStaff() {
  return useQuery({
    queryKey: ['staff'],
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<Pick<Profile, 'id' | 'full_name' | 'email' | 'role'>[]> => {
      const { data, error } = await supabase.from('profiles').select('id, full_name, email, role').order('full_name');
      if (error) throw error;
      return (data ?? []) as Pick<Profile, 'id' | 'full_name' | 'email' | 'role'>[];
    },
  });
}

export function useCaseUpdates(caseId: string | undefined) {
  return useQuery({
    queryKey: ['case-updates', caseId],
    enabled: !!caseId,
    queryFn: async (): Promise<CaseUpdate[]> => {
      const { data, error } = await db.from('case_updates').select('*').eq('case_id', caseId).order('created_at', { ascending: true });
      if (error) return [];
      return (data ?? []) as CaseUpdate[];
    },
  });
}

export function useAddCaseUpdate() {
  const qc = useQueryClient();
  const { user, profile } = useAuth();
  return useMutation({
    mutationFn: async ({ caseId, body }: { caseId: string; body: string }) => {
      const { error } = await db.from('case_updates').insert({
        case_id: caseId,
        body: body.trim(),
        author_id: user?.id ?? null,
        author_name: profile?.full_name ?? profile?.email ?? null,
      });
      if (error) throw error;
      // Keep the case row's summary fields in step so lists stay informative.
      await db.from('order_special_cases').update({ latest_update: body.trim(), updated_by: profile?.full_name ?? null }).eq('id', caseId);
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['case-updates', v.caseId] });
      qc.invalidateQueries({ queryKey: ['special-cases'] });
    },
  });
}

/** Uploads one QC photo to the private bucket and returns its storage path. */
export async function uploadQcPhoto(ticketId: string, file: File): Promise<string> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${ticketId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from('qc-photos').upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}

export function useQcPhotoUrls(paths: string[]) {
  return useQuery({
    queryKey: ['qc-photo-urls', paths],
    enabled: paths.length > 0,
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from('qc-photos').createSignedUrls(paths, 3600);
      if (error) return [];
      return (data ?? []).map((d) => d.signedUrl).filter(Boolean) as string[];
    },
  });
}
