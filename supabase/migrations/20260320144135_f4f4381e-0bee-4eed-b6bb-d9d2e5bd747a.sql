
-- Allow anon to read clients (for portal)
CREATE POLICY "Anon can view clients"
  ON public.clients FOR SELECT TO anon
  USING (true);

-- Allow anon to insert clients (temporary until auth is implemented)
CREATE POLICY "Anon can insert clients"
  ON public.clients FOR INSERT TO anon
  WITH CHECK (true);

-- Allow anon to insert irpf_cases
CREATE POLICY "Anon can insert cases"
  ON public.irpf_cases FOR INSERT TO anon
  WITH CHECK (true);

-- Allow anon to insert billing
CREATE POLICY "Anon can insert billing"
  ON public.billing FOR INSERT TO anon
  WITH CHECK (true);

-- Allow anon to view billing
CREATE POLICY "Anon can view billing"
  ON public.billing FOR SELECT TO anon
  USING (true);

-- Allow anon to insert document_requests
CREATE POLICY "Anon can insert doc_requests"
  ON public.document_requests FOR INSERT TO anon
  WITH CHECK (true);

-- Allow anon to insert case_timeline
CREATE POLICY "Anon can insert case_timeline"
  ON public.case_timeline FOR INSERT TO anon
  WITH CHECK (true);
