-- Exchange portal revamp, phase 1 (2026-10-21).
-- Additive only: new nullable columns, new tables and a storage bucket. Nothing
-- existing is renamed, dropped or rewritten, so the current app keeps working.

-- ---------------------------------------------------------------------------
-- 1. Tickets: where the request came from, ownership, fee, and QC evidence
-- ---------------------------------------------------------------------------
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS request_source TEXT
    CHECK (request_source IN ('EMAIL', 'WHATSAPP', 'CALL', 'HELPDESK', 'OTHER')),
  ADD COLUMN IF NOT EXISTS request_ref TEXT,
  ADD COLUMN IF NOT EXISTS request_received_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delivery_charge NUMERIC,
  ADD COLUMN IF NOT EXISTS qc_checklist JSONB,
  ADD COLUMN IF NOT EXISTS qc_photos TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON public.tickets (assigned_to);

-- Staff can see each other (names/roles) so tickets and cases can be assigned.
-- Writes stay as before: self-update without role change, admins manage all.
DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()) OR (SELECT private.is_staff()));

-- ---------------------------------------------------------------------------
-- 2. Cases: an owner plus an append-only update thread
-- ---------------------------------------------------------------------------
ALTER TABLE public.order_special_cases
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.profiles (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_order_special_cases_owner_id ON public.order_special_cases (owner_id);

CREATE TABLE IF NOT EXISTS public.case_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.order_special_cases (id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(trim(body)) > 0),
  author_id UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  author_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_case_updates_case_id ON public.case_updates (case_id, created_at);
CREATE INDEX IF NOT EXISTS idx_case_updates_author_id ON public.case_updates (author_id);

ALTER TABLE public.case_updates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.case_updates FROM anon;
GRANT SELECT, INSERT ON public.case_updates TO authenticated;

CREATE POLICY case_updates_staff_read ON public.case_updates
  FOR SELECT TO authenticated USING ((SELECT private.is_staff()));
CREATE POLICY case_updates_staff_insert ON public.case_updates
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.is_staff()) AND author_id = (SELECT auth.uid()));

-- ---------------------------------------------------------------------------
-- 3. App settings: policy, fees and message rules in one place
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_app_settings_updated_by ON public.app_settings (updated_by);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_settings FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.app_settings TO authenticated;

CREATE POLICY app_settings_staff_read ON public.app_settings
  FOR SELECT TO authenticated USING ((SELECT private.is_staff()));
CREATE POLICY app_settings_admin_insert ON public.app_settings
  FOR INSERT TO authenticated WITH CHECK ((SELECT private.is_admin()));
CREATE POLICY app_settings_admin_update ON public.app_settings
  FOR UPDATE TO authenticated
  USING ((SELECT private.is_admin())) WITH CHECK ((SELECT private.is_admin()));

INSERT INTO public.app_settings (key, value) VALUES
  ('exchange_policy', '{"window_days": 10, "max_per_order": 2, "block_final_sale": true, "final_sale_tag": "final-sale", "allow_different_product": true}'),
  ('fees', '{"delivery_charge": 150, "free_reasons": ["DEFECTIVE", "WRONG_ITEM"], "payment_provider": "RAZORPAY"}'),
  ('qc_checklist', '{"items": ["Tags attached", "Unworn & unwashed", "No stains, tears or damage", "Correct item and size returned"]}')
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. QC photos: private bucket, staff only
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('qc-photos', 'qc-photos', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY qc_photos_staff_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'qc-photos' AND (SELECT private.is_staff()));
CREATE POLICY qc_photos_staff_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'qc-photos' AND (SELECT private.is_staff()));
CREATE POLICY qc_photos_staff_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'qc-photos' AND (SELECT private.is_staff()));
