import { useMemo, useState } from "react";
import { formatCPF } from "@/lib/format-utils";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { CaseWithClient } from "@/hooks/use-cases";
import { STATUS_LABELS } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PriorityBadge, BillingBadge } from "@/components/StatusBadge";
import { CheckCircle2, AlertCircle, Clock, CalendarPlus } from "lucide-react";
import { AddToWeekDialog } from "@/components/AddToWeekDialog";
import { useAllPlanItems } from "@/hooks/use-weekly-plan";

import type { Database } from "@/integrations/supabase/types";

type CaseStatus = Database["public"]["Enums"]["case_status"];

// Real DB statuses + virtual "previa_enviada" column
type KanbanColumn = Exclude<CaseStatus, "dispensada" | "reaberta"> | "previa_enviada";

const COLUMNS: KanbanColumn[] = [
  "aguardando_cliente",
  "documentos_parciais",
  "documentos_em_analise",
  "em_andamento",
  "impedida",
  "previa_enviada",
  "previa_aprovada",
  "pendencia",
  "finalizado",
];

const COLUMN_LABELS: Record<KanbanColumn, string> = {
  aguardando_cliente: STATUS_LABELS.aguardando_cliente,
  documentos_parciais: STATUS_LABELS.documentos_parciais,
  documentos_em_analise: STATUS_LABELS.documentos_em_analise,
  em_andamento: STATUS_LABELS.em_andamento,
  impedida: STATUS_LABELS.impedida,
  previa_enviada: "Prévia Enviada",
  previa_aprovada: "Prévia Aprovada",
  pendencia: STATUS_LABELS.pendencia,
  finalizado: STATUS_LABELS.finalizado,
};

const columnColors: Record<KanbanColumn, string> = {
  aguardando_cliente: "border-t-warning",
  documentos_parciais: "border-t-orange-500",
  documentos_em_analise: "border-t-info",
  em_andamento: "border-t-primary",
  impedida: "border-t-rose-500",
  previa_enviada: "border-t-violet-500",
  previa_aprovada: "border-t-emerald-500",
  pendencia: "border-t-destructive",
  finalizado: "border-t-success",
};

const dotColors: Record<KanbanColumn, string> = {
  aguardando_cliente: "bg-warning",
  documentos_parciais: "bg-orange-500",
  documentos_em_analise: "bg-info",
  em_andamento: "bg-primary",
  impedida: "bg-rose-500",
  previa_enviada: "bg-violet-500",
  previa_aprovada: "bg-emerald-500",
  pendencia: "bg-destructive",
  finalizado: "bg-success",
};

export function KanbanBoard({ cases, columnOrder, hiddenColumns }: { cases: CaseWithClient[]; columnOrder?: string[]; hiddenColumns?: string[] }) {
  const [planCase, setPlanCase] = useState<CaseWithClient | null>(null);
  const { data: planItems = [] } = useAllPlanItems();
  const planByCase = useMemo(() => {
    const m = new Map<string, { week_number: number }>();
    planItems.forEach((p) => m.set(p.case_id, { week_number: p.week_number }));
    return m;
  }, [planItems]);
  const grouped = useMemo(() => {
    const map: Record<KanbanColumn, CaseWithClient[]> = {
      aguardando_cliente: [],
      documentos_parciais: [],
      documentos_em_analise: [],
      em_andamento: [],
      impedida: [],
      previa_enviada: [],
      previa_aprovada: [],
      pendencia: [],
      finalizado: [],
    };
    cases.forEach((c) => {
      const status = c.status as string;

      // Skip dispensadas from Kanban
      if (status === "dispensada") return;

      // Check if case has preview sent and awaiting approval (virtual column)
      if (status !== "finalizado") {
        const fd = Array.isArray(c.final_deliverables) ? c.final_deliverables[0] : c.final_deliverables;
        if (fd?.preview_file_url && fd?.preview_status !== "aprovado") {
          map.previa_enviada.push(c);
          return;
        }
      }

      // Reaberta maps to em_andamento
      if (status === "reaberta") {
        map.em_andamento.push(c);
        return;
      }

      // Direct mapping for all real statuses
      if (map[status as KanbanColumn]) {
        map[status as KanbanColumn].push(c);
      }
    });

    // Sort documentos_em_analise by docs_received_at (earliest first)
    map.documentos_em_analise.sort((a, b) => {
      const dateA = a.docs_received_at ?? a.updated_at;
      const dateB = b.docs_received_at ?? b.updated_at;
      return new Date(dateA).getTime() - new Date(dateB).getTime();
    });

    return map;
  }, [cases]);

  const visibleColumns = (columnOrder ?? COLUMNS).filter(
    (col) => COLUMNS.includes(col as KanbanColumn) && !(hiddenColumns ?? []).includes(col)
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
              {grouped[status]?.length ?? 0}
            </span>
          </div>
          <div className="p-2 space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto">
            {(grouped[status] ?? []).map((c, i) => {
              const billing = c.billing?.[0];
              const planInfo = c.status === "finalizado" ? undefined : planByCase.get(c.id);
              return (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <div className="relative group">
                    <Link
                      to={`/demandas/${c.id}`}
                      className={`block p-3 rounded-lg border-2 hover:shadow-md transition-shadow cursor-pointer ${
                        planInfo
                          ? "bg-violet-500/15 border-violet-500 ring-2 ring-violet-500/40 shadow-sm shadow-violet-500/20"
                          : "bg-background border-border"
                      }`}
                    >
                      <p className="text-sm font-medium truncate pr-7">
                        {c.clients?.full_name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatCPF(c.clients?.cpf)} · {c.internal_owner ?? "Sem responsável"}
                      </p>
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <PriorityBadge priority={c.priority} />
                      {planInfo && (
                        <Badge className="bg-violet-500 text-white hover:bg-violet-500 text-xs gap-1 border-0">
                          <CalendarPlus className="h-3 w-3" /> Planejada · S{planInfo.week_number}
                        </Badge>
                      )}
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
                    {status === "documentos_em_analise" && (() => {
                      const receivedDate = c.docs_received_at ?? c.updated_at;
                      if (!receivedDate) return null;
                      return (
                        <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Recebido: {new Date(receivedDate).toLocaleDateString("pt-BR")}
                          {!c.docs_received_at && <span className="opacity-60">(aprox.)</span>}
                        </p>
                      );
                    })()}
                    {billing && (
                      <p className="text-xs font-medium mt-1.5 text-right text-muted-foreground">
                        {fmt(billing.amount)}
                      </p>
                    )}
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-1.5 right-1.5 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 hover:bg-background"
                      title="Enviar ao planejamento semanal"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPlanCase(c); }}
                    >
                      <CalendarPlus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </motion.div>
              );
            })}
            {(grouped[status]?.length ?? 0) === 0 && (
              <p className="text-xs text-muted-foreground text-center py-8">
                Nenhuma demanda
              </p>
            )}
          </div>
        </div>
      ))}
      {planCase && (
        <AddToWeekDialog
          open={!!planCase}
          onOpenChange={(o) => { if (!o) setPlanCase(null); }}
          caseId={planCase.id}
          internalOwner={planCase.internal_owner}
          clientName={planCase.clients?.full_name ?? null}
        />
      )}
    </div>
  );
}
