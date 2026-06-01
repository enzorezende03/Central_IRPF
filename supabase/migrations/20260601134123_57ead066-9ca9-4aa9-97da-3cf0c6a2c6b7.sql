-- Restrict anon SELECT on irpf_cases to only the row matching the portal token/slug header
DROP POLICY IF EXISTS "Portal anon access cases" ON public.irpf_cases;
CREATE POLICY "Portal anon access own case"
ON public.irpf_cases
FOR SELECT
TO anon
USING (public.case_matches_portal_token(id));

-- Restrict anon SELECT on billing to only the case matching the portal token
DROP POLICY IF EXISTS "Anon can view billing" ON public.billing;
CREATE POLICY "Anon can view own case billing"
ON public.billing
FOR SELECT
TO anon
USING (public.case_matches_portal_token(case_id));