import { cn } from "@/lib/utils";
import { DemandStatus, BillingStatus, Priority, STATUS_LABELS, BILLING_LABELS, PRIORITY_LABELS } from "@/lib/types";

const statusColors: Record<DemandStatus, string> = {
  aguardando_cliente: "bg-warning/15 text-warning border-warning/30",
  documentos_em_analise: "bg-info/15 text-info border-info/30",
  em_andamento: "bg-primary/15 text-primary border-primary/30",
  pendencia: "bg-destructive/15 text-destructive border-destructive/30",
  finalizado: "bg-success/15 text-success border-success/30",
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

export function BillingBadge({ status }: { status: BillingStatus }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", billingColors[status])}>
      {BILLING_LABELS[status]}
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
