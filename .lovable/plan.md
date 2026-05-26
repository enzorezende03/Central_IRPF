## 1. Card "Ajuste de Prévia" no Dashboard

- Em `src/pages/Dashboard.tsx`, adicionar um `StatCard` ao lado de "Prévias Enviadas".
- Valor: nº de cases não finalizados cujo `final_deliverables.preview_status === "ajustes_solicitados"` e ainda existe `preview_file_url`.
- Cor: `text-destructive`, ícone `AlertCircle`.
- Clique aplica filtro novo `previa_ajustes` na lista de Demandas.

### Filtro em /demandas

- Em `src/pages/Demandas.tsx`, suportar o valor de filtro `previa_ajustes`: trata como subset de `previa_enviada` filtrando pelos cases com `preview_status === "ajustes_solicitados"`. Apenas leitura do filtro vindo da URL; não precisa entrar no select de status.

## 2. Flag "Avisar responsável" nas Observações Internas

### Schema

Migration adiciona em `irpf_cases`:

- `notes_alert` (boolean, default `false`) — quando ligado, sinaliza que a observação precisa de atenção do responsável.
- `notes_alert_at` (timestamptz, nullable) — data da marcação.
- `notes_alert_by` (text, nullable) — nome de quem marcou (snapshot).

Sem alteração de RLS (tabela já tem políticas).

### UI em ClientDetail (card "Observações Internas")

- Abaixo do textarea/visualização, adicionar um `Checkbox` "Avisar responsável sobre esta observação".
- Estado ligado/desligado escreve em `irpf_cases.notes_alert/notes_alert_at/notes_alert_by` (usa `useAuth` para o nome) e registra `case_timeline` com `event_type: "Observação marcada para responsável"`.
- Quando ligado, o card de observações ganha borda/realce `border-destructive/40` e um badge "Aviso ao responsável" com data e autor.
- Botão "Marcar como visto" (visível só para o responsável da demanda — `caseData.internal_owner` igual ao nome do usuário logado) desliga a flag.

### Indicador na lista de Demandas

- Em `Demandas.tsx`, na célula de status, exibir badge amarelo "Observação para responsável" quando `notes_alert === true` (não troca o status real, apenas selo).
- Mesma sinalização nos cards do Kanban (`KanbanBoard.tsx`): badge pequeno com ícone `Bell` no canto do card.

### Notificação (sino) e destaque no Dashboard

- Reaproveitar o componente de notificações existente (sino do header — vamos confirmar no arquivo do header; se não existir um sino, este passo gera um indicador visual no item de menu "Demandas" do `AppSidebar` com a contagem).
- Card novo no Dashboard "Observações para você" (somente para o usuário logado) com a contagem de cases onde `internal_owner === nome do usuário` e `notes_alert === true`. Clique leva a `/demandas?filter=notes_alert_mine`.
- Card global "Observações pendentes" (toda a equipe) com filtro `notes_alert_all`.

## Arquivos afetados

- `supabase/migrations/...` — novas colunas em `irpf_cases`.
- `src/pages/Dashboard.tsx` — 2 novos `StatCard` + cálculos + navegação.
- `src/pages/Demandas.tsx` — filtros `previa_ajustes`, `notes_alert_mine`, `notes_alert_all` + selo na coluna status.
- `src/pages/ClientDetail.tsx` — checkbox + mutação + realce visual no card de Observações Internas.
- `src/components/KanbanBoard.tsx` — badge no card quando `notes_alert`.
- `src/components/AppSidebar.tsx` (ou header existente) — indicador de contagem para o responsável logado.

## Notas

- Sem mudanças no enum `case_status`; o status do Kanban continua o mesmo. Tudo é sinalização visual + filtro.
- A flag é única por demanda (não por nota individual), conforme escolha de UI.