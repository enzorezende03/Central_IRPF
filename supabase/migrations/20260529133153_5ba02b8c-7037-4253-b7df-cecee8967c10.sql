-- Protect retificação flow from automatic triggers

-- 1. auto_update_client_status: ignore retificando/retificada and filter deliverables
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
  v_has_preview boolean;
  v_has_final boolean;
  v_current_status text;
BEGIN
  SELECT
    count(*),
    count(*) FILTER (WHERE status IN ('pendente', 'rejeitado')),
    (count(*) > 0 AND count(*) FILTER (WHERE status IN ('pendente', 'rejeitado')) = 0),
    (count(*) > 0 AND count(*) FILTER (WHERE status != 'aprovado') = 0)
  INTO v_total_docs, v_pending_docs, v_all_sent, v_all_approved
  FROM document_requests WHERE case_id = p_case_id;

  SELECT
    COALESCE(preview_file_url IS NOT NULL, false),
    COALESCE(irpf_file_url IS NOT NULL AND sent_to_client = true, false)
  INTO v_has_preview, v_has_final
  FROM final_deliverables WHERE case_id = p_case_id AND retificacao = false;
  IF NOT FOUND THEN v_has_preview := false; v_has_final := false; END IF;

  SELECT status::text INTO v_current_status FROM irpf_cases WHERE id = p_case_id;
  -- Protected states: do not auto-downgrade
  IF v_current_status IN ('impedida', 'dispensada', 'previa_enviada', 'previa_aprovada', 'retificando', 'retificada') THEN RETURN; END IF;

  IF v_has_final THEN
    UPDATE irpf_cases SET status = 'finalizado', updated_at = now() WHERE id = p_case_id AND status != 'finalizado';
  ELSIF v_has_preview THEN
    UPDATE irpf_cases SET status = 'previa_enviada', updated_at = now() WHERE id = p_case_id AND status NOT IN ('previa_enviada', 'previa_aprovada', 'finalizado');
  ELSIF v_total_docs > 0 AND v_all_approved THEN
    UPDATE irpf_cases SET status = 'em_andamento', updated_at = now() WHERE id = p_case_id AND status NOT IN ('em_andamento', 'pendencia', 'finalizado');
  ELSIF v_total_docs > 0 AND v_all_sent THEN
    UPDATE irpf_cases SET status = 'documentos_em_analise', docs_received_at = COALESCE(docs_received_at, now()), updated_at = now()
    WHERE id = p_case_id AND status NOT IN ('documentos_em_analise', 'em_andamento', 'pendencia', 'finalizado');
  ELSIF v_total_docs > 0 AND v_pending_docs < v_total_docs AND v_pending_docs > 0 THEN
    UPDATE irpf_cases SET status = 'documentos_parciais', updated_at = now()
    WHERE id = p_case_id AND status NOT IN ('documentos_parciais', 'documentos_em_analise', 'em_andamento', 'pendencia', 'finalizado');
  ELSE
    UPDATE irpf_cases SET status = 'aguardando_cliente', updated_at = now() WHERE id = p_case_id AND status != 'aguardando_cliente';
  END IF;
END;
$function$;

