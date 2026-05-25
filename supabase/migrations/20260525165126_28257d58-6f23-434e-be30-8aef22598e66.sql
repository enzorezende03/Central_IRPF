
-- 1) Esconder colunas sensíveis de irpf_cases para o role anon (portal passwordless)
REVOKE SELECT (portal_token, internal_notes) ON public.irpf_cases FROM anon;

-- 2) Impedir spoofing de remetente em case_messages via portal
DROP POLICY IF EXISTS "Anon can insert messages" ON public.case_messages;
CREATE POLICY "Anon can insert messages"
  ON public.case_messages
  FOR INSERT
  TO anon
  WITH CHECK (sender = 'client' AND visible_to_client = true);

-- 3) Remover inserção anônima de cobrança
DROP POLICY IF EXISTS "Anon can insert billing" ON public.billing;
