-- Trigger: when a client sends a message on an "impedida" case, auto-set to "reaberta"
CREATE OR REPLACE FUNCTION public.auto_reopen_on_client_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.sender = 'client' THEN
    UPDATE irpf_cases
    SET internal_status = 'reaberta', updated_at = now()
    WHERE id = NEW.case_id
      AND internal_status = 'impedida';

    -- Log timeline event if status was changed
    IF FOUND THEN
      INSERT INTO case_timeline (case_id, event_type, description, visible_to_client, created_by)
      VALUES (NEW.case_id, 'Demanda reaberta', 'Demanda reaberta automaticamente após mensagem do cliente', false, 'sistema');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_reopen_on_message
AFTER INSERT ON public.case_messages
FOR EACH ROW
EXECUTE FUNCTION public.auto_reopen_on_client_message();