-- 2. recalc_case_progress: filter deliverables and don't touch status when in retificação/finalizado
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
  v_has_irpf boolean;
  v_has_receipt boolean;
  v_sent_to_client boolean;
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
  SELECT count(*) INTO v_total_docs FROM document_requests WHERE case_id = p_case_id;
  SELECT count(*) INTO v_total_required_docs FROM document_requests WHERE case_id = p_case_id AND is_required = true;
  SELECT count(*) INTO v_approved_or_sent_docs FROM document_requests WHERE case_id = p_case_id AND status IN ('enviado', 'aprovado');
  SELECT count(*) INTO v_approved_docs FROM document_requests WHERE case_id = p_case_id AND is_required = true AND status = 'aprovado';

  SELECT (count(*) > 0 AND count(*) FILTER (WHERE status = 'aprovado') = count(*))
  INTO v_all_docs_approved FROM document_requests WHERE case_id = p_case_id;

  SELECT exists(SELECT 1 FROM document_requests WHERE case_id = p_case_id AND status IN ('enviado', 'aprovado'))
  INTO v_any_doc_sent;

  SELECT exists(SELECT 1 FROM document_requests WHERE case_id = p_case_id AND is_required = true AND status IN ('pendente', 'rejeitado'))
  INTO v_has_pending_docs;

  SELECT count(*) INTO v_total_required_questions FROM case_questions WHERE case_id = p_case_id AND is_required = true;
  SELECT count(*) INTO v_answered_questions FROM case_questions q
  WHERE q.case_id = p_case_id AND q.is_required = true
    AND exists(SELECT 1 FROM case_answers a WHERE a.question_id = q.id);

  v_has_unanswered_required := (v_answered_questions < v_total_required_questions);

  SELECT
    coalesce(irpf_file_url IS NOT NULL, false),
    coalesce(receipt_file_url IS NOT NULL, false),
    coalesce(sent_to_client, false)
  INTO v_has_irpf, v_has_receipt, v_sent_to_client
  FROM final_deliverables WHERE case_id = p_case_id AND retificacao = false;

  IF NOT FOUND THEN
    v_has_irpf := false; v_has_receipt := false; v_sent_to_client := false;
  END IF;

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

  SELECT status INTO v_current_status FROM irpf_cases WHERE id = p_case_id;
  v_new_status := v_current_status;

  -- Don't change status when in protected/terminal states
  IF v_current_status IN ('retificando', 'retificada', 'finalizado', 'impedida', 'dispensada', 'previa_enviada', 'previa_aprovada') THEN
    UPDATE irpf_cases SET progress_percent = v_progress WHERE id = p_case_id;
    RETURN;
  END IF;

  IF v_has_irpf AND v_has_receipt AND v_sent_to_client THEN
    v_new_status := 'finalizado';
  ELSIF v_current_status = 'aguardando_cliente' AND v_any_doc_sent THEN
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

  UPDATE irpf_cases SET progress_percent = v_progress, status = v_new_status WHERE id = p_case_id;
END;
$function$;

-- 3. auto_set_status_on_preview: skip retificadora rows and protect retificação states
CREATE OR REPLACE FUNCTION public.auto_set_status_on_preview()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current_status case_status;
BEGIN
  -- Ignore retificadora deliverables entirely — they have their own status flow
  IF COALESCE(NEW.retificacao, false) = true THEN
    RETURN NEW;
  END IF;

  SELECT status INTO v_current_status FROM irpf_cases WHERE id = NEW.case_id;
  IF v_current_status IS NULL THEN RETURN NEW; END IF;

  IF v_current_status IN ('finalizado', 'dispensada', 'impedida', 'retificando', 'retificada') THEN
    RETURN NEW;
  END IF;

  IF NEW.preview_file_url IS NOT NULL
     AND COALESCE(NEW.preview_status::text, '') <> 'aprovado'
     AND v_current_status NOT IN ('previa_enviada', 'previa_aprovada') THEN
    UPDATE irpf_cases SET status = 'previa_enviada', updated_at = now() WHERE id = NEW.case_id;
    INSERT INTO case_timeline (case_id, event_type, description, visible_to_client, created_by)
    VALUES (NEW.case_id, 'Status alterado',
            'Demanda movida para "Prévia Enviada" após envio da prévia ao cliente',
            false, 'sistema');
  END IF;

  IF NEW.preview_status::text = 'aprovado'
     AND COALESCE(OLD.preview_status::text, '') <> 'aprovado'
     AND v_current_status <> 'previa_aprovada'
     AND v_current_status <> 'finalizado' THEN
    UPDATE irpf_cases SET status = 'previa_aprovada', updated_at = now() WHERE id = NEW.case_id;
    INSERT INTO case_timeline (case_id, event_type, description, visible_to_client, created_by)
    VALUES (NEW.case_id, 'Status alterado',
            'Prévia aprovada — demanda movida para "Prévia Aprovada"',
            false, 'sistema');
  END IF;

  IF COALESCE(OLD.preview_status::text, '') = 'aprovado'
     AND COALESCE(NEW.preview_status::text, '') <> 'aprovado'
     AND NEW.preview_file_url IS NOT NULL
     AND v_current_status = 'previa_aprovada' THEN
    UPDATE irpf_cases SET status = 'previa_enviada', updated_at = now() WHERE id = NEW.case_id;
    INSERT INTO case_timeline (case_id, event_type, description, visible_to_client, created_by)
    VALUES (NEW.case_id, 'Status alterado',
            'Aprovação da prévia cancelada — demanda voltou para "Prévia Enviada"',
            false, 'sistema');
  END IF;

  RETURN NEW;
END;
$function$;