
-- Add timestamp to track when all docs were received
ALTER TABLE public.irpf_cases ADD COLUMN IF NOT EXISTS docs_received_at timestamp with time zone;

-- Update the auto_update_client_status function
CREATE OR REPLACE FUNCTION public.auto_update_client_status(p_case_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total_docs int;
  v_pending_docs int;
  v_sent_not_approved int;
  v_all_sent boolean;
  v_all_approved boolean;
  v_has_preview boolean;
  v_has_final boolean;
  v_current_internal_status text;
BEGIN
  -- Count document states
  SELECT 
    count(*),
    count(*) FILTER (WHERE status IN ('pendente', 'rejeitado')),
    count(*) FILTER (WHERE status = 'enviado'),
    (count(*) > 0 AND count(*) FILTER (WHERE status IN ('pendente', 'rejeitado')) = 0),
    (count(*) > 0 AND count(*) FILTER (WHERE status != 'aprovado') = 0)
  INTO v_total_docs, v_pending_docs, v_sent_not_approved, v_all_sent, v_all_approved
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

  -- Get current internal status to avoid overwriting impedida/dispensada
  SELECT internal_status INTO v_current_internal_status
  FROM irpf_cases WHERE id = p_case_id;

  -- Don't touch impedida or dispensada
  IF v_current_internal_status IN ('impedida', 'dispensada') THEN
    RETURN;
  END IF;

  -- Workflow: finalizado > prévia enviada > em_andamento > documentos_em_analise > documentos_parciais > aguardando_cliente
  IF v_has_final THEN
    UPDATE irpf_cases SET status = 'finalizado', internal_status = 'finalizado', updated_at = now() WHERE id = p_case_id AND status != 'finalizado';
  ELSIF v_has_preview THEN
    UPDATE irpf_cases SET status = 'pendencia', internal_status = 'pendencia', updated_at = now() WHERE id = p_case_id AND status != 'pendencia';
  ELSIF v_total_docs > 0 AND v_all_approved THEN
    UPDATE irpf_cases SET status = 'em_andamento', internal_status = 'em_andamento', updated_at = now() WHERE id = p_case_id AND status NOT IN ('em_andamento', 'pendencia', 'finalizado');
  ELSIF v_total_docs > 0 AND v_all_sent THEN
    -- ALL docs sent (enviado or aprovado) → documentos_em_analise
    UPDATE irpf_cases 
    SET status = 'documentos_em_analise', 
        internal_status = 'documentos_em_analise',
        docs_received_at = COALESCE(docs_received_at, now()),
        updated_at = now()
    WHERE id = p_case_id
      AND status NOT IN ('documentos_em_analise', 'em_andamento', 'pendencia', 'finalizado');
  ELSIF v_total_docs > 0 AND v_pending_docs < v_total_docs AND v_pending_docs > 0 THEN
    -- Some docs sent but not all → documentos_parciais (internal only, client sees aguardando_cliente)
    UPDATE irpf_cases 
    SET status = 'aguardando_cliente',
        internal_status = 'documentos_parciais',
        updated_at = now()
    WHERE id = p_case_id
      AND internal_status NOT IN ('documentos_parciais', 'documentos_em_analise', 'em_andamento', 'pendencia', 'finalizado');
  ELSE
    UPDATE irpf_cases SET status = 'aguardando_cliente', internal_status = 'aguardando_cliente', updated_at = now() WHERE id = p_case_id AND status NOT IN ('aguardando_cliente');
  END IF;
END;
$function$;
