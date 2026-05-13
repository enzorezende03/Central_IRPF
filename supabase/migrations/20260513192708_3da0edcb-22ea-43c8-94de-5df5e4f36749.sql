
-- Anexar triggers de sincronização de status à tabela final_deliverables
DROP TRIGGER IF EXISTS trg_auto_set_status_on_preview ON public.final_deliverables;
CREATE TRIGGER trg_auto_set_status_on_preview
AFTER INSERT OR UPDATE ON public.final_deliverables
FOR EACH ROW EXECUTE FUNCTION public.auto_set_status_on_preview();

DROP TRIGGER IF EXISTS trg_deliverable_update_client_status ON public.final_deliverables;
CREATE TRIGGER trg_deliverable_update_client_status
AFTER INSERT OR UPDATE OR DELETE ON public.final_deliverables
FOR EACH ROW EXECUTE FUNCTION public.trg_deliverable_update_client_status();

-- Triggers para document_requests / uploaded_documents / case_answers atualizarem status
DROP TRIGGER IF EXISTS trg_doc_requests_update_client_status ON public.document_requests;
CREATE TRIGGER trg_doc_requests_update_client_status
AFTER INSERT OR UPDATE OR DELETE ON public.document_requests
FOR EACH ROW EXECUTE FUNCTION public.trg_doc_status_update_client_status();

-- Recalcular progresso
DROP TRIGGER IF EXISTS trg_recalc_doc_requests ON public.document_requests;
CREATE TRIGGER trg_recalc_doc_requests
AFTER INSERT OR UPDATE OR DELETE ON public.document_requests
FOR EACH ROW EXECUTE FUNCTION public.trigger_recalc_case_progress();

DROP TRIGGER IF EXISTS trg_recalc_uploaded_docs ON public.uploaded_documents;
CREATE TRIGGER trg_recalc_uploaded_docs
AFTER INSERT OR UPDATE OR DELETE ON public.uploaded_documents
FOR EACH ROW EXECUTE FUNCTION public.trigger_recalc_case_progress();

DROP TRIGGER IF EXISTS trg_recalc_case_answers ON public.case_answers;
CREATE TRIGGER trg_recalc_case_answers
AFTER INSERT OR UPDATE OR DELETE ON public.case_answers
FOR EACH ROW EXECUTE FUNCTION public.trigger_recalc_case_progress();

DROP TRIGGER IF EXISTS trg_recalc_final_deliverables ON public.final_deliverables;
CREATE TRIGGER trg_recalc_final_deliverables
AFTER INSERT OR UPDATE OR DELETE ON public.final_deliverables
FOR EACH ROW EXECUTE FUNCTION public.trigger_recalc_case_progress();

-- Outras triggers existentes mas desconectadas
DROP TRIGGER IF EXISTS trg_auto_reopen_on_client_message ON public.case_messages;
CREATE TRIGGER trg_auto_reopen_on_client_message
AFTER INSERT ON public.case_messages
FOR EACH ROW EXECUTE FUNCTION public.auto_reopen_on_client_message();

DROP TRIGGER IF EXISTS trg_log_pendencia_timeline ON public.case_pendencias;
CREATE TRIGGER trg_log_pendencia_timeline
AFTER INSERT OR UPDATE ON public.case_pendencias
FOR EACH ROW EXECUTE FUNCTION public.log_pendencia_timeline();

DROP TRIGGER IF EXISTS trg_auto_set_status_on_new_pendencia ON public.case_pendencias;
CREATE TRIGGER trg_auto_set_status_on_new_pendencia
AFTER INSERT ON public.case_pendencias
FOR EACH ROW EXECUTE FUNCTION public.auto_set_status_on_new_pendencia();

DROP TRIGGER IF EXISTS trg_set_case_completed_at ON public.irpf_cases;
CREATE TRIGGER trg_set_case_completed_at
BEFORE UPDATE ON public.irpf_cases
FOR EACH ROW EXECUTE FUNCTION public.set_case_completed_at();

DROP TRIGGER IF EXISTS trg_generate_portal_token ON public.irpf_cases;
CREATE TRIGGER trg_generate_portal_token
BEFORE INSERT ON public.irpf_cases
FOR EACH ROW EXECUTE FUNCTION public.generate_portal_token();

-- Backfill: corrigir status das demandas com prévia já enviada
UPDATE public.irpf_cases c
SET status = CASE
  WHEN fd.preview_status::text = 'aprovado' THEN 'previa_aprovada'::case_status
  ELSE 'previa_enviada'::case_status
END,
updated_at = now()
FROM public.final_deliverables fd
WHERE fd.case_id = c.id
  AND fd.preview_file_url IS NOT NULL
  AND fd.irpf_file_url IS NULL
  AND c.status NOT IN ('previa_enviada','previa_aprovada','finalizado','dispensada','impedida')
  AND c.deleted_at IS NULL;
