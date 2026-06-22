# Filtro de exclusão por responsável na tela Metas IRPF

Adicionar um controle no topo da página **Metas IRPF** que permite simular como ficariam meta x realizado **excluindo as entregas de um (ou mais) responsável** — começando pela Ana Braga, mas funcionando para qualquer responsável cadastrado.

## Comportamento

- Novo campo "Excluir entregas de" ao lado do seletor de Temporada no header.
- Multi-select com a lista de responsáveis internos (`internal_owner`) que aparecem na temporada selecionada, mais opção "Sem responsável".
- Quando há ao menos um responsável selecionado:
  - Aparece uma faixa de aviso discreta indicando "Simulação: ignorando entregas de Ana Braga" com botão "Limpar".
  - Todos os números da aba Visão Geral são recalculados ignorando esses casos: KPI Realizados, % Concluído, status vs meta, projeção, gráfico acumulado e escala de bônus.
  - Aba Metas Semanais: coluna "Realizado" recalculada na mesma lógica (o snapshot persistido continua intocado — a simulação roda só em memória).
- Sem seleção, tudo se comporta exatamente como hoje (inclui snapshots já congelados).

## Detalhes técnicos

1. **`src/hooks/use-irpf-goals.ts` → `useFinalizedCasesInRange`**
   - Acrescentar `internal_owner` ao select de `irpf_cases` para que o filtro funcione no front.

2. **`src/pages/MetasIRPF.tsx`**
   - Novo estado `excludedOwners: string[]` no componente raiz, passado para `OverviewBlock` e `WeeklyBlock`.
   - Em `OverviewBlock`/`WeeklyBlock`, antes de calcular `realizedPerWeek`, filtrar `finalized` removendo os casos cujo `internal_owner` está em `excludedOwners` (com `__none__` cobrindo sem responsável).
   - Quando houver exclusão ativa:
     - Para semanas fechadas, **não usar** `realized_snapshot` — recalcular ao vivo a partir da lista filtrada (caso contrário a simulação não teria efeito retroativo).
     - Desativar o efeito de auto-snapshot enquanto a simulação estiver ligada.
   - Lista de responsáveis para o multi-select: derivada de `finalized` (`internal_owner` distintos), ordenada alfabeticamente.
   - Adicionar componente `MultiSelectFilter` (já existe no projeto) ao header.

3. Sem alterações de banco, migrations ou permissões.

## Arquivos alterados

- `src/hooks/use-irpf-goals.ts`
- `src/pages/MetasIRPF.tsx`
