
CREATE TABLE public.case_pendencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','resolvida')),
  client_response text,
  resolved_at timestamptz,
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_case_pendencias_case_id ON public.case_pendencias(case_id);
CREATE INDEX idx_case_pendencias_status ON public.case_pendencias(status);

ALTER TABLE public.case_pendencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth can manage case_pendencias"
ON public.case_pendencias FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE POLICY "Anon can view case_pendencias"
ON public.case_pendencias FOR SELECT TO anon
USING (true);

CREATE POLICY "Anon can update case_pendencias"
ON public.case_pendencias FOR UPDATE TO anon
USING (true) WITH CHECK (true);

CREATE TRIGGER trg_case_pendencias_updated_at
BEFORE UPDATE ON public.case_pendencias
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.log_pendencia_timeline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO case_timeline (case_id, event_type, description, visible_to_client, created_by)
    VALUES (
      NEW.case_id,
      'Nova pendência',
      'Pendência registrada: ' || NEW.title,
      true,
      COALESCE(NEW.created_by_name, 'Equipe')
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'aberta' AND NEW.status = 'resolvida' THEN
    INSERT INTO case_timeline (case_id, event_type, description, visible_to_client, created_by)
    VALUES (
      NEW.case_id,
      'Pendência resolvida',
      'Pendência "' || NEW.title || '" marcada como resolvida' ||
        CASE WHEN NEW.client_response IS NOT NULL AND length(trim(NEW.client_response)) > 0
             THEN '. Resposta: ' || NEW.client_response
             ELSE '' END,
      true,
      'Cliente'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_case_pendencias_timeline
AFTER INSERT OR UPDATE ON public.case_pendencias
FOR EACH ROW EXECUTE FUNCTION public.log_pendencia_timeline();
