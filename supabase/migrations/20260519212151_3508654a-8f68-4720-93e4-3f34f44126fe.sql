DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.irpf_cases WHERE deleted_at IS NULL LOOP
    PERFORM public.recalc_case_progress(r.id);
    PERFORM public.auto_update_client_status(r.id);
  END LOOP;
END $$;