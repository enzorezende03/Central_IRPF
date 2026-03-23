
-- Template for form questions sent to clients
CREATE TABLE public.form_question_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  answer_type text NOT NULL DEFAULT 'yes_no', -- yes_no, select
  options jsonb DEFAULT '[]'::jsonb, -- for select type: [{label, value}]
  has_conditional boolean NOT NULL DEFAULT false,
  conditional_label text, -- label for the follow-up field when condition is met
  conditional_type text DEFAULT 'text', -- text, address, file, bank_details
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.form_question_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth can manage form_question_templates" ON public.form_question_templates
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Anon can view form_question_templates" ON public.form_question_templates
  FOR SELECT TO anon USING (true);

-- Seed with the 4 default questions
INSERT INTO public.form_question_templates (question, answer_type, has_conditional, conditional_label, conditional_type, sort_order, options) VALUES
  ('É a primeira vez que você declara Imposto de Renda com nosso escritório?', 'yes_no', true, 'Importe a declaração do ano anterior', 'file', 0, '[]'),
  ('Houve alteração de endereço?', 'yes_no', true, 'Informe seu novo endereço', 'address', 1, '[]'),
  ('Houve alteração no estado civil?', 'yes_no', true, 'Informe seu novo estado civil', 'text', 2, '[]'),
  ('Como você prefere receber sua restituição (ou pagar o imposto, se houver)?', 'select', true, 'Informe os dados bancários', 'bank_details', 3, '[{"label":"Via conta bancária","value":"conta_bancaria"},{"label":"Via PIX (somente se a chave for o CPF)","value":"pix_cpf"}]');
