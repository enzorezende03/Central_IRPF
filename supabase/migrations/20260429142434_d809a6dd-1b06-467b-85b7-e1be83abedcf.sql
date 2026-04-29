CREATE UNIQUE INDEX IF NOT EXISTS irpf_cases_unique_client_year
ON public.irpf_cases (client_id, base_year)
WHERE status <> 'dispensada';