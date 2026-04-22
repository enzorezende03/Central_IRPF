-- Tabela de configuração da temporada (uma por ano)
CREATE TABLE public.irpf_season_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  season_year integer NOT NULL UNIQUE,
  start_date date NOT NULL,
  deadline_date date NOT NULL,
  total_planned integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.irpf_season_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth can manage season_config"
  ON public.irpf_season_config
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE TRIGGER trg_season_config_updated
  BEFORE UPDATE ON public.irpf_season_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de metas semanais
CREATE TABLE public.irpf_weekly_goals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  season_id uuid NOT NULL REFERENCES public.irpf_season_config(id) ON DELETE CASCADE,
  week_number integer NOT NULL,
  week_start date NOT NULL,
  week_end date NOT NULL,
  goal_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (season_id, week_number)
);

ALTER TABLE public.irpf_weekly_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth can manage weekly_goals"
  ON public.irpf_weekly_goals
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE TRIGGER trg_weekly_goals_updated
  BEFORE UPDATE ON public.irpf_weekly_goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_weekly_goals_season ON public.irpf_weekly_goals(season_id);
CREATE INDEX idx_season_config_year ON public.irpf_season_config(season_year);