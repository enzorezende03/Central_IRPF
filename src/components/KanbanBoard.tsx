import { useMemo } from "react";
import { formatCPF } from "@/lib/format-utils";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { CaseWithClient } from "@/hooks/use-cases";
import { STATUS_LABELS } from "@/lib/types";
import { BillingBadge, PriorityBadge } from "@/components/StatusBadge";
import { Progress } from "@/components/ui/progress";
import type { Database } from "@/integrations/supabase/types";

type CaseStatus = Database["public"]["Enums"]["case_status"];

const COLUMNS: CaseStatus[] = [
  "aguardando_cliente",
  "documentos_em_analise",
  "em_andamento",
  "pendencia",
  "finalizado",
];

const columnColors: Record<CaseStatus, string> = {
  aguardando_cliente: "border-t-warning",
  documentos_em_analise: "border-t-info",
  em_andamento: "border-t-primary",
  pendencia: "border-t-destructive",
  finalizado: "border-t-success",
};

const dotColors: Record<CaseStatus, string> = {
  aguardando_cliente: "bg-warning",
  documentos_em_analise: "bg-info",
  em_andamento: "bg-primary",
  pendencia: "bg-destructive",
  finalizado: "bg-success",
};

export function KanbanBoard({ cases }: { cases: CaseWithClient[] }) {
  const grouped = useMemo(() => {
    const map: Record<CaseStatus, CaseWithClient[]> = {
      aguardando_cliente: [],
      documentos_em_analise: [],
      em_andamento: [],
      pendencia: [],
      finalizado: [],
    };
    cases.forEach((c) => {
      if (map[c.status]) map[c.status].push(c);
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
              <span className="text-sm font-semibold">{STATUS_LABELS[status]}</span>
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
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <span>Progresso</span>
                        <span>{c.progress_percent}%</span>
                      </div>
                      <Progress value={c.progress_percent} className="h-1.5" />
                    </div>
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <PriorityBadge priority={c.priority} />
                      {billing && <BillingBadge status={billing.billing_status} billingType={billing.billing_type} />}
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
