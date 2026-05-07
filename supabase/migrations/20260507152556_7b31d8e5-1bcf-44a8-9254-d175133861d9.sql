
ALTER TABLE public.irpf_cases
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid,
  ADD COLUMN IF NOT EXISTS deleted_by_name text;

CREATE INDEX IF NOT EXISTS idx_irpf_cases_deleted_at ON public.irpf_cases(deleted_at);
