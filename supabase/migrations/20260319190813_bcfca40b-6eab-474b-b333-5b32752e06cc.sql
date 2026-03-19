
-- Function to recalculate progress and auto-update status for a given case
CREATE OR REPLACE FUNCTION public.recalc_case_progress(p_case_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_required_docs integer;
  v_approved_docs integer;
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
BEGIN
  -- Count required documents
  SELECT count(*) INTO v_total_required_docs
  FROM document_requests
  WHERE case_id = p_case_id AND is_required = true;

  -- Count approved required documents
  SELECT count(*) INTO v_approved_docs
  FROM document_requests
  WHERE case_id = p_case_id AND is_required = true AND status = 'aprovado';

  -- Any document sent (any status beyond pendente)?
  SELECT exists(
    SELECT 1 FROM document_requests
    WHERE case_id = p_case_id AND status IN ('enviado', 'aprovado')
  ) INTO v_any_doc_sent;

  -- Any pending required docs?
  SELECT exists(
    SELECT 1 FROM document_requests
    WHERE case_id = p_case_id AND is_required = true AND status IN ('pendente', 'rejeitado')
  ) INTO v_has_pending_docs;

  -- Count required questions
  SELECT count(*) INTO v_total_required_questions
  FROM case_questions
  WHERE case_id = p_case_id AND is_required = true;

  -- Count answered required questions
  SELECT count(*) INTO v_answered_questions
  FROM case_questions q
  WHERE q.case_id = p_case_id AND q.is_required = true
    AND exists(SELECT 1 FROM case_answers a WHERE a.question_id = q.id);

  -- Unanswered required questions?
  v_has_unanswered_required := (v_answered_questions < v_total_required_questions);

  -- Final deliverables
  SELECT
    coalesce(irpf_file_url IS NOT NULL, false),
    coalesce(receipt_file_url IS NOT NULL, false),
    coalesce(sent_to_client, false)
  INTO v_has_irpf, v_has_receipt, v_sent_to_client
  FROM final_deliverables
  WHERE case_id = p_case_id;

  -- If no deliverable row exists
  IF NOT FOUND THEN
    v_has_irpf := false;
    v_has_receipt := false;
    v_sent_to_client := false;
  END IF;

  -- Calculate progress: docs (40%) + questions (30%) + deliverables (30%)
  v_total_items := 0;
  v_completed_items := 0;

  -- Docs portion (weight: 40)
  IF v_total_required_docs > 0 THEN
    v_total_items := v_total_items + 40;
    v_completed_items := v_completed_items + (40 * v_approved_docs / v_total_required_docs);
  ELSE
    -- No docs required = full credit
    v_total_items := v_total_items + 40;
    v_completed_items := v_completed_items + 40;
  END IF;

  -- Questions portion (weight: 30)
  IF v_total_required_questions > 0 THEN
    v_total_items := v_total_items + 30;
    v_completed_items := v_completed_items + (30 * v_answered_questions / v_total_required_questions);
  ELSE
    v_total_items := v_total_items + 30;
    v_completed_items := v_completed_items + 30;
  END IF;

  -- Deliverables portion (weight: 30)
  v_total_items := v_total_items + 30;
  IF v_has_irpf AND v_has_receipt AND v_sent_to_client THEN
    v_completed_items := v_completed_items + 30;
  ELSIF v_has_irpf AND v_has_receipt THEN
    v_completed_items := v_completed_items + 20;
  ELSIF v_has_irpf OR v_has_receipt THEN
    v_completed_items := v_completed_items + 10;
  END IF;

  -- Final percentage
  IF v_total_items > 0 THEN
    v_progress := (v_completed_items * 100) / v_total_items;
  ELSE
    v_progress := 0;
  END IF;

  -- Clamp
  IF v_progress > 100 THEN v_progress := 100; END IF;
  IF v_progress < 0 THEN v_progress := 0; END IF;

  -- Get current status
  SELECT status INTO v_current_status FROM irpf_cases WHERE id = p_case_id;

  -- Determine suggested new status (only auto-advance, never regress manually set statuses)
  v_new_status := v_current_status;

  IF v_has_irpf AND v_has_receipt AND v_sent_to_client THEN
    v_new_status := 'finalizado';
  ELSIF v_current_status = 'aguardando_cliente' AND v_any_doc_sent THEN
    v_new_status := 'documentos_em_analise';
  ELSIF v_current_status = 'documentos_em_analise'
    AND NOT v_has_pending_docs AND NOT v_has_unanswered_required THEN
    v_new_status := 'em_andamento';
  ELSIF v_current_status IN ('documentos_em_analise', 'em_andamento')
    AND (v_has_pending_docs OR v_has_unanswered_required) THEN
    v_new_status := 'pendencia';
  ELSIF v_current_status = 'pendencia'
    AND NOT v_has_pending_docs AND NOT v_has_unanswered_required THEN
    v_new_status := 'em_andamento';
  END IF;

  -- Update the case
  UPDATE irpf_cases
  SET progress_percent = v_progress,
      status = v_new_status
  WHERE id = p_case_id;
END;
$$;

-- Trigger function that calls recalc when related tables change
CREATE OR REPLACE FUNCTION public.trigger_recalc_case_progress()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case_id uuid;
BEGIN
  -- Determine case_id from the affected row
  IF TG_TABLE_NAME = 'document_requests' THEN
    v_case_id := coalesce(NEW.case_id, OLD.case_id);
  ELSIF TG_TABLE_NAME = 'uploaded_documents' THEN
    v_case_id := coalesce(NEW.case_id, OLD.case_id);
  ELSIF TG_TABLE_NAME = 'case_answers' THEN
    v_case_id := coalesce(NEW.case_id, OLD.case_id);
  ELSIF TG_TABLE_NAME = 'final_deliverables' THEN
    v_case_id := coalesce(NEW.case_id, OLD.case_id);
  END IF;

  IF v_case_id IS NOT NULL THEN
    PERFORM recalc_case_progress(v_case_id);
  END IF;

  RETURN coalesce(NEW, OLD);
END;
$$;

-- Create triggers on all relevant tables
CREATE TRIGGER trg_recalc_on_doc_requests
AFTER INSERT OR UPDATE OR DELETE ON document_requests
FOR EACH ROW EXECUTE FUNCTION trigger_recalc_case_progress();

CREATE TRIGGER trg_recalc_on_uploaded_documents
AFTER INSERT OR UPDATE OR DELETE ON uploaded_documents
FOR EACH ROW EXECUTE FUNCTION trigger_recalc_case_progress();

CREATE TRIGGER trg_recalc_on_case_answers
AFTER INSERT OR UPDATE OR DELETE ON case_answers
FOR EACH ROW EXECUTE FUNCTION trigger_recalc_case_progress();

CREATE TRIGGER trg_recalc_on_final_deliverables
AFTER INSERT OR UPDATE OR DELETE ON final_deliverables
FOR EACH ROW EXECUTE FUNCTION trigger_recalc_case_progress();
