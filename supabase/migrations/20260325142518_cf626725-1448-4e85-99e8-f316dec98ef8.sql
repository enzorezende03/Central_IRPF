
CREATE OR REPLACE FUNCTION public.sync_internal_status()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.internal_status := NEW.status::text;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_internal_status
  BEFORE UPDATE OF status ON public.irpf_cases
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_internal_status();
