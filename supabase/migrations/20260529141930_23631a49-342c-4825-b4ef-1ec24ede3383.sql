DROP TRIGGER IF EXISTS trg_auto_client_status_on_deliverable ON public.final_deliverables;
DROP TRIGGER IF EXISTS trg_deliverable_update_client_status ON public.final_deliverables;
DROP TRIGGER IF EXISTS trg_auto_set_status_on_preview ON public.final_deliverables;
DROP TRIGGER IF EXISTS trg_auto_set_status_on_preview_ins ON public.final_deliverables;
DROP TRIGGER IF EXISTS trg_auto_set_status_on_preview_upd ON public.final_deliverables;
DROP TRIGGER IF EXISTS trg_recalc_final_deliverables ON public.final_deliverables;
DROP TRIGGER IF EXISTS trg_recalc_on_deliverables ON public.final_deliverables;
DROP TRIGGER IF EXISTS trg_auto_client_status_on_doc ON public.document_requests;
DROP TRIGGER IF EXISTS trg_doc_requests_update_client_status ON public.document_requests;
DROP TRIGGER IF EXISTS trg_recalc_doc_requests ON public.document_requests;
DROP TRIGGER IF EXISTS trg_recalc_on_doc_requests ON public.document_requests;
DROP TRIGGER IF EXISTS trg_case_answers_update_status ON public.case_answers;
DROP TRIGGER IF EXISTS trg_recalc_case_answers ON public.case_answers;
DROP TRIGGER IF EXISTS trg_recalc_on_case_answers ON public.case_answers;
DROP TRIGGER IF EXISTS trg_recalc_uploaded_docs ON public.uploaded_documents;
DROP TRIGGER IF EXISTS trg_recalc_on_uploaded_docs ON public.uploaded_documents;

