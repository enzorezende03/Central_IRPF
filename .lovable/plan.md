## Validação de CPF no upload da Declaração e Recibo

Adicionar uma checagem automática do CPF do cliente no momento em que a equipe anexa um dos 4 arquivos do card **Declaração e Recibo** (Declaração IRPF, Recibo de Entrega, Arquivo REC, Arquivo DEC), para evitar anexar arquivo de cliente errado.

### Como funciona

1. **Conferência pelo nome do arquivo (sempre primeiro)**
   - Extrai todos os dígitos do `file.name`.
   - Compara com o CPF do cliente (`caseData.clients.cpf`, normalizado para dígitos).
   - Se o CPF do cliente aparecer como subsequência contínua nos dígitos do nome → ✅ válido, segue upload.

2. **Conferência dentro do PDF (fallback)**
   - Se o nome não contém o CPF e o arquivo é `.pdf`, extrai o texto do PDF no próprio navegador com `pdfjs-dist` (já é uma lib leve, lazy-loaded só nesse fluxo).
   - Busca o CPF do cliente (com e sem máscara `000.000.000-00`) no texto.
   - Se encontrado → ✅ segue upload.

3. **Quando nenhuma das duas confere**
   - Abre um `AlertDialog` de confirmação:
     > "O CPF do cliente (`xxx.xxx.xxx-xx`) não foi encontrado no nome do arquivo nem no conteúdo do PDF. Deseja anexar mesmo assim?"
   - Botões: **Cancelar** (padrão) / **Anexar mesmo assim**.
   - Decisão é registrada no `case_timeline` como observação interna ("Arquivo anexado sem confirmação de CPF").

### Escopo

- Aplica-se apenas ao card **Declaração e Recibo** em `ClientDetail.tsx` (`DeclarationReceiptCard`), tanto na declaração original quanto na retificação.
- Arquivos **.REC** e **.DEC** (binários) → só a conferência por nome de arquivo. Sem leitura interna.
- Arquivos **.PDF** (Declaração IRPF / Recibo) → nome + conteúdo do PDF.
- Outros formatos (JPG/PNG do recibo, por exemplo) → só nome de arquivo.
- Sem mudanças em outros uploads (BulkUploadDialog, documentos do cliente, prévia) — fora do pedido.

### Detalhes técnicos

- Função utilitária nova em `src/lib/cpf-check.ts`:
  - `digitsOnly(s)`, `extractCpfFromFilename(name, cpf)`, `extractCpfFromPdf(file, cpf)` (usa `pdfjs-dist` dinâmico).
- `handleUpload` em `DeclarationReceiptCard` chama a checagem antes de subir o arquivo. Estado novo para controlar o `AlertDialog` de confirmação com o arquivo pendente.
- Dependência adicional: `pdfjs-dist` (lazy import, sem impacto no bundle inicial).
- Sem alteração de schema, RLS, ou edge functions.

### Arquivos afetados

- `src/pages/ClientDetail.tsx` — fluxo de upload em `DeclarationReceiptCard`, AlertDialog de confirmação.
- `src/lib/cpf-check.ts` *(novo)* — utilitário de validação por nome e por conteúdo de PDF.
- `package.json` — adicionar `pdfjs-dist`.