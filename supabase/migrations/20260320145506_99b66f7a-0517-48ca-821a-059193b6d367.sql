
-- Add missing upload policy for declaracoes_finais
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon can upload declaracoes_finais' AND tablename = 'objects') THEN
    CREATE POLICY "Anon can upload declaracoes_finais" ON storage.objects FOR INSERT TO anon WITH CHECK (bucket_id = 'declaracoes_finais');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon can update declaracoes_finais' AND tablename = 'objects') THEN
    CREATE POLICY "Anon can update declaracoes_finais" ON storage.objects FOR UPDATE TO anon USING (bucket_id = 'declaracoes_finais');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon can upload recibos_entrega' AND tablename = 'objects') THEN
    CREATE POLICY "Anon can upload recibos_entrega" ON storage.objects FOR INSERT TO anon WITH CHECK (bucket_id = 'recibos_entrega');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon can read recibos_entrega' AND tablename = 'objects') THEN
    CREATE POLICY "Anon can read recibos_entrega" ON storage.objects FOR SELECT TO anon USING (bucket_id = 'recibos_entrega');
  END IF;
END $$;
