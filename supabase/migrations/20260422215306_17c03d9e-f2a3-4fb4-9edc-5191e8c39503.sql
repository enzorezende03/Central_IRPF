
-- Triggers que mantêm o status da demanda sincronizado automaticamente
DROP TRIGGER IF EXISTS trg_doc_requests_update_status ON public.document_requests;
CREATE TRIGGER trg_doc_requests_update_status
AFTER INSERT OR UPDATE OR DELETE ON public.document_requests
FOR EACH ROW EXECUTE FUNCTION public.trg_doc_status_update_client_status();

DROP TRIGGER IF EXISTS trg_case_answers_update_status ON public.case_answers;
CREATE TRIGGER trg_case_answers_update_status
AFTER INSERT OR UPDATE OR DELETE ON public.case_answers
FOR EACH ROW EXECUTE FUNCTION public.trg_doc_status_update_client_status();

DROP TRIGGER IF EXISTS trg_final_deliverables_update_status ON public.final_deliverables;
CREATE TRIGGER trg_final_deliverables_update_status
AFTER INSERT OR UPDATE OR DELETE ON public.final_deliverables
FOR EACH ROW EXECUTE FUNCTION public.trg_deliverable_update_client_status();

-- Sincroniza o status atual de TODAS as demandas usando a regra correta
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.irpf_cases LOOP
    PERFORM public.auto_update_client_status(r.id);
  END LOOP;
END $$;
