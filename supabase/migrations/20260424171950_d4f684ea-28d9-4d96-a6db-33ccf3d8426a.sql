-- Fix 1: auto_update_client_status should NOT downgrade 'previa_enviada' back to 'pendencia'
-- Add 'previa_enviada' to the protected statuses (along with finalizado/dispensada/impedida)
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
  -- Estados protegidos: não rebaixar automaticamente
  IF v_current_status IN ('impedida', 'dispensada', 'previa_enviada') THEN RETURN; END IF;

  IF v_has_final THEN
    UPDATE irpf_cases SET status = 'finalizado', updated_at = now() WHERE id = p_case_id AND status != 'finalizado';
  ELSIF v_has_preview THEN
    -- Mantém em previa_enviada (não cai para pendencia)
    UPDATE irpf_cases SET status = 'previa_enviada', updated_at = now() WHERE id = p_case_id AND status NOT IN ('previa_enviada', 'finalizado');
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

-- Fix 2: auto_set_status_on_new_pendencia should only override 'previa_enviada'
-- if the pendencia was created AFTER the preview was sent
CREATE OR REPLACE FUNCTION public.auto_set_status_on_new_pendencia()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current_status case_status;
  v_preview_uploaded_at timestamptz;
BEGIN
  SELECT status INTO v_current_status FROM irpf_cases WHERE id = NEW.case_id;

  IF v_current_status IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_current_status IN ('finalizado', 'dispensada', 'impedida') THEN
    RETURN NEW;
  END IF;

  -- Se a demanda está em "previa_enviada", só rebaixa para pendência se a
  -- pendência foi criada APÓS o envio/atualização da prévia.
  IF v_current_status = 'previa_enviada' THEN
    SELECT uploaded_at INTO v_preview_uploaded_at
    FROM final_deliverables
    WHERE case_id = NEW.case_id;

    IF v_preview_uploaded_at IS NULL OR NEW.created_at <= v_preview_uploaded_at THEN
      -- Pendência anterior à prévia: não muda o status
      RETURN NEW;
    END IF;
  END IF;

  IF v_current_status <> 'pendencia' THEN
    UPDATE irpf_cases
       SET status = 'pendencia',
           updated_at = now()
     WHERE id = NEW.case_id;

    INSERT INTO case_timeline (case_id, event_type, description, visible_to_client, created_by)
    VALUES (
      NEW.case_id,
      'Status alterado',
      'Demanda movida para "Pendência" após registro de nova pendência ao cliente',
      false,
      'sistema'
    );
  END IF;

  RETURN NEW;
END;
$function$;