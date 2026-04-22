import { cn } from "@/lib/utils";
import { DemandStatus, BillingStatus, Priority, STATUS_LABELS, BILLING_LABELS, PRIORITY_LABELS } from "@/lib/types";

const statusColors: Record<DemandStatus, string> = {
  aguardando_cliente: "bg-warning/15 text-warning border-warning/30",
  documentos_parciais: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  documentos_em_analise: "bg-info/15 text-info border-info/30",
  em_andamento: "bg-primary/15 text-primary border-primary/30",
  pendencia: "bg-destructive/15 text-destructive border-destructive/30",
  previa_enviada: "bg-purple-500/15 text-purple-600 border-purple-500/30",
  finalizado: "bg-success/15 text-success border-success/30",
  impedida: "bg-rose-500/15 text-rose-600 border-rose-500/30",
  reaberta: "bg-teal-500/15 text-teal-600 border-teal-500/30",
  dispensada: "bg-slate-500/15 text-slate-600 border-slate-500/30",
};

const billingColors: Record<BillingStatus, string> = {
  nao_cobrado: "bg-muted text-muted-foreground border-border",
  cobrado: "bg-warning/15 text-warning border-warning/30",
  pago: "bg-success/15 text-success border-success/30",
};

const priorityColors: Record<Priority, string> = {
  baixa: "bg-muted text-muted-foreground border-border",
  media: "bg-info/15 text-info border-info/30",
  alta: "bg-warning/15 text-warning border-warning/30",
  urgente: "bg-destructive/15 text-destructive border-destructive/30",
};

export function StatusBadge({ status }: { status: DemandStatus }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", statusColors[status])}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export function BillingBadge({ status, billingType }: { status: BillingStatus; billingType?: string }) {
  const isIncluso = billingType === "incluso_mensalidade" && status === "pago";
  const label = isIncluso ? "Incluso no Honorário" : BILLING_LABELS[status];
  const color = isIncluso ? "bg-primary/10 text-primary border-primary/30" : billingColors[status];
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", color)}>
      {label}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", priorityColors[priority])}>
      {PRIORITY_LABELS[priority]}
    </span>
  );
}
