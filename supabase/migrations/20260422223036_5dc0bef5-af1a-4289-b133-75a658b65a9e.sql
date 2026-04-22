-- 1) Adicionar 'previa_enviada' ao enum case_status
ALTER TYPE case_status ADD VALUE IF NOT EXISTS 'previa_enviada';
