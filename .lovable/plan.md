## Reformulação de /planejamento — Coordenação central

Transformar a tela em ferramenta de **distribuição** (Admin/coordenadora) com visão somente leitura para Operacional, que continua executando no Kanban.

### 1. Visão Operacional (somente leitura)

Detectar via `useAuth().role`:
- `admin` → visão de coordenação completa (descrita abaixo).
- demais perfis (`operacional`, `financeiro`, etc.) → visão pessoal.

Layout pessoal:
- Banner discreto no topo: "Seu planejamento desta semana · para editar, fale com a coordenação".
- Lista simples (sem grade, sem fila, sem carryover) das demandas em que `irpf_weekly_plan.responsible == profileName` da semana atual.
- Cada item: nome do cliente, status atual (badge), prioridade (badge), link para `/demandas/:id`.
- Sem botões de remover/atribuir/mover. Sem seletor de semana (só atual).

### 2. Visão Admin — cabeçalho

- Trocar o `Select` de semana por **navegador com setas** ◀ / S{n} {datas} / ▶ + botão "Hoje".
- Resumo numérico permanece: Planejadas · Concluídas · Em aberto.
- Novo botão **"Nova semana"** abre modal:
  - Mostra demandas planejadas na semana anterior cujo status ∉ {finalizado, previa_enviada, dispensada}.
  - Checkbox por item (todas pré-marcadas).
  - "Copiar para esta semana" → para cada selecionada, INSERT em `irpf_weekly_plan` com `week_number = semana selecionada`, mantendo `responsible`. Pula casos já planejados na semana atual.

### 3. Coluna esquerda — Fila de disponíveis

- Manter fonte (`useEligibleCases`, `QUEUE_STATUSES`, ordenação por `getReferenceDate`).
- **Trocar filtros**: remover "responsável", adicionar:
  - Filtro de **tag do cliente** (multi via Select simples; lê `clients.tags`).
  - Filtro de **prioridade** (alta/média/baixa).
- Card adiciona:
  - Badge de **prioridade** (cores: alta=destructive, media=secondary, baixa=outline).
  - Badge **"Procuração"** quando o caso tiver `document_requests` com `category = 'procuracao'` OU `title ILIKE '%procura%'` em status `enviado`/`aprovado`. Buscar em batch para a lista da fila.
- Estender `useEligibleCases` para retornar `priority` e `tags` do cliente; criar `useProcuracaoFlags(caseIds)` que devolve um `Set<string>` de case_ids com procuração.

### 4. Coluna direita — Grade da semana por operadora

- **Operadoras = somente usuários com role `operacional`** (consulta `user_roles` join `profiles.full_name`). Garantir presença de quem aparece em `weekPlan.responsible` mesmo que a role tenha mudado.
- Card de operadora: nome + `X/Y` + barra (cores existentes mantidas).
- Cards das demandas planejadas: cliente, status atual, **menu de contexto "⋯"** com opção "Mover para…" abrindo lista de operadoras (reatribui = UPDATE em `irpf_weekly_plan.responsible` + `irpf_cases.internal_owner`). Botão "×" remove.
- **Drag and drop** entre seções de operadora usando HTML5 nativo (sem dependências):
  - Cards têm `draggable`, ao soltar em outra seção dispara o mesmo `useMovePlanWeek` com `responsible` novo, ajustado para também atualizar `internal_owner`.
- Remover Realtime e overlays "concluído/risco" complexos. Status é informativo: badge simples, sem auto-refresh; fetch acontece ao montar a página/trocar semana.

### 5. Bloco de remanescentes

- Reusar lógica atual mas **incluir `previa_aprovada`** como status que ainda requer ação (remover de `CARRYOVER_EXCLUDED`/manter exclusão só de `finalizado, previa_enviada, dispensada`).
- Botões: "Mover para esta semana" e "Ignorar" (já existe).
- Esconder o bloco automaticamente quando a lista fica vazia (já é o comportamento).

### 6. O que remover

- `useEffect` de Realtime em `irpf_cases` (canal `planning-cases`).
- Filtro "responsável" da fila.
- Badge "X dias com docs" mantém (é informação útil para distribuir); remover apenas indicadores ligados a execução pessoal (não há nesta tela hoje).
- Nenhuma coluna/valor financeiro entra (já não há).

### Arquivos

- `src/pages/PlanejamentoSemanal.tsx` — reescrever `PlanContent` + adicionar `OperationalView` + `NewWeekDialog` + drag-and-drop nos cards da grade.
- `src/hooks/use-weekly-plan.ts` — `useEligibleCases` retorna `priority` e `tags`; novo `useProcuracaoFlags(ids)`; `useMovePlanWeek` já aceita `responsible`.
- Novo hook `src/hooks/use-operators.ts` — lista operadores (role `operacional`) com `full_name` para a grade e seletores de "Mover para…".
- Sem migração: schema atual atende.

### Notas

- Drag-and-drop fica em HTML5 puro (dataTransfer com plan id). Fallback é o menu "Mover para…".
- Operacional sem `profileName` definido vê lista vazia + dica para configurar nome no perfil.
