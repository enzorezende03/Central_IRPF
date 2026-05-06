-- Corrige completed_at para refletir a data real em que a prévia/entrega foi anexada
-- (final_deliverables.uploaded_at), e não a última atualização da demanda.
UPDATE public.irpf_cases c
SET completed_at = fd.uploaded_at
FROM public.final_deliverables fd
WHERE fd.case_id = c.id
  AND c.status IN ('previa_enviada', 'finalizado')
  AND fd.uploaded_at IS NOT NULL
  AND (c.completed_at IS NULL OR c.completed_at <> fd.uploaded_at);