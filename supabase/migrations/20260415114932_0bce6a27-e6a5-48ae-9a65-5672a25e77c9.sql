
-- Update status from internal_status where they differ
UPDATE irpf_cases SET status = internal_status::case_status WHERE status::text != internal_status;

-- Drop trigger and function with CASCADE
DROP TRIGGER IF EXISTS trg_sync_internal_status ON irpf_cases;
DROP FUNCTION IF EXISTS public.sync_internal_status() CASCADE;

-- Drop internal_status column
ALTER TABLE irpf_cases DROP COLUMN internal_status;

-- Update auto_update_client_status
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
  FROM final_deliverables WHERE case_id = p_case_id;
  IF NOT FOUND THEN v_has_preview := false; v_has_final := false; END IF;

  SELECT status::text INTO v_current_status FROM irpf_cases WHERE id = p_case_id;
  IF v_current_status IN ('impedida', 'dispensada') THEN RETURN; END IF;

  IF v_has_final THEN
    UPDATE irpf_cases SET status = 'finalizado', updated_at = now() WHERE id = p_case_id AND status != 'finalizado';
  ELSIF v_has_preview THEN
    UPDATE irpf_cases SET status = 'pendencia', updated_at = now() WHERE id = p_case_id AND status != 'pendencia';
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

-- Update auto_reopen_on_client_message
CREATE OR REPLACE FUNCTION public.auto_reopen_on_client_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.sender = 'client' THEN
    UPDATE irpf_cases SET status = 'reaberta', updated_at = now()
    WHERE id = NEW.case_id AND status = 'impedida';
    IF FOUND THEN
      INSERT INTO case_timeline (case_id, event_type, description, visible_to_client, created_by)
      VALUES (NEW.case_id, 'Demanda reaberta', 'Demanda reaberta automaticamente após mensagem do cliente', false, 'sistema');
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
