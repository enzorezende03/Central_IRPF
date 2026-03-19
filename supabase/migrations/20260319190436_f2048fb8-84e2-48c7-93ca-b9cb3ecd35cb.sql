
-- Storage RLS policies for documentos_clientes bucket
CREATE POLICY "Anon can upload to documentos_clientes"
ON storage.objects FOR INSERT TO anon
WITH CHECK (bucket_id = 'documentos_clientes');

CREATE POLICY "Anon can read documentos_clientes"
ON storage.objects FOR SELECT TO anon
USING (bucket_id = 'documentos_clientes');

CREATE POLICY "Auth can manage documentos_clientes"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'documentos_clientes')
WITH CHECK (bucket_id = 'documentos_clientes');

-- Storage RLS policies for declaracoes_finais bucket
CREATE POLICY "Auth can manage declaracoes_finais"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'declaracoes_finais')
WITH CHECK (bucket_id = 'declaracoes_finais');

CREATE POLICY "Anon can read declaracoes_finais"
ON storage.objects FOR SELECT TO anon
USING (bucket_id = 'declaracoes_finais');

-- Storage RLS policies for recibos_entrega bucket
CREATE POLICY "Auth can manage recibos_entrega"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'recibos_entrega')
WITH CHECK (bucket_id = 'recibos_entrega');

CREATE POLICY "Anon can read recibos_entrega"
ON storage.objects FOR SELECT TO anon
USING (bucket_id = 'recibos_entrega');

-- Anon can also insert timeline events (for portal actions)
CREATE POLICY "Anon can insert timeline"
ON public.case_timeline FOR INSERT TO anon
WITH CHECK (true);

-- Anon can update document_requests status to enviado
CREATE POLICY "Anon can update doc_requests status"
ON public.document_requests FOR UPDATE TO anon
USING (true)
WITH CHECK (true);
