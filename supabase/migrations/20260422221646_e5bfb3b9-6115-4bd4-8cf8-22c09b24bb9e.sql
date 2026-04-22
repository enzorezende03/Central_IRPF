-- Quando uma nova pendência é registrada, mover automaticamente a demanda para o status "pendencia"
-- (exceto quando ela já estiver finalizada, dispensada ou impedida)

CREATE OR REPLACE FUNCTION public.auto_set_status_on_new_pendencia()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current_status case_status;
BEGIN
  SELECT status INTO v_current_status FROM irpf_cases WHERE id = NEW.case_id;

  IF v_current_status IS NULL THEN
    RETURN NEW;
  END IF;

  -- Não sobrescreve status terminais ou que indicam pausa intencional
  IF v_current_status IN ('finalizado', 'dispensada', 'impedida') THEN
    RETURN NEW;
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
$$;

DROP TRIGGER IF EXISTS trg_auto_set_status_on_new_pendencia ON public.case_pendencias;

CREATE TRIGGER trg_auto_set_status_on_new_pendencia
AFTER INSERT ON public.case_pendencias
FOR EACH ROW
EXECUTE FUNCTION public.auto_set_status_on_new_pendencia();