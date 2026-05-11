
-- Remove duplicate triggers on document_requests (3 triggers calling same function)
DROP TRIGGER IF EXISTS trg_doc_requests_update_status ON public.document_requests;
DROP TRIGGER IF EXISTS trg_doc_status_update ON public.document_requests;

-- Remove duplicate triggers on final_deliverables
DROP TRIGGER IF EXISTS trg_deliverable_status_update ON public.final_deliverables;
DROP TRIGGER IF EXISTS trg_final_deliverables_update_status ON public.final_deliverables;
DROP TRIGGER IF EXISTS trg_recalc_on_final_deliverables ON public.final_deliverables;

-- Remove duplicate triggers on uploaded_documents
DROP TRIGGER IF EXISTS trg_recalc_on_uploaded_documents ON public.uploaded_documents;

-- Remove duplicate triggers on irpf_cases
DROP TRIGGER IF EXISTS trg_generate_portal_token ON public.irpf_cases;
DROP TRIGGER IF EXISTS update_irpf_cases_updated_at ON public.irpf_cases;
