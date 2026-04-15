import { useMemo } from "react";
import { formatCPF } from "@/lib/format-utils";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { CaseWithClient } from "@/hooks/use-cases";
import { STATUS_LABELS } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { PriorityBadge, BillingBadge } from "@/components/StatusBadge";
import { CheckCircle2, AlertCircle, Clock } from "lucide-react";

import type { Database } from "@/integrations/supabase/types";

type CaseStatus = Database["public"]["Enums"]["case_status"];

type KanbanColumn = Exclude<CaseStatus, "dispensada" | "reaberta"> | "previa_enviada" | "solicitacao_documentacao" | "procuracao";

const COLUMNS: KanbanColumn[] = [
  "solicitacao_documentacao",
  "procuracao",
  "aguardando_cliente",
  "documentos_parciais",
  "documentos_em_analise",
  "em_andamento",
  "impedida",
  "previa_enviada",
  "pendencia",
  "finalizado",
];

const COLUMN_LABELS: Record<KanbanColumn, string> = {
  ...STATUS_LABELS,
  solicitacao_documentacao: "Solicitação de Documentação",
  procuracao: "Procuração",
  documentos_parciais: "Documentos Parciais",
  previa_enviada: "Envio de Prévia",
  impedida: "Impedida",
  reaberta: "Reaberta",
};

const columnColors: Record<KanbanColumn, string> = {
  solicitacao_documentacao: "border-t-amber-500",
  procuracao: "border-t-cyan-500",
  aguardando_cliente: "border-t-warning",
  documentos_parciais: "border-t-orange-500",
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
  documentos_parciais: "bg-orange-500",
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

export function KanbanBoard({ cases, columnOrder, hiddenColumns }: { cases: CaseWithClient[]; columnOrder?: string[]; hiddenColumns?: string[] }) {
  const grouped = useMemo(() => {
    const map: Record<KanbanColumn, CaseWithClient[]> = {
      solicitacao_documentacao: [],
      procuracao: [],
      aguardando_cliente: [],
      documentos_parciais: [],
      documentos_em_analise: [],
      em_andamento: [],
      previa_enviada: [],
      pendencia: [],
      impedida: [],
      reaberta: [],
      finalizado: [],
    };
    cases.forEach((c) => {
      const caseStatus = c.status as string;

      // Skip dispensadas from Kanban
      if (caseStatus === "dispensada") return;

      // Direct mapping for statuses that map 1:1 to kanban columns
      if (caseStatus === "impedida") { map.impedida.push(c); return; }
      if (caseStatus === "reaberta") { map.reaberta.push(c); return; }
      if (caseStatus === "documentos_parciais") { map.documentos_parciais.push(c); return; }
      if (caseStatus === "em_andamento") { map.em_andamento.push(c); return; }
      if (caseStatus === "finalizado") { map.finalizado.push(c); return; }
      if (caseStatus === "documentos_em_analise") { map.documentos_em_analise.push(c); return; }

      // Pendencia must always stay in the pendencia column to match Demandas
      if (caseStatus === "pendencia") {
        map.pendencia.push(c);
        return;
      }

      // Aguardando cliente: check checklist sub-columns, then preview
      if (caseStatus === "aguardando_cliente") {
        const checklistCol = getChecklistColumn(c);
        if (checklistCol) { map[checklistCol].push(c); return; }

        const fd = Array.isArray(c.final_deliverables) ? c.final_deliverables[0] : c.final_deliverables;
        if (fd?.preview_file_url) { map.previa_enviada.push(c); return; }

        map.aguardando_cliente.push(c);
        return;
      }

      // Fallback
      if (map[caseStatus as KanbanColumn]) {
        map[caseStatus as KanbanColumn].push(c);
      }
    });
    // Sort documentos_em_analise by docs_received_at (earliest first for prioritization)
    map.documentos_em_analise.sort((a, b) => {
      const dateA = (a as any).docs_received_at ?? a.updated_at;
      const dateB = (b as any).docs_received_at ?? b.updated_at;
      return new Date(dateA).getTime() - new Date(dateB).getTime();
    });
    return map;
  }, [cases]);

  const visibleColumns = (columnOrder ?? COLUMNS).filter(
    (col) => !(hiddenColumns ?? []).includes(col)
  ) as KanbanColumn[];

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 -mx-3 px-3 sm:mx-0 sm:px-0">
      {visibleColumns.map((status) => (
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
                      <PriorityBadge priority={c.priority} />
                      {billing && (
                        <BillingBadge status={billing.billing_status} billingType={billing.billing_type} />
                      )}
                      {(() => {
                        const checklist = (c.internal_checklist ?? []);
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
                    {(c as any).docs_received_at && status === "documentos_em_analise" && (
                      <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Recebido: {new Date((c as any).docs_received_at).toLocaleDateString("pt-BR")}
                      </p>
                    )}
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
