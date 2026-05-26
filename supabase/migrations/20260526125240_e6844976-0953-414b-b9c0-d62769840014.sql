ALTER TABLE public.irpf_cases
  ADD COLUMN IF NOT EXISTS notes_alert boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notes_alert_at timestamptz,
  ADD COLUMN IF NOT EXISTS notes_alert_by text;

CREATE INDEX IF NOT EXISTS idx_irpf_cases_notes_alert ON public.irpf_cases (notes_alert) WHERE notes_alert = true;