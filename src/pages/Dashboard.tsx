import { useMemo } from "react";
import {
  Users, Clock, PlayCircle, AlertTriangle, CheckCircle,
  DollarSign, TrendingUp, Ban, ArrowRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import { StatCard } from "@/components/StatCard";
import { InternalLayout } from "@/components/InternalLayout";
import { StatusBadge, BillingBadge, PriorityBadge } from "@/components/StatusBadge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useCases } from "@/hooks/use-cases";
import { STATUS_LABELS } from "@/lib/types";
import type { Database } from "@/integrations/supabase/types";

type CaseStatus = Database["public"]["Enums"]["case_status"];

export default function Dashboard() {
  const { data: cases = [], isLoading } = useCases();

  const total = cases.length;
  const byStatus = (s: CaseStatus) => cases.filter((c) => c.status === s).length;
  const billingPending = cases.filter((c) => {
    const b = c.billing?.[0];
    return b && b.billing_status !== "pago";
  }).length;
  const totalFees = cases.reduce((sum, c) => sum + (c.billing?.[0]?.amount ?? 0), 0);
  const totalPaid = cases
    .filter((c) => c.billing?.[0]?.billing_status === "pago")
    .reduce((sum, c) => sum + (c.billing?.[0]?.amount ?? 0), 0);

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // Recent 5 cases
  const recentCases = useMemo(() => cases.slice(0, 5), [cases]);

  // Urgent/pending cases
  const urgentCases = useMemo(
    () => cases.filter((c) => c.priority === "urgente" || c.status === "pendencia").slice(0, 5),
    [cases]
  );

  return (
    <InternalLayout>
      <div className="p-6 space-y-6">
        {/* Stat Cards */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Total de Demandas" value={total} icon={Users} color="text-primary" />
              <StatCard label="Aguardando Cliente" value={byStatus("aguardando_cliente")} icon={Clock} color="text-warning" />
              <StatCard label="Em Andamento" value={byStatus("em_andamento") + byStatus("documentos_em_analise")} icon={PlayCircle} color="text-info" />
              <StatCard label="Pendências" value={byStatus("pendencia")} icon={AlertTriangle} color="text-destructive" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Finalizados" value={byStatus("finalizado")} icon={CheckCircle} color="text-success" />
              <StatCard label="Cobrança Pendente" value={billingPending} icon={Ban} color="text-warning" />
              <StatCard label="Honorários Previstos" value={fmt(totalFees)} icon={TrendingUp} color="text-primary" subtitle="Total previsto" />
              <StatCard label="Já Recebido" value={fmt(totalPaid)} icon={DollarSign} color="text-success" subtitle="Total pago" />
            </div>
          </>
        )}

        {/* Quick Access Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Cases */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Demandas Recentes</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/demandas" className="text-xs">
                    Ver todas <ArrowRight className="h-3 w-3 ml-1" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-40" />
              ) : recentCases.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhuma demanda cadastrada.</p>
              ) : (
                <div className="space-y-2">
                  {recentCases.map((c) => (
                    <Link
                      key={c.id}
                      to={`/demandas/${c.id}`}
                      className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{c.clients?.full_name}</p>
                        <p className="text-xs text-muted-foreground">{c.clients?.cpf} · {c.internal_owner ?? "Sem responsável"}</p>
                      </div>
                      <StatusBadge status={c.status} />
                      <div className="w-16 hidden sm:block">
                        <Progress value={c.progress_percent} className="h-1.5" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Urgent / Pending */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  Atenção Necessária
                </CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/demandas" className="text-xs">
                    Ver todas <ArrowRight className="h-3 w-3 ml-1" />
                  </Link>
                </Button>
              </div>
              <CardDescription>Demandas urgentes ou com pendências</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-40" />
              ) : urgentCases.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-8 w-8 text-success mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhuma pendência urgente!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {urgentCases.map((c) => {
                    const billing = c.billing?.[0];
                    return (
                      <Link
                        key={c.id}
                        to={`/demandas/${c.id}`}
                        className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{c.clients?.full_name}</p>
                          <p className="text-xs text-muted-foreground">{c.internal_owner ?? "Sem responsável"}</p>
                        </div>
                        <PriorityBadge priority={c.priority} />
                        <StatusBadge status={c.status} />
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </InternalLayout>
  );
}
