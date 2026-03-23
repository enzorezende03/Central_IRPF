
-- Function to auto-update client-facing status based on workflow state
CREATE OR REPLACE FUNCTION public.auto_update_client_status(p_case_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_docs int;
  v_pending_docs int;
  v_all_approved boolean;
  v_has_preview boolean;
  v_has_final boolean;
  v_current_status text;
BEGIN
  -- Get current status
  SELECT status INTO v_current_status FROM irpf_cases WHERE id = p_case_id;
  
  -- Count document states
  SELECT 
    count(*),
    count(*) FILTER (WHERE status IN ('pendente', 'rejeitado')),
    (count(*) > 0 AND count(*) FILTER (WHERE status NOT IN ('aprovado')) = 0)
  INTO v_total_docs, v_pending_docs, v_all_approved
  FROM document_requests
  WHERE case_id = p_case_id;

  -- Check if preview exists and was sent
  SELECT 
    (preview_file_url IS NOT NULL) 
  INTO v_has_preview
  FROM final_deliverables
  WHERE case_id = p_case_id;

  -- Check if final declaration exists and was sent to client
  SELECT 
    (irpf_file_url IS NOT NULL AND sent_to_client = true)
  INTO v_has_final
  FROM final_deliverables
  WHERE case_id = p_case_id;

  -- Determine new status based on workflow rules
  -- Priority: finalizado > prévia enviada (pendencia) > em_andamento > documentos_em_analise > aguardando_cliente
  IF COALESCE(v_has_final, false) THEN
    UPDATE irpf_cases SET status = 'finalizado', updated_at = now() WHERE id = p_case_id AND status != 'finalizado';
  ELSIF COALESCE(v_has_preview, false) THEN
    UPDATE irpf_cases SET status = 'pendencia', updated_at = now() WHERE id = p_case_id AND status != 'pendencia';
  ELSIF v_total_docs > 0 AND COALESCE(v_all_approved, false) THEN
    UPDATE irpf_cases SET status = 'em_andamento', updated_at = now() WHERE id = p_case_id AND status NOT IN ('em_andamento', 'pendencia', 'finalizado');
  ELSIF v_total_docs > 0 AND v_pending_docs = 0 THEN
    -- All docs sent (enviado or aprovado), but not all approved yet
    UPDATE irpf_cases SET status = 'documentos_em_analise', updated_at = now() WHERE id = p_case_id AND status NOT IN ('documentos_em_analise', 'em_andamento', 'pendencia', 'finalizado');
  ELSE
    -- Still has pending docs or no docs at all
    UPDATE irpf_cases SET status = 'aguardando_cliente', updated_at = now() WHERE id = p_case_id AND status NOT IN ('aguardando_cliente');
  END IF;
END;
$$;

-- Trigger function for document_requests changes
CREATE OR REPLACE FUNCTION public.trg_doc_status_update_client_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM auto_update_client_status(COALESCE(NEW.case_id, OLD.case_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger function for final_deliverables changes
CREATE OR REPLACE FUNCTION public.trg_deliverable_update_client_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM auto_update_client_status(COALESCE(NEW.case_id, OLD.case_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Drop existing triggers if any
DROP TRIGGER IF EXISTS trg_auto_client_status_on_doc ON document_requests;
DROP TRIGGER IF EXISTS trg_auto_client_status_on_deliverable ON final_deliverables;

-- Create triggers
CREATE TRIGGER trg_auto_client_status_on_doc
  AFTER INSERT OR UPDATE OR DELETE ON document_requests
  FOR EACH ROW
  EXECUTE FUNCTION trg_doc_status_update_client_status();

CREATE TRIGGER trg_auto_client_status_on_deliverable
  AFTER INSERT OR UPDATE ON final_deliverables
  FOR EACH ROW
  EXECUTE FUNCTION trg_deliverable_update_client_status();

-- Recalculate all existing cases
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM irpf_cases LOOP
    PERFORM auto_update_client_status(r.id);
  END LOOP;
END;
$$;
