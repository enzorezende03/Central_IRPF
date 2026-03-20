
CREATE TABLE public.internal_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.irpf_cases(id) ON DELETE CASCADE,
  label text NOT NULL,
  checked boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.internal_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth can manage internal_checklist" ON public.internal_checklist
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
