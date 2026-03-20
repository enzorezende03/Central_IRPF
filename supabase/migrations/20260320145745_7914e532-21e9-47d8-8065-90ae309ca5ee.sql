
CREATE TYPE public.billing_type AS ENUM ('incluso_mensalidade', 'cobranca_extra');

ALTER TABLE public.billing
  ADD COLUMN billing_type public.billing_type NOT NULL DEFAULT 'cobranca_extra';
