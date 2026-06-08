
ALTER TABLE public.irpf_cases
  ADD COLUMN IF NOT EXISTS receita_situacao text
    CHECK (receita_situacao IS NULL OR receita_situacao IN (
      'aguardando','processada_restituicao','processada_a_pagar',
      'processada_sem_movimento','em_malha','malha_regularizada'
    )),
  ADD COLUMN IF NOT EXISTS receita_situacao_em timestamptz,
  ADD COLUMN IF NOT EXISTS receita_situacao_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS malha_motivo text,
  ADD COLUMN IF NOT EXISTS malha_status text
    CHECK (malha_status IS NULL OR malha_status IN (
      'em_analise','aguardando_documentacao','impugnacao_enviada','regularizada'
    ));

CREATE OR REPLACE FUNCTION public.clear_malha_fields_when_not_em_malha()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.receita_situacao IS DISTINCT FROM 'em_malha' THEN
    NEW.malha_motivo := NULL;
    NEW.malha_status := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clear_malha_fields ON public.irpf_cases;
CREATE TRIGGER trg_clear_malha_fields
BEFORE INSERT OR UPDATE OF receita_situacao ON public.irpf_cases
FOR EACH ROW EXECUTE FUNCTION public.clear_malha_fields_when_not_em_malha();
