-- Add payment type and quota count to final_deliverables
ALTER TABLE public.final_deliverables
  ADD COLUMN IF NOT EXISTS guide_payment_type text CHECK (guide_payment_type IN ('cota_unica','cotas')),
  ADD COLUMN IF NOT EXISTS guide_quota_count integer;

-- Create payment_quotas table to track each quota (DARF) file and delivery
CREATE TABLE IF NOT EXISTS public.payment_quotas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL,
  quota_number integer NOT NULL,
  due_date date,
  file_url text,
  file_name text,
  sent_to_client boolean NOT NULL DEFAULT false,
  sent_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_id, quota_number)
);

CREATE INDEX IF NOT EXISTS idx_payment_quotas_case ON public.payment_quotas(case_id);

ALTER TABLE public.payment_quotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth can manage payment_quotas"
  ON public.payment_quotas FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Anon can view payment_quotas"
  ON public.payment_quotas FOR SELECT
  TO anon USING (true);

CREATE TRIGGER trg_payment_quotas_updated_at
  BEFORE UPDATE ON public.payment_quotas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();