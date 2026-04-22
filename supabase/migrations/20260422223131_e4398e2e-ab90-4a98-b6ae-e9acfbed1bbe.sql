-- Trigger: ao definir preview_file_url, mover status da demanda para 'previa_enviada'
CREATE OR REPLACE FUNCTION public.auto_set_status_on_preview()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current_status case_status;
BEGIN
  SELECT status INTO v_current_status FROM irpf_cases WHERE id = NEW.case_id;
  IF v_current_status IS NULL THEN RETURN NEW; END IF;

  -- Não mexer em estados terminais ou bloqueados
  IF v_current_status IN ('finalizado', 'dispensada', 'impedida') THEN
    RETURN NEW;
  END IF;

  -- Caso 1: prévia foi anexada / atualizada e ainda não está aprovada
  IF NEW.preview_file_url IS NOT NULL
     AND COALESCE(NEW.preview_status::text, '') <> 'aprovado'
     AND v_current_status <> 'previa_enviada' THEN
    UPDATE irpf_cases
       SET status = 'previa_enviada', updated_at = now()
     WHERE id = NEW.case_id;

    INSERT INTO case_timeline (case_id, event_type, description, visible_to_client, created_by)
    VALUES (NEW.case_id, 'Status alterado',
            'Demanda movida para "Prévia Enviada" após envio da prévia ao cliente',
            false, 'sistema');
  END IF;

  -- Caso 2: prévia foi aprovada → volta para 'em_andamento' para finalizar
  IF NEW.preview_status::text = 'aprovado'
     AND COALESCE(OLD.preview_status::text, '') <> 'aprovado'
     AND v_current_status = 'previa_enviada' THEN
    UPDATE irpf_cases
       SET status = 'em_andamento', updated_at = now()
     WHERE id = NEW.case_id;

    INSERT INTO case_timeline (case_id, event_type, description, visible_to_client, created_by)
    VALUES (NEW.case_id, 'Status alterado',
            'Prévia aprovada pelo cliente — demanda voltou para "Em Andamento" para finalização',
            false, 'sistema');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_set_status_on_preview_ins ON public.final_deliverables;
DROP TRIGGER IF EXISTS trg_auto_set_status_on_preview_upd ON public.final_deliverables;

CREATE TRIGGER trg_auto_set_status_on_preview_ins
AFTER INSERT ON public.final_deliverables
FOR EACH ROW EXECUTE FUNCTION public.auto_set_status_on_preview();

CREATE TRIGGER trg_auto_set_status_on_preview_upd
AFTER UPDATE OF preview_file_url, preview_status ON public.final_deliverables
FOR EACH ROW EXECUTE FUNCTION public.auto_set_status_on_preview();

-- Atualização retroativa: demandas que já tem prévia enviada e ainda não aprovada
UPDATE irpf_cases c
SET status = 'previa_enviada', updated_at = now()
FROM final_deliverables fd
WHERE fd.case_id = c.id
  AND fd.preview_file_url IS NOT NULL
  AND COALESCE(fd.preview_status::text, '') <> 'aprovado'
  AND c.status NOT IN ('finalizado', 'dispensada', 'impedida', 'previa_enviada');
