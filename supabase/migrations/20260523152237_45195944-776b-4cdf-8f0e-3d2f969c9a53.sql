CREATE OR REPLACE FUNCTION public.get_last_client_uploads()
RETURNS TABLE(case_id uuid, last_uploaded_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT case_id, MAX(uploaded_at) AS last_uploaded_at
  FROM public.uploaded_documents
  WHERE uploaded_by = 'client'
  GROUP BY case_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_last_client_uploads() TO authenticated;