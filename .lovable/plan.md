## Anexo em lote no checklist documental

Adicionar um botão **"Anexar em lote"** no cabeçalho do card "Checklist Documental Interno" da página de demanda do cliente, permitindo subir vários arquivos de uma vez (recebidos por e-mail/WhatsApp) e marcar múltiplos itens pendentes como recebidos em uma única operação.

### Como vai funcionar (UX)

1. No cabeçalho do checklist (ao lado do "Baixar Todos") aparece um botão **"Anexar em lote"** (ícone Paperclip).
2. Ao clicar, abre um diálogo com duas etapas:
   - **Etapa 1 — Selecionar arquivos**: drag-and-drop ou seletor múltiplo. Mostra a lista dos arquivos com nome e tamanho, validando tipo/tamanho (regras já existentes em `upload-utils`).
   - **Etapa 2 — Vincular aos itens pendentes**: para cada arquivo, um `Select` lista os itens do checklist que ainda estão `pendente` ou `rejeitado` (mais opção "Avulso — não vincular a item"). 
     - Botão de atalho **"Auto-vincular por nome"** tenta casar nome do arquivo com o título do item (match aproximado, sem sobrescrever escolhas manuais).
     - Vários arquivos podem ser vinculados ao mesmo item (ex: 3 páginas do mesmo informe).
3. Botão **"Enviar tudo"**: para cada arquivo faz upload no bucket `documentos_clientes`, insere em `uploaded_documents` (com `uploaded_by: 'office'` e `document_request_id` se vinculado) e, ao final, atualiza o status dos itens vinculados para `enviado` (que é o estado que habilita o botão "Aprovar"). Cada item recebe um evento na timeline ("Documento recebido fora do portal — anexado pela equipe").
4. Toast com resumo ("8 arquivos enviados, 5 itens marcados como recebidos") e refresh do card.

### Decisão sobre dar baixa nos pendentes

Os arquivos vinculados deixam o item em **"enviado"** (não "aprovado") — assim a equipe ainda passa pela conferência manual antes de aprovar, igual quando o cliente envia pelo portal. Isso preserva o fluxo de QA e os triggers existentes de progresso/status.

> Alternativa que NÃO vou aplicar (a menos que você prefira): pular direto para "aprovado". Mais rápido, mas remove a etapa de revisão.

### Detalhes técnicos

- Novo componente `BulkUploadDialog.tsx` em `src/components/`.
- Renderizado no header do checklist em `ClientDetail.tsx` (perto da linha 760), só aparece se houver pelo menos 1 item pendente/rejeitado.
- Reusa `validateFile`, `buildStoragePath`, `uploadFileToBucket` de `src/lib/upload-utils.ts`.
- Inserts em `uploaded_documents` e update em `document_requests.status='enviado'` agrupados; invalida as queries `doc-requests`, `uploaded-docs` e `case-timeline` ao final.
- Auto-vinculação: normaliza (lowercase, sem acentos) tanto o nome do arquivo quanto o `title` do item e usa `includes` em qualquer direção para sugerir o match.
- Sem mudanças de schema, sem migração.

### Arquivos alterados

- `src/components/BulkUploadDialog.tsx` (novo)
- `src/pages/ClientDetail.tsx` (adicionar botão e abrir o diálogo)
