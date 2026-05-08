
CREATE INDEX IF NOT EXISTS idx_case_messages_case_id_created_at ON public.case_messages (case_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_case_messages_unread_client ON public.case_messages (created_at DESC) WHERE read_at IS NULL AND sender = 'client';
CREATE INDEX IF NOT EXISTS idx_case_messages_created_at ON public.case_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_internal_checklist_case_id ON public.internal_checklist (case_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_docs_case_uploaded_at ON public.uploaded_documents (case_id, uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_case_timeline_case_created_at ON public.case_timeline (case_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_doc_requests_case_created_at ON public.document_requests (case_id, created_at);
CREATE INDEX IF NOT EXISTS idx_irpf_cases_active_updated ON public.irpf_cases (updated_at DESC) WHERE deleted_at IS NULL;
ANALYZE public.case_messages;
ANALYZE public.internal_checklist;
ANALYZE public.uploaded_documents;
ANALYZE public.case_timeline;
ANALYZE public.document_requests;
ANALYZE public.irpf_cases;
