ALTER TABLE public.office_settings
  ADD COLUMN cep text NOT NULL DEFAULT '',
  ADD COLUMN number text NOT NULL DEFAULT '',
  ADD COLUMN complement text NOT NULL DEFAULT '',
  ADD COLUMN neighborhood text NOT NULL DEFAULT '',
  ADD COLUMN city text NOT NULL DEFAULT '',
  ADD COLUMN state text NOT NULL DEFAULT '';