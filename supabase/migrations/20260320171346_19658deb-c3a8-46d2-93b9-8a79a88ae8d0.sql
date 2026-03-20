
CREATE TABLE public.case_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.irpf_cases(id) ON DELETE CASCADE,
  sender text NOT NULL DEFAULT 'office',
  message text NOT NULL,
  visible_to_client boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.case_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth can manage case_messages" ON public.case_messages FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anon can view visible messages" ON public.case_messages FOR SELECT TO anon USING (visible_to_client = true);
CREATE POLICY "Anon can insert messages" ON public.case_messages FOR INSERT TO anon WITH CHECK (true);
