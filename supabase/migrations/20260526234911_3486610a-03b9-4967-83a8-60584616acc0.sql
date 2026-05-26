ALTER TABLE public.irpf_cases
  ADD COLUMN IF NOT EXISTS notes_alert_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS notes_alert_seen_by text;