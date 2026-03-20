ALTER TABLE public.irpf_cases ADD COLUMN portal_slug text;

CREATE UNIQUE INDEX idx_irpf_cases_portal_slug ON public.irpf_cases (portal_slug) WHERE portal_slug IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_case_by_slug(p_slug text)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$ SELECT id FROM public.irpf_cases WHERE portal_slug = p_slug LIMIT 1; $$;