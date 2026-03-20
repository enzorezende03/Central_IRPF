
ALTER TABLE public.irpf_cases
ADD COLUMN internal_status text NOT NULL DEFAULT 'aguardando_cliente';
