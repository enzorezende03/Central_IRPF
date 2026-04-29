## Objetivo
Impedir a criação de duas demandas IRPF para o mesmo cliente (CPF) no mesmo ano-base. Cada CPF só pode ter uma demanda por ano-base; permitido criar novas demandas apenas em anos-base diferentes.

## Mudanças

### 1. Banco de dados (constraint única)
Criar índice único parcial em `irpf_cases` para garantir a regra também a nível de banco (defesa em profundidade), ignorando demandas dispensadas (caso o usuário queira refazer após dispensa — confirmar se faz sentido):

```sql
CREATE UNIQUE INDEX irpf_cases_unique_client_year 
ON public.irpf_cases (client_id, base_year)
WHERE status <> 'dispensada';
```

Isso permite recriar uma demanda se a anterior tiver sido marcada como `dispensada`. Se preferir bloquear sempre, removo o `WHERE`.

### 2. Validação no frontend (`src/components/NewCaseDialog.tsx`)
Antes de inserir em `irpf_cases`, fazer um SELECT em `irpf_cases` filtrando por `client_id` + `base_year` (excluindo `dispensada`). Se já existir, exibir toast de erro:

> "Já existe uma demanda para este cliente no ano-base XXXX. Para criar uma nova demanda, escolha um ano-base diferente."

A validação roda dentro de `mutationFn` antes do insert, evitando criar registros órfãos (billing, checklist, etc).

### 3. Mensagem de erro do banco
Caso a constraint do banco dispare (race condition), capturar o código `23505` no `onError` do mutation e mostrar a mesma mensagem amigável em vez do erro técnico do Postgres.

## Arquivos afetados
- Migração SQL nova (índice único parcial)
- `src/components/NewCaseDialog.tsx` (validação + tratamento de erro)

## Pergunta de confirmação
A regra deve permitir recriar demanda se a anterior foi **Dispensada**? Plano atual: **sim** (faz sentido para o fluxo). Se quiser bloquear absolutamente, me avise e removo o `WHERE` do índice.