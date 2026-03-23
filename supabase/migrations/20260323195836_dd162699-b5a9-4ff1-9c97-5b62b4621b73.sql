INSERT INTO internal_checklist (case_id, label, sort_order, checked)
SELECT ic.case_id, 'Verificar se a declaração está de acordo com a proposta, caso não esteja passar para o comercial', 2, false
FROM (SELECT DISTINCT case_id FROM internal_checklist) ic
WHERE NOT EXISTS (
  SELECT 1 FROM internal_checklist ic2 
  WHERE ic2.case_id = ic.case_id 
  AND ic2.label ILIKE '%de acordo com a proposta%'
);

UPDATE internal_checklist SET sort_order = 3 WHERE label = 'Preencher declaração' AND sort_order < 3;