UPDATE public.irpf_cases c
SET status = 'previa_aprovada', updated_at = now()
FROM public.final_deliverables fd
WHERE fd.case_id = c.id
  AND fd.preview_status = 'aprovado'
  AND c.status NOT IN ('finalizado', 'previa_aprovada')
  AND c.deleted_at IS NULL;