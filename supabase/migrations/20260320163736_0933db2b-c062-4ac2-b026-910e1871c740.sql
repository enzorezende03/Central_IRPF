CREATE TABLE public.office_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  cnpj text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  logo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.office_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth can view office_settings" ON public.office_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage office_settings" ON public.office_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_office_settings_updated_at BEFORE UPDATE ON public.office_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

INSERT INTO public.office_settings (name) VALUES ('');