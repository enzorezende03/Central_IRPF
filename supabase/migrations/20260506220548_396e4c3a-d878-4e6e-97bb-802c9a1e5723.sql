CREATE TABLE public.irpf_weekly_plan (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  season_id uuid NOT NULL,
  week_number integer NOT NULL,
  case_id uuid NOT NULL,
  responsible text,
  planned_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT irpf_weekly_plan_unique UNIQUE (season_id, case_id)
);

CREATE INDEX idx_irpf_weekly_plan_season_week ON public.irpf_weekly_plan(season_id, week_number);
CREATE INDEX idx_irpf_weekly_plan_case ON public.irpf_weekly_plan(case_id);

ALTER TABLE public.irpf_weekly_plan ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth can manage weekly_plan"
  ON public.irpf_weekly_plan
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER set_updated_at_irpf_weekly_plan
  BEFORE UPDATE ON public.irpf_weekly_plan
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();