
ALTER TYPE case_status ADD VALUE IF NOT EXISTS 'pendencia_respondida';

CREATE OR REPLACE FUNCTION public.auto_set_status_on_pendencia_response()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current_status case_status;
BEGIN
  -- Só age quando uma pendência aberta é resolvida COM resposta do cliente
  IF TG_OP = 'UPDATE'
     AND OLD.status = 'aberta'
     AND NEW.status = 'resolvida'
     AND NEW.client_response IS NOT NULL
     AND length(trim(NEW.client_response)) > 0 THEN

    SELECT status INTO v_current_status FROM irpf_cases WHERE id = NEW.case_id;

    IF v_current_status IS NOT NULL
       AND v_current_status NOT IN ('finalizado', 'dispensada', 'impedida') THEN
      UPDATE irpf_cases
         SET status = 'pendencia_respondida', updated_at = now()
       WHERE id = NEW.case_id;

      INSERT INTO case_timeline (case_id, event_type, description, visible_to_client, created_by)
      VALUES (
        NEW.case_id,
        'Status alterado',
        'Demanda movida para "Pendência Respondida" após retorno do cliente',
        false,
        'sistema'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pendencia_response_status ON public.case_pendencias;
CREATE TRIGGER trg_pendencia_response_status
AFTER UPDATE ON public.case_pendencias
FOR EACH ROW
EXECUTE FUNCTION public.auto_set_status_on_pendencia_response();
