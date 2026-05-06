
ALTER TABLE public.irpf_cases ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Backfill: usar updated_at para casos que já estão em previa_enviada/finalizado
UPDATE public.irpf_cases
SET completed_at = updated_at
WHERE completed_at IS NULL
  AND status IN ('previa_enviada', 'finalizado');

-- Trigger para gravar uma única vez
CREATE OR REPLACE FUNCTION public.set_case_completed_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.completed_at IS NULL
     AND NEW.status IN ('previa_enviada', 'finalizado') THEN
    NEW.completed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_case_completed_at ON public.irpf_cases;
CREATE TRIGGER trg_set_case_completed_at
BEFORE INSERT OR UPDATE OF status ON public.irpf_cases
FOR EACH ROW
EXECUTE FUNCTION public.set_case_completed_at();
