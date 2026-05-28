ALTER TABLE public.final_deliverables
  ADD COLUMN IF NOT EXISTS preview_approved_by_internal boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS preview_approved_by_name text;