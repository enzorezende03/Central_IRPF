
-- Add preview declaration columns to final_deliverables
CREATE TYPE public.preview_status AS ENUM ('aguardando_revisao', 'aprovado', 'ajustes_solicitados');

ALTER TABLE public.final_deliverables 
  ADD COLUMN preview_file_url text,
  ADD COLUMN preview_status public.preview_status DEFAULT 'aguardando_revisao',
  ADD COLUMN preview_feedback text;

-- Allow anon to update final_deliverables (for client to approve/request adjustments)
CREATE POLICY "Anon can update final_deliverables"
  ON public.final_deliverables FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);

-- Allow anon to insert final_deliverables
CREATE POLICY "Anon can insert final_deliverables"
  ON public.final_deliverables FOR INSERT TO anon
  WITH CHECK (true);
