## Diagnóstico

Conferi a demanda da Fátima Cezario no banco:

- `irpf_cases.status = 'finalizado'` (deveria estar `retificando`/`retificada`)
- `retificacao_iniciada_em` está preenchido (a abertura registrou)
- Existem **2 linhas** em `final_deliverables`: uma original (`retificacao=false`) e a retificadora (`retificacao=true`, com DEC + REC + IRPF + recibo já anexados)

Ou seja: os documentos da retificadora **foram salvos**, mas o status foi **revertido para "finalizado"** pelos triggers automáticos do banco. Isso também explica por que o portal do cliente não mostra a retificadora (o portal só exibe os blocos de retificação quando `status` é `retificando`/`retificada`).

## Causa raiz

Três funções do banco mexem em `irpf_cases.status` quando algo muda em `final_deliverables` / `document_requests` e **nenhuma delas conhece o estado de retificação**:

1. `auto_update_client_status(p_case_id)` — lê `final_deliverables` sem filtrar `retificacao`. Como agora existem duas linhas, o `SELECT INTO` pega uma arbitrária e, vendo `irpf_file_url` + `sent_to_client=true`, força `status='finalizado'`. Além disso, a lista de estados "protegidos" (`impedida`, `dispensada`, `previa_enviada`, `previa_aprovada`) **não inclui** `retificando` nem `retificada`.

2. `recalc_case_progress(p_case_id)` — mesmo problema de `SELECT INTO` em `final_deliverables` sem filtrar `retificacao`, e também recalcula `status` sem proteger os estados de retificação.

3. `auto_set_status_on_preview` — dispara em qualquer linha de `final_deliverables` (inclusive a retificadora) e pode forçar `previa_enviada`/`previa_aprovada` por causa do `preview_status` da linha de retificação.

## Plano de correção

### 1. Migração — proteger triggers contra o fluxo de retificação

Atualizar três funções (sem mudar comportamento normal):

- **`auto_update_client_status`**
  - Adicionar `retificando` e `retificada` à lista de estados protegidos (retorna sem alterar).
  - Filtrar `final_deliverables` por `retificacao = false` ao ler `preview_file_url`, `irpf_file_url`, `sent_to_client`.

- **`recalc_case_progress`**
  - Mesmo filtro `retificacao = false` no `SELECT INTO` da deliverable.
  - Se `status` atual for `retificando`/`retificada`/`finalizado`, recalcular o `progress_percent` mas **não** sobrescrever `status`.

- **`auto_set_status_on_preview`**
  - Ignorar (retornar `NEW`) quando `NEW.retificacao = true`.
  - Manter os estados `retificando`/`retificada` na lista de protegidos.

### 2. Reparar a demanda da Fátima

Na mesma migração, restaurar o status correto da demanda já afetada:

```sql
UPDATE irpf_cases
   SET status = 'retificada', updated_at = now()
 WHERE id = 'cc92ba84-01e4-4245-aa4c-7cc19beb953f';
```

(A retificadora já tem DEC + REC + IRPF + recibo + `sent_to_client=true`, então o estado final correto é `retificada`. Registrar evento na timeline informando o ajuste.)

### 3. Pequenos ajustes no front (`src/pages/ClientDetail.tsx`)

- No clique de **"Marcar como Retificada"**, invalidar também a query `irpf-case` (além das já invalidadas) para refletir o novo status imediatamente.
- No upload da retificadora (`DeclarationReceiptCard` com `isRetificacao`), invalidar `irpf-case` no `onRefresh` para que o front não mostre status desatualizado caso o usuário recarregue.

### 4. Verificação no Portal do Cliente

Nenhuma mudança de código no portal — assim que o `status` voltar a ser `retificando`/`retificada`, o bloco "Declaração Retificadora" já aparece corretamente (lógica em `ClientPortal.tsx:576-595` já existente).

## Resultado esperado

- Anexar documentos na retificadora **não rebaixa** o status para `finalizado`.
- Botão **"Marcar como Retificada"** persiste o status `retificada` (sem reversão por trigger).
- Portal do cliente exibe o card de **Declaração Retificadora** com o arquivo liberado.
- A demanda da Fátima fica corrigida automaticamente.
