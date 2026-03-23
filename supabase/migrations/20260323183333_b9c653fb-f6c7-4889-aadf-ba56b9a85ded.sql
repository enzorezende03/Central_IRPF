
CREATE OR REPLACE FUNCTION public.auto_update_client_status(p_case_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_docs int;
  v_pending_docs int;
  v_sent_not_approved int;
  v_all_approved boolean;
  v_has_preview boolean;
  v_has_final boolean;
BEGIN
  -- Count document states
  SELECT 
    count(*),
    count(*) FILTER (WHERE status IN ('pendente', 'rejeitado')),
    count(*) FILTER (WHERE status = 'enviado'),
    (count(*) > 0 AND count(*) FILTER (WHERE status != 'aprovado') = 0)
  INTO v_total_docs, v_pending_docs, v_sent_not_approved, v_all_approved
  FROM document_requests
  WHERE case_id = p_case_id;

  -- Check deliverables
  SELECT 
    COALESCE(preview_file_url IS NOT NULL, false),
    COALESCE(irpf_file_url IS NOT NULL AND sent_to_client = true, false)
  INTO v_has_preview, v_has_final
  FROM final_deliverables
  WHERE case_id = p_case_id;

  IF NOT FOUND THEN
    v_has_preview := false;
    v_has_final := false;
  END IF;

  -- Workflow: finalizado > prévia enviada > em_andamento > documentos_em_analise > aguardando_cliente
  IF v_has_final THEN
    UPDATE irpf_cases SET status = 'finalizado', updated_at = now() WHERE id = p_case_id AND status != 'finalizado';
  ELSIF v_has_preview THEN
    UPDATE irpf_cases SET status = 'pendencia', updated_at = now() WHERE id = p_case_id AND status != 'pendencia';
  ELSIF v_total_docs > 0 AND v_all_approved THEN
    -- ALL docs approved by team → em_andamento
    UPDATE irpf_cases SET status = 'em_andamento', updated_at = now() WHERE id = p_case_id AND status NOT IN ('em_andamento', 'pendencia', 'finalizado');
  ELSIF v_total_docs > 0 AND v_pending_docs = 0 THEN
    -- No pending docs but some still "enviado" (awaiting approval) → documentos_em_analise
    UPDATE irpf_cases SET status = 'documentos_em_analise', updated_at = now() WHERE id = p_case_id AND status NOT IN ('documentos_em_analise', 'em_andamento', 'pendencia', 'finalizado');
  ELSE
    -- Still has pending/rejected docs
    UPDATE irpf_cases SET status = 'aguardando_cliente', updated_at = now() WHERE id = p_case_id AND status NOT IN ('aguardando_cliente');
  END IF;
END;
$$;

-- Recalculate all existing cases
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM irpf_cases LOOP
    PERFORM auto_update_client_status(r.id);
  END LOOP;
END;
$$;
