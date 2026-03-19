import { Users, Clock, PlayCircle, AlertTriangle, CheckCircle, DollarSign, TrendingUp, Ban } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { mockDemands } from "@/lib/mock-data";
import { InternalLayout } from "@/components/InternalLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { DemandStatus } from "@/lib/types";

export default function Dashboard() {
  const demands = mockDemands;
  const total = demands.length;
  const byStatus = (s: DemandStatus) => demands.filter(d => d.status === s).length;
  const billingPending = demands.filter(d => d.billing_status !== 'pago').length;
  const totalFees = demands.reduce((sum, d) => sum + d.fee_amount, 0);
  const totalPaid = demands.filter(d => d.billing_status === 'pago').reduce((sum, d) => sum + d.fee_amount, 0);

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const recentDemands = [...demands].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 5);

  return (
    <InternalLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Visão geral da Central IRPF 2026</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total de Clientes" value={total} icon={Users} color="text-primary" />
          <StatCard label="Aguardando Cliente" value={byStatus('aguardando_cliente')} icon={Clock} color="text-warning" />
          <StatCard label="Em Andamento" value={byStatus('em_andamento') + byStatus('documentos_em_analise')} icon={PlayCircle} color="text-info" />
          <StatCard label="Pendências" value={byStatus('pendencia')} icon={AlertTriangle} color="text-destructive" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Finalizados" value={byStatus('finalizado')} icon={CheckCircle} color="text-success" />
          <StatCard label="Cobrança Pendente" value={billingPending} icon={Ban} color="text-warning" />
          <StatCard label="Honorários Previstos" value={fmt(totalFees)} icon={TrendingUp} color="text-primary" subtitle="Total previsto" />
          <StatCard label="Já Recebido" value={fmt(totalPaid)} icon={DollarSign} color="text-success" subtitle="Total pago" />
        </div>

        <div className="rounded-xl border bg-card shadow-sm">
          <div className="p-5 border-b">
            <h2 className="text-base font-semibold">Atividade Recente</h2>
          </div>
          <div className="divide-y">
            {recentDemands.map(d => (
              <div key={d.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                <div>
                  <p className="text-sm font-medium">{d.client?.name}</p>
                  <p className="text-xs text-muted-foreground">{d.responsible} · {d.client?.cpf}</p>
                </div>
                <StatusBadge status={d.status} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </InternalLayout>
  );
}
