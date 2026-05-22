-- 1. New enum values
ALTER TYPE case_status ADD VALUE IF NOT EXISTS 'retificando';
ALTER TYPE case_status ADD VALUE IF NOT EXISTS 'retificada';

-- 2. New fields on irpf_cases
ALTER TABLE public.irpf_cases
  ADD COLUMN IF NOT EXISTS retificacao_justificativa text,
  ADD COLUMN IF NOT EXISTS retificacao_iniciada_em timestamptz,
  ADD COLUMN IF NOT EXISTS retificacao_iniciada_por uuid REFERENCES auth.users(id);

-- 3. New field on final_deliverables
ALTER TABLE public.final_deliverables
  ADD COLUMN IF NOT EXISTS retificacao boolean NOT NULL DEFAULT false;

-- Remove the previous single-row-per-case implicit assumption by ensuring we can have two rows (original + retificadora). If a unique index exists on case_id, drop it.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.final_deliverables'::regclass
      AND contype = 'u'
  LOOP
    EXECUTE format('ALTER TABLE public.final_deliverables DROP CONSTRAINT %I', r.conname);
  END LOOP;
  FOR r IN
    SELECT indexname FROM pg_indexes
    WHERE schemaname='public' AND tablename='final_deliverables'
      AND indexdef ILIKE '%UNIQUE%(case_id)%'
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS public.%I', r.indexname);
  END LOOP;
END $$;

-- Ensure one row per (case_id, retificacao)
CREATE UNIQUE INDEX IF NOT EXISTS final_deliverables_case_retif_unique
  ON public.final_deliverables(case_id, retificacao);

-- 4. Adjust completed_at trigger to NOT fire for retificando/retificada
CREATE OR REPLACE FUNCTION public.set_case_completed_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.completed_at IS NULL
     AND NEW.status IN ('previa_enviada', 'finalizado') THEN
    NEW.completed_at := now();
  END IF;
  -- Preserve original completed_at when transitioning to retificando/retificada
  IF NEW.status IN ('retificando', 'retificada') AND OLD.completed_at IS NOT NULL THEN
    NEW.completed_at := OLD.completed_at;
  END IF;
  RETURN NEW;
END;
$function$;
