CREATE OR REPLACE FUNCTION public.auto_set_status_on_preview()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current_status case_status;
BEGIN
  SELECT status INTO v_current_status FROM irpf_cases WHERE id = NEW.case_id;
  IF v_current_status IS NULL THEN RETURN NEW; END IF;

  IF v_current_status IN ('finalizado', 'dispensada', 'impedida') THEN
    RETURN NEW;
  END IF;

  -- Caso 1: prévia anexada/atualizada e ainda não aprovada
  IF NEW.preview_file_url IS NOT NULL
     AND COALESCE(NEW.preview_status::text, '') <> 'aprovado'
     AND v_current_status NOT IN ('previa_enviada', 'previa_aprovada') THEN
    UPDATE irpf_cases
       SET status = 'previa_enviada', updated_at = now()
     WHERE id = NEW.case_id;

    INSERT INTO case_timeline (case_id, event_type, description, visible_to_client, created_by)
    VALUES (NEW.case_id, 'Status alterado',
            'Demanda movida para "Prévia Enviada" após envio da prévia ao cliente',
            false, 'sistema');
  END IF;

  -- Caso 2: prévia aprovada → status "Prévia Aprovada"
  IF NEW.preview_status::text = 'aprovado'
     AND COALESCE(OLD.preview_status::text, '') <> 'aprovado'
     AND v_current_status <> 'previa_aprovada'
     AND v_current_status <> 'finalizado' THEN
    UPDATE irpf_cases
       SET status = 'previa_aprovada', updated_at = now()
     WHERE id = NEW.case_id;

    INSERT INTO case_timeline (case_id, event_type, description, visible_to_client, created_by)
    VALUES (NEW.case_id, 'Status alterado',
            'Prévia aprovada — demanda movida para "Prévia Aprovada"',
            false, 'sistema');
  END IF;

  -- Caso 3: aprovação cancelada → volta para "Prévia Enviada" se ainda houver arquivo
  IF COALESCE(OLD.preview_status::text, '') = 'aprovado'
     AND COALESCE(NEW.preview_status::text, '') <> 'aprovado'
     AND NEW.preview_file_url IS NOT NULL
     AND v_current_status = 'previa_aprovada' THEN
    UPDATE irpf_cases
       SET status = 'previa_enviada', updated_at = now()
     WHERE id = NEW.case_id;

    INSERT INTO case_timeline (case_id, event_type, description, visible_to_client, created_by)
    VALUES (NEW.case_id, 'Status alterado',
            'Aprovação da prévia cancelada — demanda voltou para "Prévia Enviada"',
            false, 'sistema');
  END IF;

  RETURN NEW;
END;
$function$;

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
  IF v_current_status IN ('impedida', 'dispensada', 'previa_enviada', 'previa_aprovada') THEN RETURN; END IF;

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