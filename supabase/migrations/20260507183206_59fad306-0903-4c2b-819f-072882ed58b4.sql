-- Expand access_profiles.permissions: replace editar_* with criar_/editar_/excluir_
UPDATE public.access_profiles
SET permissions = (
  SELECT array_agg(DISTINCT p) FROM (
    SELECT unnest(permissions) AS p
    UNION ALL
    SELECT 'criar_demandas' WHERE 'editar_demandas' = ANY(permissions)
    UNION ALL
    SELECT 'excluir_demandas' WHERE 'editar_demandas' = ANY(permissions)
    UNION ALL
    SELECT 'criar_cobranca' WHERE 'editar_cobranca' = ANY(permissions)
    UNION ALL
    SELECT 'excluir_cobranca' WHERE 'editar_cobranca' = ANY(permissions)
    UNION ALL
    SELECT 'criar_clientes' WHERE 'editar_demandas' = ANY(permissions)
    UNION ALL
    SELECT 'editar_clientes' WHERE 'editar_demandas' = ANY(permissions)
    UNION ALL
    SELECT 'excluir_clientes' WHERE 'editar_demandas' = ANY(permissions)
  ) sub
);

-- Expand user_permissions equivalently
INSERT INTO public.user_permissions (user_id, permission)
SELECT user_id, new_perm FROM (
  SELECT user_id, 'criar_demandas'::text AS new_perm FROM public.user_permissions WHERE permission = 'editar_demandas'
  UNION
  SELECT user_id, 'excluir_demandas' FROM public.user_permissions WHERE permission = 'editar_demandas'
  UNION
  SELECT user_id, 'criar_cobranca' FROM public.user_permissions WHERE permission = 'editar_cobranca'
  UNION
  SELECT user_id, 'excluir_cobranca' FROM public.user_permissions WHERE permission = 'editar_cobranca'
  UNION
  SELECT user_id, 'criar_clientes' FROM public.user_permissions WHERE permission = 'editar_demandas'
  UNION
  SELECT user_id, 'editar_clientes' FROM public.user_permissions WHERE permission = 'editar_demandas'
  UNION
  SELECT user_id, 'excluir_clientes' FROM public.user_permissions WHERE permission = 'editar_demandas'
) s
ON CONFLICT DO NOTHING;