
-- Helper to verify that a target case_id matches the portal token/slug
-- sent by the client in HTTP headers (x-portal-token or x-portal-slug).
CREATE OR REPLACE FUNCTION public.case_matches_portal_token(p_case_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.irpf_cases c
    WHERE c.id = p_case_id
      AND (
        c.portal_token = nullif(
          coalesce(current_setting('request.headers', true), '{}')::json ->> 'x-portal-token',
          ''
        )
        OR c.portal_slug = nullif(
          coalesce(current_setting('request.headers', true), '{}')::json ->> 'x-portal-slug',
          ''
        )
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.case_matches_portal_token(uuid) TO anon, authenticated;

-- case_pendencias: tighten anon UPDATE
DROP POLICY IF EXISTS "Anon can update case_pendencias" ON public.case_pendencias;
CREATE POLICY "Anon can update case_pendencias"
  ON public.case_pendencias
  FOR UPDATE
  TO anon
  USING (public.case_matches_portal_token(case_id))
  WITH CHECK (public.case_matches_portal_token(case_id));

-- document_requests: tighten anon INSERT + UPDATE
DROP POLICY IF EXISTS "Anon can insert doc_requests" ON public.document_requests;
CREATE POLICY "Anon can insert doc_requests"
  ON public.document_requests
  FOR INSERT
  TO anon
  WITH CHECK (public.case_matches_portal_token(case_id));

DROP POLICY IF EXISTS "Anon can update doc_requests status" ON public.document_requests;
CREATE POLICY "Anon can update doc_requests status"
  ON public.document_requests
  FOR UPDATE
  TO anon
  USING (public.case_matches_portal_token(case_id))
  WITH CHECK (public.case_matches_portal_token(case_id));

-- final_deliverables: tighten anon INSERT + UPDATE
DROP POLICY IF EXISTS "Anon can insert final_deliverables" ON public.final_deliverables;
CREATE POLICY "Anon can insert final_deliverables"
  ON public.final_deliverables
  FOR INSERT
  TO anon
  WITH CHECK (public.case_matches_portal_token(case_id));

DROP POLICY IF EXISTS "Anon can update final_deliverables" ON public.final_deliverables;
CREATE POLICY "Anon can update final_deliverables"
  ON public.final_deliverables
  FOR UPDATE
  TO anon
  USING (public.case_matches_portal_token(case_id))
  WITH CHECK (public.case_matches_portal_token(case_id));

-- case_timeline: tighten anon INSERT
DROP POLICY IF EXISTS "Anon can insert case_timeline" ON public.case_timeline;
CREATE POLICY "Anon can insert case_timeline"
  ON public.case_timeline
  FOR INSERT
  TO anon
  WITH CHECK (public.case_matches_portal_token(case_id));

-- case_messages: tighten anon INSERT (preserve sender/visibility constraints)
DROP POLICY IF EXISTS "Anon can insert messages" ON public.case_messages;
CREATE POLICY "Anon can insert messages"
  ON public.case_messages
  FOR INSERT
  TO anon
  WITH CHECK (
    sender = 'client'
    AND visible_to_client = true
    AND public.case_matches_portal_token(case_id)
  );

-- case_answers: tighten anon INSERT
DROP POLICY IF EXISTS "Anon can insert case_answers" ON public.case_answers;
CREATE POLICY "Anon can insert case_answers"
  ON public.case_answers
  FOR INSERT
  TO anon
  WITH CHECK (public.case_matches_portal_token(case_id));

-- uploaded_documents: tighten anon INSERT
DROP POLICY IF EXISTS "Anon can insert uploaded_docs" ON public.uploaded_documents;
CREATE POLICY "Anon can insert uploaded_docs"
  ON public.uploaded_documents
  FOR INSERT
  TO anon
  WITH CHECK (public.case_matches_portal_token(case_id));