CREATE OR REPLACE FUNCTION public.auto_update_client_status(p_case_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total_docs int;
  v_pending_docs int;
  v_all_sent boolean;
  v_all_approved boolean;
  v_has_preview boolean := false;
  v_has_final boolean := false;
  v_current_status text;
BEGIN
  SELECT
    count(*),
    count(*) FILTER (WHERE status IN ('pendente', 'rejeitado')),
    (count(*) > 0 AND count(*) FILTER (WHERE status IN ('pendente', 'rejeitado')) = 0),
    (count(*) > 0 AND count(*) FILTER (WHERE status != 'aprovado') = 0)
  INTO v_total_docs, v_pending_docs, v_all_sent, v_all_approved
  FROM public.document_requests
  WHERE case_id = p_case_id;

  SELECT
    COALESCE(bool_or(preview_file_url IS NOT NULL), false),
    COALESCE(bool_or(irpf_file_url IS NOT NULL AND receipt_file_url IS NOT NULL AND sent_to_client = true), false)
  INTO v_has_preview, v_has_final
  FROM public.final_deliverables
  WHERE case_id = p_case_id
    AND COALESCE(retificacao, false) = false;

  SELECT status::text INTO v_current_status
  FROM public.irpf_cases
  WHERE id = p_case_id;

  IF v_current_status IS NULL THEN
    RETURN;
  END IF;

  IF v_has_final AND v_current_status NOT IN ('finalizado', 'retificando', 'retificada', 'impedida', 'dispensada') THEN
    UPDATE public.irpf_cases
       SET status = 'finalizado',
           progress_percent = 100,
           completed_at = COALESCE(completed_at, now()),
           updated_at = now()
     WHERE id = p_case_id;
    RETURN;
  END IF;

  IF v_current_status IN ('impedida', 'dispensada', 'previa_enviada', 'previa_aprovada', 'retificando', 'retificada', 'finalizado') THEN
    RETURN;
  END IF;

  IF v_has_preview THEN
    UPDATE public.irpf_cases
       SET status = 'previa_enviada', updated_at = now()
     WHERE id = p_case_id
       AND status NOT IN ('previa_enviada', 'previa_aprovada', 'finalizado');
  ELSIF v_total_docs > 0 AND v_all_approved THEN
    UPDATE public.irpf_cases
       SET status = 'em_andamento', updated_at = now()
     WHERE id = p_case_id
       AND status NOT IN ('em_andamento', 'pendencia', 'finalizado');
  ELSIF v_total_docs > 0 AND v_all_sent THEN
    UPDATE public.irpf_cases
       SET status = 'documentos_em_analise',
           docs_received_at = COALESCE(docs_received_at, now()),
           updated_at = now()
     WHERE id = p_case_id
       AND status NOT IN ('documentos_em_analise', 'em_andamento', 'pendencia', 'finalizado');
  ELSIF v_total_docs > 0 AND v_pending_docs < v_total_docs AND v_pending_docs > 0 THEN
    UPDATE public.irpf_cases
       SET status = 'documentos_parciais', updated_at = now()
     WHERE id = p_case_id
       AND status NOT IN ('documentos_parciais', 'documentos_em_analise', 'em_andamento', 'pendencia', 'finalizado');
  ELSE
    UPDATE public.irpf_cases
       SET status = 'aguardando_cliente', updated_at = now()
     WHERE id = p_case_id
       AND status != 'aguardando_cliente';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.recalc_case_progress(p_case_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total_docs integer;
  v_total_required_docs integer;
  v_approved_docs integer;
  v_approved_or_sent_docs integer;
  v_total_required_questions integer;
  v_answered_questions integer;
  v_has_irpf boolean := false;
  v_has_receipt boolean := false;
  v_sent_to_client boolean := false;
  v_progress integer;
  v_total_items integer;
  v_completed_items integer;
  v_current_status case_status;
  v_new_status case_status;
  v_any_doc_sent boolean;
  v_has_pending_docs boolean;
  v_has_unanswered_required boolean;
  v_all_docs_approved boolean;
BEGIN
  SELECT count(*) INTO v_total_docs FROM public.document_requests WHERE case_id = p_case_id;
  SELECT count(*) INTO v_total_required_docs FROM public.document_requests WHERE case_id = p_case_id AND is_required = true;
  SELECT count(*) INTO v_approved_or_sent_docs FROM public.document_requests WHERE case_id = p_case_id AND status IN ('enviado', 'aprovado');
  SELECT count(*) INTO v_approved_docs FROM public.document_requests WHERE case_id = p_case_id AND is_required = true AND status = 'aprovado';

  SELECT (count(*) > 0 AND count(*) FILTER (WHERE status = 'aprovado') = count(*))
  INTO v_all_docs_approved
  FROM public.document_requests
  WHERE case_id = p_case_id;

  SELECT exists(SELECT 1 FROM public.document_requests WHERE case_id = p_case_id AND status IN ('enviado', 'aprovado'))
  INTO v_any_doc_sent;

  SELECT exists(SELECT 1 FROM public.document_requests WHERE case_id = p_case_id AND is_required = true AND status IN ('pendente', 'rejeitado'))
  INTO v_has_pending_docs;

  SELECT count(*) INTO v_total_required_questions FROM public.case_questions WHERE case_id = p_case_id AND is_required = true;
  SELECT count(*) INTO v_answered_questions
  FROM public.case_questions q
  WHERE q.case_id = p_case_id
    AND q.is_required = true
    AND exists(SELECT 1 FROM public.case_answers a WHERE a.question_id = q.id);

  v_has_unanswered_required := (v_answered_questions < v_total_required_questions);

  SELECT
    COALESCE(bool_or(irpf_file_url IS NOT NULL), false),
    COALESCE(bool_or(receipt_file_url IS NOT NULL), false),
    COALESCE(bool_or(sent_to_client), false)
  INTO v_has_irpf, v_has_receipt, v_sent_to_client
  FROM public.final_deliverables
  WHERE case_id = p_case_id
    AND COALESCE(retificacao, false) = false;

  v_total_items := 0;
  v_completed_items := 0;

  IF v_total_docs > 0 THEN
    v_total_items := v_total_items + 40;
    IF v_total_required_docs > 0 THEN
      v_completed_items := v_completed_items + (40 * v_approved_docs / v_total_required_docs);
    ELSE
      v_completed_items := v_completed_items + (40 * v_approved_or_sent_docs / v_total_docs);
    END IF;
  END IF;

  IF v_total_required_questions > 0 THEN
    v_total_items := v_total_items + 30;
    v_completed_items := v_completed_items + (30 * v_answered_questions / v_total_required_questions);
  END IF;

  v_total_items := v_total_items + 30;
  IF v_has_irpf AND v_has_receipt AND v_sent_to_client THEN
    v_completed_items := v_completed_items + 30;
  ELSIF v_has_irpf AND v_has_receipt THEN
    v_completed_items := v_completed_items + 20;
  ELSIF v_has_irpf OR v_has_receipt THEN
    v_completed_items := v_completed_items + 10;
  END IF;

  IF v_total_items > 0 THEN
    v_progress := (v_completed_items * 100) / v_total_items;
  ELSE
    v_progress := 0;
  END IF;

  IF v_progress > 100 THEN v_progress := 100; END IF;
  IF v_progress < 0 THEN v_progress := 0; END IF;

  SELECT status INTO v_current_status FROM public.irpf_cases WHERE id = p_case_id;
  v_new_status := v_current_status;

  IF v_has_irpf AND v_has_receipt AND v_sent_to_client
     AND v_current_status NOT IN ('finalizado', 'retificando', 'retificada', 'impedida', 'dispensada') THEN
    UPDATE public.irpf_cases
       SET progress_percent = 100,
           status = 'finalizado',
           completed_at = COALESCE(completed_at, now()),
           updated_at = now()
     WHERE id = p_case_id;
    RETURN;
  END IF;

  IF v_current_status IN ('retificando', 'retificada', 'finalizado', 'impedida', 'dispensada', 'previa_enviada', 'previa_aprovada') THEN
    UPDATE public.irpf_cases
       SET progress_percent = v_progress
     WHERE id = p_case_id;
    RETURN;
  END IF;

  IF v_current_status = 'aguardando_cliente' AND v_any_doc_sent THEN
    v_new_status := 'documentos_em_analise';
  ELSIF v_current_status = 'documentos_em_analise' AND v_all_docs_approved AND NOT v_has_unanswered_required THEN
    v_new_status := 'em_andamento';
  ELSIF v_current_status = 'em_andamento' AND NOT v_all_docs_approved AND v_any_doc_sent THEN
    v_new_status := 'documentos_em_analise';
  ELSIF v_current_status IN ('documentos_em_analise', 'em_andamento') AND (v_has_pending_docs OR v_has_unanswered_required) THEN
    v_new_status := 'pendencia';
  ELSIF v_current_status = 'pendencia' AND v_all_docs_approved AND NOT v_has_unanswered_required THEN
    v_new_status := 'em_andamento';
  END IF;

  UPDATE public.irpf_cases
     SET progress_percent = v_progress,
         status = v_new_status,
         updated_at = CASE WHEN status IS DISTINCT FROM v_new_status THEN now() ELSE updated_at END
   WHERE id = p_case_id;
END;
$function$;

WITH affected AS (
  SELECT c.id, cl.full_name
  FROM public.irpf_cases c
  JOIN public.clients cl ON cl.id = c.client_id
  WHERE c.deleted_at IS NULL
    AND c.status IN ('previa_enviada', 'previa_aprovada')
    AND EXISTS (
      SELECT 1
      FROM public.final_deliverables fd
      WHERE fd.case_id = c.id
        AND COALESCE(fd.retificacao, false) = false
        AND fd.irpf_file_url IS NOT NULL
        AND fd.receipt_file_url IS NOT NULL
        AND fd.sent_to_client = true
    )
), updated AS (
  UPDATE public.irpf_cases c
     SET status = 'finalizado',
         progress_percent = 100,
         completed_at = COALESCE(c.completed_at, now()),
         updated_at = now()
    FROM affected a
   WHERE c.id = a.id
   RETURNING c.id, a.full_name
)
INSERT INTO public.case_timeline (case_id, event_type, description, visible_to_client, created_by)
SELECT id,
       'Status corrigido',
       'Demanda marcada automaticamente como Finalizada após verificação geral: IRPF e recibo já estavam anexados e liberados ao cliente.',
       false,
       'sistema'
FROM updated;

CREATE TRIGGER trg_deliverable_update_client_status
AFTER INSERT OR DELETE OR UPDATE ON public.final_deliverables
FOR EACH ROW EXECUTE FUNCTION public.trg_deliverable_update_client_status();

CREATE TRIGGER trg_auto_set_status_on_preview
AFTER INSERT OR UPDATE ON public.final_deliverables
FOR EACH ROW EXECUTE FUNCTION public.auto_set_status_on_preview();

CREATE TRIGGER trg_recalc_on_deliverables
AFTER INSERT OR DELETE OR UPDATE ON public.final_deliverables
FOR EACH ROW EXECUTE FUNCTION public.trigger_recalc_case_progress();

CREATE TRIGGER trg_doc_requests_update_client_status
AFTER INSERT OR DELETE OR UPDATE ON public.document_requests
FOR EACH ROW EXECUTE FUNCTION public.trg_doc_status_update_client_status();

CREATE TRIGGER trg_recalc_on_doc_requests
AFTER INSERT OR DELETE OR UPDATE ON public.document_requests
FOR EACH ROW EXECUTE FUNCTION public.trigger_recalc_case_progress();

CREATE TRIGGER trg_recalc_on_case_answers
AFTER INSERT OR DELETE OR UPDATE ON public.case_answers
FOR EACH ROW EXECUTE FUNCTION public.trigger_recalc_case_progress();

CREATE TRIGGER trg_recalc_on_uploaded_docs
AFTER INSERT OR DELETE OR UPDATE ON public.uploaded_documents
FOR EACH ROW EXECUTE FUNCTION public.trigger_recalc_case_progress();