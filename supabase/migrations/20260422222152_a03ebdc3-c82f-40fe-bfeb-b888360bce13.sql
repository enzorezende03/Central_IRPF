-- Recria a função (idempotente)
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

-- Recria o trigger garantindo que existe
DROP TRIGGER IF EXISTS trg_auto_set_status_on_new_pendencia ON public.case_pendencias;

CREATE TRIGGER trg_auto_set_status_on_new_pendencia
AFTER INSERT ON public.case_pendencias
FOR EACH ROW
EXECUTE FUNCTION public.auto_set_status_on_new_pendencia();

-- Aplica a regra retroativamente para demandas que já têm pendências abertas
WITH casos_alvo AS (
  SELECT DISTINCT p.case_id
  FROM public.case_pendencias p
  JOIN public.irpf_cases c ON c.id = p.case_id
  WHERE p.status = 'aberta'
    AND c.status NOT IN ('finalizado', 'dispensada', 'impedida', 'pendencia')
)
UPDATE public.irpf_cases c
SET status = 'pendencia', updated_at = now()
FROM casos_alvo
WHERE c.id = casos_alvo.case_id;

INSERT INTO public.case_timeline (case_id, event_type, description, visible_to_client, created_by)
SELECT DISTINCT p.case_id, 'Status alterado',
  'Demanda movida para "Pendência" (ajuste retroativo: já existia pendência aberta)',
  false, 'sistema'
FROM public.case_pendencias p
JOIN public.irpf_cases c ON c.id = p.case_id
WHERE p.status = 'aberta' AND c.status = 'pendencia'
  AND NOT EXISTS (
    SELECT 1 FROM public.case_timeline t
    WHERE t.case_id = p.case_id
      AND t.event_type = 'Status alterado'
      AND t.created_by = 'sistema'
      AND t.created_at > now() - interval '5 minutes'
  );