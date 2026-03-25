
DROP TRIGGER IF EXISTS trg_generate_portal_token ON public.irpf_cases;
DROP TRIGGER IF EXISTS trg_recalc_on_doc_requests ON public.document_requests;
DROP TRIGGER IF EXISTS trg_recalc_on_uploaded_docs ON public.uploaded_documents;
DROP TRIGGER IF EXISTS trg_recalc_on_case_answers ON public.case_answers;
DROP TRIGGER IF EXISTS trg_recalc_on_deliverables ON public.final_deliverables;
DROP TRIGGER IF EXISTS trg_doc_status_update ON public.document_requests;
DROP TRIGGER IF EXISTS trg_deliverable_status_update ON public.final_deliverables;
DROP TRIGGER IF EXISTS trg_update_updated_at ON public.irpf_cases;

CREATE TRIGGER trg_generate_portal_token
  BEFORE INSERT ON public.irpf_cases
  FOR EACH ROW EXECUTE FUNCTION public.generate_portal_token();

CREATE TRIGGER trg_recalc_on_doc_requests
  AFTER INSERT OR UPDATE OR DELETE ON public.document_requests
  FOR EACH ROW EXECUTE FUNCTION public.trigger_recalc_case_progress();

CREATE TRIGGER trg_recalc_on_uploaded_docs
  AFTER INSERT OR UPDATE OR DELETE ON public.uploaded_documents
  FOR EACH ROW EXECUTE FUNCTION public.trigger_recalc_case_progress();

CREATE TRIGGER trg_recalc_on_case_answers
  AFTER INSERT OR UPDATE OR DELETE ON public.case_answers
  FOR EACH ROW EXECUTE FUNCTION public.trigger_recalc_case_progress();

CREATE TRIGGER trg_recalc_on_deliverables
  AFTER INSERT OR UPDATE OR DELETE ON public.final_deliverables
  FOR EACH ROW EXECUTE FUNCTION public.trigger_recalc_case_progress();

CREATE TRIGGER trg_doc_status_update
  AFTER UPDATE OF status ON public.document_requests
  FOR EACH ROW EXECUTE FUNCTION public.trg_doc_status_update_client_status();

CREATE TRIGGER trg_deliverable_status_update
  AFTER INSERT OR UPDATE ON public.final_deliverables
  FOR EACH ROW EXECUTE FUNCTION public.trg_deliverable_update_client_status();

CREATE TRIGGER trg_update_updated_at
  BEFORE UPDATE ON public.irpf_cases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
