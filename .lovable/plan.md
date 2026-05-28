## Objetivo

Gerar uma planilha Excel (.xlsx) confrontando os 231 registros da planilha do time comercial (`Relatório clientes IRPF 2026-2025.xlsx`) com as demandas de IRPF cadastradas no sistema, incluindo o status atual da demanda no sistema.

## Como será feito o cruzamento

A planilha do comercial não tem CPF — só nome completo e e-mail do cliente. Por isso o pareamento será feito assim, em cascata:

1. **Por e-mail** (`E-mail (Pessoa)` ↔ `clients.email`), normalizado em minúsculas — mais confiável.
2. **Por nome completo normalizado** (`Nome completo (Pessoa)` ↔ `clients.full_name`) — sem acentos, sem caixa, sem espaços extras — quando o e-mail não bater.
3. Quando há mais de uma demanda do mesmo cliente, prioriza a do ano-base 2025 / ano-exercício 2026.

## Estrutura da planilha gerada

Arquivo: `/mnt/documents/conferencia_comercial_vs_sistema.xlsx`

**Aba 1 — "Conferência"** (uma linha por registro do comercial, 231 linhas):
- Nome (comercial)
- E-mail (comercial)
- Data cadastro (comercial)
- Status comercial (Ganha/Perdida/etc.)
- Tags (comercial)
- Valor P&S (comercial)
- **Demanda no sistema?** (Sim / Não)
- Cliente no sistema (nome cadastrado)
- CPF do sistema
- Status da demanda no sistema (rótulo legível, ex.: "Aguardando Cliente", "Em Andamento", "Finalizado")
- Responsável interno
- Ano-base / Ano-exercício
- Tipo de pareamento (e-mail / nome / não encontrado)
- Link para abrir a demanda

**Aba 2 — "Resumo"**:
- Total no comercial, total encontrados, total não encontrados
- Quebra por status do sistema
- Quebra cruzada: status comercial × encontrado no sistema

**Aba 3 — "Apenas no sistema"** (opcional, para visão inversa): demandas IRPF 2026 ativas no sistema cujo cliente NÃO aparece na planilha do comercial — útil para identificar demandas criadas fora do funil comercial.

## Formatação

- Fonte Arial, cabeçalho em negrito com fundo cinza claro.
- Linhas "Não encontrado no sistema" destacadas em amarelo.
- Auto-filtro ativo em todas as colunas.
- Larguras de coluna ajustadas.

## Detalhes técnicos

- Leitura da planilha com DuckDB (`read_xlsx`) → CSV temporário.
- Consulta no banco via `psql` em `clients` + `irpf_cases` (somente ativas, `deleted_at IS NULL`).
- Geração do .xlsx com `openpyxl` (Python). Sem fórmulas — valores estáticos de conferência.

Posso seguir com a geração?
