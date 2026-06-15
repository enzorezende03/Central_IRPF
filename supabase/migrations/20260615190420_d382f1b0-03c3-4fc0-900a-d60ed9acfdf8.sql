ALTER TABLE public.final_deliverables
  ADD COLUMN IF NOT EXISTS has_complementary_guide boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS complementary_guide_file_url text,
  ADD COLUMN IF NOT EXISTS complementary_guide_file_name text,
  ADD COLUMN IF NOT EXISTS complementary_guide_sent_to_client boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS complementary_guide_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS complementary_guide_due_date date;