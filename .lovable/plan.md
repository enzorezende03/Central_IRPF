## Objetivo
Permitir que a equipe libere as etapas **Declaração e Recibo** e **Guia de Pagamento (DARF)** mesmo quando não houver prévia anexada.

## Como funciona hoje
- Em `src/pages/ClientDetail.tsx` (≈ linha 2468/2669), as duas etapas checam `preview_status === 'aprovado'`. Se falso, mostram "Etapa bloqueada".
- Existe um botão "Aprovar internamente" (≈ linha 2253), mas ele só aparece quando já existe `preview_file_url`. Ou seja: sem upload de prévia, não há como destravar.

## Mudanças (somente front, em `src/pages/ClientDetail.tsx`)

### 1. No bloco "Etapa bloqueada" do `DeclarationReceiptCard`
Quando `!readOnly` (uso interno), além da mensagem, mostrar um botão **"Liberar etapa sem prévia"** que:
- Abre `confirm("Liberar Declaração e Recibo sem enviar prévia ao cliente?")`.
- Faz `upsert` em `final_deliverables` para o `case_id` setando:
  - `preview_status = 'aprovado'`
  - `preview_approved_at = now()`
  - `preview_approved_by_internal = true`
  - `preview_approved_by_name = profileName || user.email`
- Registra em `case_timeline`: "Etapa liberada internamente sem envio de prévia por <usuário>" (`visible_to_client = false`).
- Invalida queries `irpf-case` e dispara `onRefresh()`.

### 2. Texto do estado bloqueado
Atualizar para: "Disponível após aprovação da prévia pelo cliente — ou libere manualmente abaixo se não for enviar prévia."

### 3. Guia de Pagamento (DARF)
Não precisa alterar: ela usa o mesmo `preview_status === 'aprovado'` e desbloqueia automaticamente assim que a Declaração liberar.

### 4. Reversão
O botão existente "Cancelar aprovação interna" (≈ linha 2289) continua válido para travar de novo. Como `preview_file_url` ficará nulo nesse cenário, ajustar a condição daquele botão para aparecer também quando `pStatus === 'aprovado' && preview_approved_by_internal = true`, independente de existir arquivo de prévia.

## Fora de escopo
- Não altera triggers do banco, status do `irpf_cases` nem schema.
- Não muda fluxo da retificadora nem portal do cliente.
- Finalização da demanda continua acontecendo normalmente quando IRPF + recibo forem anexados e marcados como enviados ao cliente.
