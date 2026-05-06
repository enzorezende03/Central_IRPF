# Planejamento Semanal de IRs

Nova aba interna onde Admin/Operacional atribui demandas (IRPF) a cada semana da temporada, por responsável. Integra-se às metas semanais (meta x planejado x realizado) e oferece **sugestões automáticas** com base na data em que o cliente enviou a documentação completa — quem enviou há mais tempo entra primeiro.

## Banco de dados (migration)

Nova tabela `irpf_weekly_plan`:
- `season_id` — referencia `irpf_season_config`
- `week_number` — referencia `irpf_weekly_goals.week_number`
- `case_id` — referencia `irpf_cases`
- `responsible` (text) — nome do responsável (mesmo padrão de `internal_owner`)
- `planned_by` (uuid) — usuário que adicionou ao plano
- Único: `(season_id, week_number, case_id)` — uma demanda só pode estar em uma semana por temporada.

RLS:
- SELECT/INSERT/UPDATE/DELETE liberado para `authenticated` (mesmo padrão das demais tabelas internas).

## Página `/planejamento` (nova)

Rota nova + item na sidebar (ícone `CalendarCheck`), abaixo de "Metas IRPF".

```text
[Temporada ▾]   [Semana: S3 (06/05–12/05) ▾]   [Responsável: Todos ▾]

┌─ Resumo da semana ────────────────────────────────────────────┐
│  Meta: 90    Planejado: 78    Realizado: 42    Saldo: -12     │
└───────────────────────────────────────────────────────────────┘

┌─ Por responsável ─────────────────────────────────────────────┐
│  Maria   Meta 30 · Planejado 28 · Realizado 15                │
│  João    Meta 30 · Planejado 25 · Realizado 12                │
│  Ana     Meta 30 · Planejado 25 · Realizado 15                │
└───────────────────────────────────────────────────────────────┘

┌─ Sugestões (mais antigas primeiro) ───────────────────────────┐
│  • Cliente A — docs há 18 dias — João   [+ Adicionar]         │
│  • Cliente B — docs há 14 dias — Maria  [+ Adicionar]         │
│  ...                                  [Adicionar 10 primeiros]│
└───────────────────────────────────────────────────────────────┘

┌─ Demandas planejadas (S3) ────────────┐ ┌─ Disponíveis ──────┐
│  • Cliente C — Maria         [remover]│ │ Buscar...          │
│  • Cliente D — João          [remover]│ │ Resp: [Todos ▾]    │
└───────────────────────────────────────┘ └────────────────────┘
```

### Lógica de sugestões

Demandas elegíveis (não finalizadas, não dispensadas, ainda não planejadas em nenhuma semana da temporada) são ordenadas por **data de envio da documentação** (mais antigo primeiro):

1. `irpf_cases.docs_received_at` quando preenchido (já existe — marcado quando o cliente conclui o envio).
2. Fallback: data do upload mais antigo em `uploaded_documents` (`min(uploaded_at)` por `case_id`).
3. Fallback final: `created_at` do caso (ainda sem documentos).

Cada sugestão exibe há quantos dias os documentos foram enviados. Botão "Adicionar 10 primeiros" planeja em massa para a semana atualmente selecionada, distribuindo entre os responsáveis pelo `internal_owner` da própria demanda.

### Listas inferiores

- **Planejadas (esquerda):** demandas já no plano da semana, agrupadas por responsável; remover ou abrir a demanda.
- **Disponíveis (direita):** todas as elegíveis com busca e filtro por responsável; seleção múltipla + "Adicionar à semana".
- Mover entre semanas = remover + adicionar.

## Integração com Metas

- **Meta** vem de `irpf_weekly_goals.goal_count`.
- **Planejado** = contagem em `irpf_weekly_plan` para a semana.
- **Realizado** reusa lógica existente (`completed_at` na janela, S1 absorve pré-temporada).
- Quebra por responsável: meta distribuída igualmente entre os responsáveis ativos; planejado/realizado contados por `responsible`/`internal_owner`.

## Arquivos

Novos:
- `supabase/migrations/<ts>_create_irpf_weekly_plan.sql`
- `src/hooks/use-weekly-plan.ts` — `useWeeklyPlan`, `useAddToPlan`, `useRemoveFromPlan`, `useSuggestedCases` (faz a query ordenada).
- `src/pages/PlanejamentoSemanal.tsx`

Editados:
- `src/App.tsx` — rota `/planejamento`.
- `src/components/AppSidebar.tsx` — novo item de menu.
- `src/integrations/supabase/types.ts` — atualizado pela migration automaticamente.

Reaproveita `src/lib/goals-utils.ts` e os hooks de `src/hooks/use-irpf-goals.ts` para meta/realizado. Sem alteração nos triggers.
