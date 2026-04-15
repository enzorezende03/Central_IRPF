CREATE OR REPLACE FUNCTION public.auto_reopen_on_client_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.sender = 'client' THEN
    UPDATE irpf_cases
    SET status = 'em_andamento', updated_at = now()
    WHERE id = NEW.case_id
      AND status = 'impedida';

    IF FOUND THEN
      INSERT INTO case_timeline (case_id, event_type, description, visible_to_client, created_by)
      VALUES (
        NEW.case_id,
        'Impedimento resolvido',
        'Demanda retornou automaticamente para Em Andamento após mensagem do cliente',
        false,
        'sistema'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;