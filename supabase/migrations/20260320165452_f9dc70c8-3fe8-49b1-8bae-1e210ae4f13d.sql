CREATE TABLE public.document_checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  is_required boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.document_checklist_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth can manage checklist templates" ON public.document_checklist_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed with current defaults
INSERT INTO public.document_checklist_templates (title, is_required, sort_order) VALUES
  ('Informe de Rendimentos (empregador)', true, 0),
  ('Informe de Rendimentos (banco)', true, 1),
  ('Informe de Rendimentos (corretora)', true, 2),
  ('Comprovante de despesas médicas', false, 3),
  ('Comprovante de despesas com educação', false, 4),
  ('Recibo de aluguel pago/recebido', false, 5),
  ('DARF de carnê-leão', false, 6),
  ('Comprovante de compra/venda de imóvel', false, 7),
  ('Comprovante de compra/venda de veículo', false, 8),
  ('Documento de dependentes (CPF)', false, 9),
  ('Recibo de pensão alimentícia', false, 10),
  ('Declaração do ano anterior (recibo)', false, 11);