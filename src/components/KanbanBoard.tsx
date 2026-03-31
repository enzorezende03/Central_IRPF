import { useMemo } from "react";
import { formatCPF } from "@/lib/format-utils";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { CaseWithClient } from "@/hooks/use-cases";
import { STATUS_LABELS } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { PriorityBadge, BillingBadge } from "@/components/StatusBadge";
import { CheckCircle2, AlertCircle } from "lucide-react";

import type { Database } from "@/integrations/supabase/types";

type CaseStatus = Database["public"]["Enums"]["case_status"];

type KanbanColumn = CaseStatus | "previa_enviada" | "solicitacao_documentacao" | "procuracao" | "impedida" | "reaberta";

const COLUMNS: KanbanColumn[] = [
  "solicitacao_documentacao",
  "procuracao",
  "aguardando_cliente",
  "documentos_em_analise",
  "em_andamento",
  "impedida",
  "reaberta",
  "previa_enviada",
  "pendencia",
  "finalizado",
];

const COLUMN_LABELS: Record<KanbanColumn, string> = {
  ...STATUS_LABELS,
  solicitacao_documentacao: "Solicitação de Documentação",
  procuracao: "Procuração",
  previa_enviada: "Envio de Prévia",
  impedida: "Impedida",
  reaberta: "Reaberta",
};

const columnColors: Record<KanbanColumn, string> = {
  solicitacao_documentacao: "border-t-amber-500",
  procuracao: "border-t-cyan-500",
  aguardando_cliente: "border-t-warning",
  documentos_em_analise: "border-t-info",
  em_andamento: "border-t-primary",
  previa_enviada: "border-t-violet-500",
  pendencia: "border-t-destructive",
  impedida: "border-t-rose-500",
  reaberta: "border-t-teal-500",
  finalizado: "border-t-success",
};

const dotColors: Record<KanbanColumn, string> = {
  solicitacao_documentacao: "bg-amber-500",
  procuracao: "bg-cyan-500",
  aguardando_cliente: "bg-warning",
  documentos_em_analise: "bg-info",
  em_andamento: "bg-primary",
  previa_enviada: "bg-violet-500",
  pendencia: "bg-destructive",
  impedida: "bg-rose-500",
  reaberta: "bg-teal-500",
  finalizado: "bg-success",
};

function getChecklistColumn(c: CaseWithClient): KanbanColumn | null {
  if (c.status !== "aguardando_cliente") return null;

  const checklist = (c.internal_checklist ?? []).sort((a, b) => a.sort_order - b.sort_order);
  if (checklist.length === 0) return null;

  const solicitarDoc = checklist[0];
  const procuracao = checklist[1];

  if (!solicitarDoc?.checked) {
    return "solicitacao_documentacao";
  }

  if (procuracao && !procuracao.checked) {
    return "procuracao";
  }

  return null;
}

export function KanbanBoard({ cases }: { cases: CaseWithClient[] }) {
  const grouped = useMemo(() => {
    const map: Record<KanbanColumn, CaseWithClient[]> = {
      solicitacao_documentacao: [],
      procuracao: [],
      aguardando_cliente: [],
      documentos_em_analise: [],
      em_andamento: [],
      previa_enviada: [],
      pendencia: [],
      impedida: [],
      reaberta: [],
      finalizado: [],
    };
    cases.forEach((c) => {
      const internalStatus = (c as any).internal_status ?? c.status;

      // Check impedida/reaberta first (internal_status based)
      if (internalStatus === "impedida") {
        map.impedida.push(c);
        return;
      }
      if (internalStatus === "reaberta") {
        map.reaberta.push(c);
        return;
      }

      const fd = Array.isArray(c.final_deliverables)
        ? c.final_deliverables[0]
        : c.final_deliverables;
      const hasPreview = fd?.preview_file_url;

      if (hasPreview && c.status !== "finalizado") {
        map.previa_enviada.push(c);
        return;
      }

      const checklistCol = getChecklistColumn(c);
      if (checklistCol) {
        map[checklistCol].push(c);
        return;
      }

      if (map[c.status]) {
        map[c.status].push(c);
      }
    });
    return map;
  }, [cases]);

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 -mx-3 px-3 sm:mx-0 sm:px-0">
      {COLUMNS.map((status) => (
        <div
          key={status}
          className={`flex-shrink-0 w-64 sm:w-72 rounded-xl border border-t-4 ${columnColors[status]} bg-card`}
        >
          <div className="p-3 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`h-2.5 w-2.5 rounded-full ${dotColors[status]}`} />
              <span className="text-sm font-semibold">{COLUMN_LABELS[status]}</span>
            </div>
            <span className="text-xs font-medium text-muted-foreground bg-muted rounded-full px-2 py-0.5">
              {grouped[status].length}
            </span>
          </div>
          <div className="p-2 space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto">
            {grouped[status].map((c, i) => {
              const billing = c.billing?.[0];
              return (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <Link
                    to={`/demandas/${c.id}`}
                    className="block p-3 rounded-lg border bg-background hover:shadow-md transition-shadow cursor-pointer"
                  >
                    <p className="text-sm font-medium truncate">
                      {c.clients?.full_name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatCPF(c.clients?.cpf)} · {c.internal_owner ?? "Sem responsável"}
                    </p>
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {(() => {
                        const checklist = (c.internal_checklist ?? []).sort((a, b) => a.sort_order - b.sort_order);
                        const procItem = checklist.find((item) => item.label.toLowerCase().includes("procura"));
                        const hasProcuracao = procItem?.checked;
                        return hasProcuracao ? (
                          <Badge variant="outline" className="bg-success/15 text-success border-success/30 text-xs gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Procuração OK
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-warning/15 text-warning border-warning/30 text-xs gap-1">
                            <AlertCircle className="h-3 w-3" /> Sem Procuração
                          </Badge>
                        );
                      })()}
                    </div>
                    {billing && (
                      <p className="text-xs font-medium mt-1.5 text-right text-muted-foreground">
                        {fmt(billing.amount)}
                      </p>
                    )}
                  </Link>
                </motion.div>
              );
            })}
            {grouped[status].length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-8">
                Nenhuma demanda
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
