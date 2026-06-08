export type ReceitaSituacao =
  | "aguardando"
  | "processada_restituicao"
  | "processada_a_pagar"
  | "processada_sem_movimento"
  | "em_malha"
  | "malha_regularizada";

export type MalhaStatus =
  | "em_analise"
  | "aguardando_documentacao"
  | "impugnacao_enviada"
  | "regularizada";

export const RECEITA_SITUACOES: { value: ReceitaSituacao; label: string; icon: string; badgeClass: string }[] = [
  { value: "aguardando", label: "Aguardando processamento", icon: "🕐", badgeClass: "bg-slate-500/15 text-slate-700 border-slate-500/30" },
  { value: "processada_restituicao", label: "Processada · Restituição", icon: "✅", badgeClass: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" },
  { value: "processada_a_pagar", label: "Processada · Imposto a pagar", icon: "✅", badgeClass: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" },
  { value: "processada_sem_movimento", label: "Processada · Sem movimento", icon: "✅", badgeClass: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" },
  { value: "em_malha", label: "Em malha fiscal", icon: "⚠️", badgeClass: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
  { value: "malha_regularizada", label: "Malha regularizada", icon: "🔄", badgeClass: "bg-blue-500/15 text-blue-700 border-blue-500/30" },
];

export const RECEITA_SITUACAO_MAP = Object.fromEntries(
  RECEITA_SITUACOES.map((s) => [s.value, s]),
) as Record<ReceitaSituacao, (typeof RECEITA_SITUACOES)[number]>;

export const MALHA_STATUS_OPTIONS: { value: MalhaStatus; label: string }[] = [
  { value: "em_analise", label: "Em análise pela Receita" },
  { value: "aguardando_documentacao", label: "Aguardando documentação do cliente" },
  { value: "impugnacao_enviada", label: "Impugnação enviada" },
  { value: "regularizada", label: "Regularizada" },
];

export const MALHA_STATUS_LABEL: Record<MalhaStatus, string> = Object.fromEntries(
  MALHA_STATUS_OPTIONS.map((s) => [s.value, s.label]),
) as Record<MalhaStatus, string>;

export const CLIENT_PORTAL_MESSAGES: Record<ReceitaSituacao, { title: string; message: string }> = {
  aguardando: {
    title: "🕐 Aguardando processamento",
    message:
      "Sua declaração foi entregue e estamos aguardando o processamento pela Receita Federal.",
  },
  processada_restituicao: {
    title: "✅ Declaração processada",
    message:
      "Sua declaração foi processada pela Receita Federal. Você tem restituição a receber.",
  },
  processada_a_pagar: {
    title: "✅ Declaração processada",
    message:
      "Sua declaração foi processada pela Receita Federal. Existe imposto a pagar — entre em contato para mais detalhes.",
  },
  processada_sem_movimento: {
    title: "✅ Declaração processada",
    message:
      "Sua declaração foi processada pela Receita Federal sem pendências.",
  },
  em_malha: {
    title: "⚠️ Em análise pela Receita Federal",
    message:
      "Sua declaração está sendo analisada pela Receita Federal. Nossa equipe está acompanhando o processo e entrará em contato se necessário.",
  },
  malha_regularizada: {
    title: "✅ Análise concluída",
    message:
      "A análise da Receita Federal foi concluída e sua declaração está regularizada.",
  },
};
