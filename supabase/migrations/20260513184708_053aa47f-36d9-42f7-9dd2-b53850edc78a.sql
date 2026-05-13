CREATE TABLE IF NOT EXISTS public.weekly_capacity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  responsible text NOT NULL UNIQUE,
  capacity int NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.weekly_capacity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth can view weekly_capacity"
  ON public.weekly_capacity FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins manage weekly_capacity"
  ON public.weekly_capacity FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_weekly_capacity_updated
  BEFORE UPDATE ON public.weekly_capacity
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();