DELETE FROM public.internal_checklist
WHERE label IN (
  'Enviar Prévia',
  'Transmitir Declaração',
  'Verificar se possui imposto a pagar para enviar ao cliente',
  'Criar tarefa no G-Click em caso de pagamento do imposto por quotas'
);