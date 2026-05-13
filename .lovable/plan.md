## Redesign /planejamento — Central IRPF

Reformular a tela de Planejamento Semanal em duas colunas (fila + grade por responsável), com capacidade, carryover e atualização em tempo real.

### 1. Banco de dados (migração)

Adicionar capacidade semanal por responsável. Como `internal_owner` é um texto livre (não FK em users), criar tabela própria:

```sql
CREATE TABLE public.weekly_capacity (
  id uuid PK default gen_random_uuid(),
  responsible text NOT NULL UNIQUE,
  capacity int NOT NULL DEFAULT 10,
  updated_at timestamptz default now()
);
-- RLS: auth pode ler tudo; só admin gerencia.
```

Sem alterar triggers existentes.

### 2. Hooks novos / ajustes

- `use-weekly-capacity.ts` — `useCapacities()`, `useUpsertCapacity()` (admin).
- Estender `use-weekly-plan.ts`:
  - `useMovePlanWeek(planId, week_number)` — para carryover "Mover para esta semana".
  - Hook realtime que invalida `irpf-cases` quando há mudança de status (canal postgres_changes em `irpf_cases`).

### 3. Página `PlanejamentoSemanal.tsx` — novo layout

Estrutura:

```text
[Header + selector temporada + selector semana]
[Resumo: Planejadas X | Concluídas Y | Em aberto Z]
[Bloco "Da semana anterior" (âmbar) — só se houver remanescentes]
[ Fila disponíveis (esq) | Grade por responsável (dir) ]
```

**Coluna esquerda — Fila**
- Lista `eligible` filtrado para status `documentos_em_analise` ou `em_andamento`, não planejados na semana atual.
- Ordenado por `getReferenceDate` (asc).
- Filtros: responsável (select) + busca por nome/tag.
- Card: nome, status badge, "X dias com docs completos", badge de prioridade.
- Botão `+` para abrir mini-popover escolhendo o responsável da grade (ou já atribui ao `internal_owner`).

**Coluna direita — Grade**
- Agrupada por responsável (união de `weekly_capacity` + responsáveis com plano nesta semana + `internal_owner`s ativos).
- Header de cada grupo: nome, contador `planejadas/capacidade`, barra linear (verde <80%, âmbar 80-100%, vermelho >100%).
- Cards: nome do cliente, status (live), bolinha de cor:
  - azul: em andamento/planejada
  - verde: `finalizado` | `previa_enviada` | `previa_aprovada`
  - vermelho: registro pertence a semana anterior à atual e não concluído (no contexto do bloco carryover)
- X para remover do plano.
- Ao adicionar, se exceder capacidade → toast inline "X já tem N demandas planejadas" (não bloqueia).

**Bloco carryover (topo da coluna direita)**
- Busca `plan` da semana ISO (atual − 1) com case status ∉ {finalizado, previa_enviada, previa_aprovada, dispensada}.
- Cada item: nome + responsável + 2 botões: "Mover para esta semana" (UPDATE week_number) e "Ignorar" (oculta localmente, sessionStorage).

**Resumo numérico (topo)**
- Planejadas = `weekPlan.length`
- Concluídas = casos do `weekPlan` cujo status atual ∈ {finalizado, previa_enviada, previa_aprovada}
- Em aberto = Planejadas − Concluídas

### 4. Realtime

`useEffect` na página subscreve canal `planning-cases` em `postgres_changes` event=UPDATE schema=public table=irpf_cases → `queryClient.invalidateQueries(['irpf_eligible_cases'])` e `['irpf-cases']`.

### 5. Configurações

Em `src/pages/Configuracoes.tsx`, adicionar seção "Capacidade semanal por responsável" (admin only): tabela com responsável + input numérico + salvar (upsert em `weekly_capacity`). Lista responsáveis vindos de `internal_owner` distinto + linhas existentes.

### 6. Não mudar
- Badge `Planejada · Sx` no Kanban (KanbanBoard.tsx).
- Botão atalho do Kanban (`AddToWeekDialog`).
- Triggers de status, `irpf_season_config`, `irpf_weekly_goals`.

### Arquivos
- migration `weekly_capacity`
- novo `src/hooks/use-weekly-capacity.ts`
- update `src/hooks/use-weekly-plan.ts` (hook move + função)
- reescrever `src/pages/PlanejamentoSemanal.tsx`
- editar `src/pages/Configuracoes.tsx` (seção capacidade)

### Notas técnicas
- Drag-and-drop fica fora da v1 — adicionar via clique + popover de responsável (mais rápido de entregar e suficiente). DnD pode entrar depois.
- Responsável "Sem responsável" também aparece como coluna na grade quando há planejadas sem owner.
- Toast de capacidade usa `useToast` existente.
