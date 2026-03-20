ALTER TABLE public.final_deliverables ADD COLUMN has_guide boolean NOT NULL DEFAULT false;
ALTER TABLE public.final_deliverables ADD COLUMN guide_url text;