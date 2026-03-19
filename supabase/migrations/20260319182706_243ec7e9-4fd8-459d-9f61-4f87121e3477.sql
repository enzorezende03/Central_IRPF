
-- ENUMS
CREATE TYPE public.case_status AS ENUM ('aguardando_cliente','documentos_em_analise','em_andamento','pendencia','finalizado');
CREATE TYPE public.case_priority AS ENUM ('baixa','media','alta','urgente');
CREATE TYPE public.billing_status AS ENUM ('nao_cobrado','cobrado','pago');
CREATE TYPE public.document_status AS ENUM ('pendente','enviado','aprovado','rejeitado');
CREATE TYPE public.answer_type AS ENUM ('text','yes_no','number','date','file');
CREATE TYPE public.uploaded_by_type AS ENUM ('client','office');

-- FUNCTIONS (generic)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.generate_portal_token()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.portal_token IS NULL THEN
    NEW.portal_token = encode(gen_random_bytes(32), 'hex');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 1. CLIENTS
CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  cpf TEXT NOT NULL UNIQUE,
  phone TEXT,
  email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_clients_cpf ON public.clients (cpf);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth can view clients" ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth can insert clients" ON public.clients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth can update clients" ON public.clients FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth can delete clients" ON public.clients FOR DELETE TO authenticated USING (true);
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. IRPF_CASES
CREATE TABLE public.irpf_cases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  tax_year INTEGER NOT NULL DEFAULT 2026,
  base_year INTEGER NOT NULL DEFAULT 2025,
  internal_owner TEXT,
  status public.case_status NOT NULL DEFAULT 'aguardando_cliente',
  priority public.case_priority NOT NULL DEFAULT 'media',
  progress_percent INTEGER NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  internal_notes TEXT,
  client_message TEXT,
  portal_token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_irpf_cases_client_id ON public.irpf_cases (client_id);
CREATE INDEX idx_irpf_cases_status ON public.irpf_cases (status);
CREATE INDEX idx_irpf_cases_portal_token ON public.irpf_cases (portal_token);
ALTER TABLE public.irpf_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth can view cases" ON public.irpf_cases FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth can insert cases" ON public.irpf_cases FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth can update cases" ON public.irpf_cases FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth can delete cases" ON public.irpf_cases FOR DELETE TO authenticated USING (true);
CREATE POLICY "Portal anon access cases" ON public.irpf_cases FOR SELECT TO anon USING (true);
CREATE TRIGGER generate_irpf_case_token BEFORE INSERT ON public.irpf_cases FOR EACH ROW EXECUTE FUNCTION public.generate_portal_token();
CREATE TRIGGER update_irpf_cases_updated_at BEFORE UPDATE ON public.irpf_cases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function that depends on irpf_cases
CREATE OR REPLACE FUNCTION public.get_case_by_token(p_token TEXT)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT id FROM public.irpf_cases WHERE portal_token = p_token LIMIT 1; $$;

-- 3. DOCUMENT_REQUESTS
CREATE TABLE public.document_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES public.irpf_cases(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT,
  is_required BOOLEAN NOT NULL DEFAULT true,
  status public.document_status NOT NULL DEFAULT 'pendente',
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_doc_requests_case_id ON public.document_requests (case_id);
ALTER TABLE public.document_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth can manage doc_requests" ON public.document_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anon can view doc_requests" ON public.document_requests FOR SELECT TO anon USING (true);

-- 4. UPLOADED_DOCUMENTS
CREATE TABLE public.uploaded_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES public.irpf_cases(id) ON DELETE CASCADE,
  document_request_id UUID REFERENCES public.document_requests(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  uploaded_by public.uploaded_by_type NOT NULL DEFAULT 'client',
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_uploaded_docs_case_id ON public.uploaded_documents (case_id);
ALTER TABLE public.uploaded_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth can manage uploaded_docs" ON public.uploaded_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anon can view uploaded_docs" ON public.uploaded_documents FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert uploaded_docs" ON public.uploaded_documents FOR INSERT TO anon WITH CHECK (true);

-- 5. CASE_QUESTIONS
CREATE TABLE public.case_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES public.irpf_cases(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer_type public.answer_type NOT NULL DEFAULT 'text',
  is_required BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_case_questions_case_id ON public.case_questions (case_id);
ALTER TABLE public.case_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth can manage case_questions" ON public.case_questions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anon can view case_questions" ON public.case_questions FOR SELECT TO anon USING (true);

-- 6. CASE_ANSWERS
CREATE TABLE public.case_answers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES public.irpf_cases(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.case_questions(id) ON DELETE CASCADE,
  answer_text TEXT,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_case_answers_case_id ON public.case_answers (case_id);
CREATE INDEX idx_case_answers_question_id ON public.case_answers (question_id);
ALTER TABLE public.case_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth can manage case_answers" ON public.case_answers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anon can view case_answers" ON public.case_answers FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert case_answers" ON public.case_answers FOR INSERT TO anon WITH CHECK (true);

-- 7. BILLING
CREATE TABLE public.billing (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES public.irpf_cases(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  billing_status public.billing_status NOT NULL DEFAULT 'nao_cobrado',
  payment_date DATE,
  payment_method TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_billing_case_id ON public.billing (case_id);
ALTER TABLE public.billing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth can manage billing" ON public.billing FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_billing_updated_at BEFORE UPDATE ON public.billing FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8. FINAL_DELIVERABLES
CREATE TABLE public.final_deliverables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES public.irpf_cases(id) ON DELETE CASCADE UNIQUE,
  irpf_file_url TEXT,
  receipt_file_url TEXT,
  sent_to_client BOOLEAN NOT NULL DEFAULT false,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_final_deliverables_case_id ON public.final_deliverables (case_id);
ALTER TABLE public.final_deliverables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth can manage final_deliverables" ON public.final_deliverables FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anon can view final_deliverables" ON public.final_deliverables FOR SELECT TO anon USING (true);

-- 9. CASE_TIMELINE
CREATE TABLE public.case_timeline (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES public.irpf_cases(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  description TEXT,
  visible_to_client BOOLEAN NOT NULL DEFAULT false,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_case_timeline_case_id ON public.case_timeline (case_id);
ALTER TABLE public.case_timeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth can manage case_timeline" ON public.case_timeline FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anon can view visible timeline" ON public.case_timeline FOR SELECT TO anon USING (visible_to_client = true);

-- STORAGE BUCKETS
INSERT INTO storage.buckets (id, name, public) VALUES ('documentos_clientes', 'documentos_clientes', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('declaracoes_finais', 'declaracoes_finais', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('recibos_entrega', 'recibos_entrega', false);

-- Storage policies
CREATE POLICY "Office access documentos_clientes" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'documentos_clientes') WITH CHECK (bucket_id = 'documentos_clientes');
CREATE POLICY "Office access declaracoes_finais" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'declaracoes_finais') WITH CHECK (bucket_id = 'declaracoes_finais');
CREATE POLICY "Office access recibos_entrega" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'recibos_entrega') WITH CHECK (bucket_id = 'recibos_entrega');
CREATE POLICY "Anon upload documentos_clientes" ON storage.objects FOR INSERT TO anon WITH CHECK (bucket_id = 'documentos_clientes');
CREATE POLICY "Anon read declaracoes_finais" ON storage.objects FOR SELECT TO anon USING (bucket_id = 'declaracoes_finais');
CREATE POLICY "Anon read recibos_entrega" ON storage.objects FOR SELECT TO anon USING (bucket_id = 'recibos_entrega');
