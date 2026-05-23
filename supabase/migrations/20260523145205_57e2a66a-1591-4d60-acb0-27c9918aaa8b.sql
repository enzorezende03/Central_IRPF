
-- 1) Remove duplicate anon INSERT policy on case_timeline (keep only one)
DROP POLICY IF EXISTS "Anon can insert timeline" ON public.case_timeline;

-- 2) Lock down SECURITY DEFINER helper functions that should NEVER be callable from the API.
--    These are invoked internally by triggers (which bypass RLS) or by other definer functions,
--    so revoking EXECUTE from anon/authenticated does not affect application behavior.
REVOKE EXECUTE ON FUNCTION public.auto_reopen_on_client_message() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_recalc_case_progress() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_doc_status_update_client_status() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_deliverable_update_client_status() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_update_client_status(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_pendencia_timeline() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_set_status_on_preview() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_portal_token() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalc_case_progress(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_set_status_on_new_pendencia() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_set_status_on_pendencia_response() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_case_completed_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_access_profile_permissions() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_user_role_profile_permissions() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated;

-- Keep these executable as they are used at runtime:
--   has_role(uuid, app_role)        — referenced by RLS policies (authenticated)
--   get_case_by_token(text)         — used by the passwordless client portal (anon)
--   get_case_by_slug(text)          — used by the passwordless client portal (anon)
