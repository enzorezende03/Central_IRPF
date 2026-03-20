import { useState, useMemo } from "react";
import {
  Users, Clock, PlayCircle, AlertTriangle, CheckCircle,
  DollarSign, TrendingUp, Ban, ArrowRight, Filter,
  FileText, Bell,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { StatCard } from "@/components/StatCard";
import { InternalLayout } from "@/components/InternalLayout";
import { StatusBadge, BillingBadge, PriorityBadge } from "@/components/StatusBadge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useCases } from "@/hooks/use-cases";
import { supabase } from "@/integrations/supabase/client";
import { STATUS_LABELS } from "@/lib/types";
import type { Database } from "@/integrations/supabase/types";

type CaseStatus = Database["public"]["Enums"]["case_status"];

function formatTimeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export default function Dashboard() {
  const { data: cases = [], isLoading } = useCases();
  const [ownerFilter, setOwnerFilter] = useState("todos");

  // Fetch recent client activity from timeline
  const { data: recentActivity = [] } = useQuery({
    queryKey: ["dashboard-activity"],
    queryFn: async () => {
      const { data } = await supabase
        .from("case_timeline")
        .select("*, irpf_cases!inner(id, clients(full_name))")
        .in("event_type", ["Documentação completa", "Ajustes solicitados", "Prévia aprovada"])
        .eq("created_by", "Cliente")
        .order("created_at", { ascending: false })
        .limit(10);
      return (data as any) ?? [];
    },
  });

  // Extract unique owners
  const owners = useMemo(() => {
    const set = new Set<string>();
    cases.forEach((c) => { if (c.internal_owner) set.add(c.internal_owner); });
    return Array.from(set).sort();
  }, [cases]);

  // Filtered cases
  const filtered = useMemo(() => {
    if (ownerFilter === "todos") return cases;
    if (ownerFilter === "sem_responsavel") return cases.filter((c) => !c.internal_owner);
    return cases.filter((c) => c.internal_owner === ownerFilter);
  }, [cases, ownerFilter]);

  const total = filtered.length;
  const byStatus = (s: CaseStatus) => filtered.filter((c) => c.status === s).length;
  const billingPending = filtered.filter((c) => {
    const b = c.billing?.[0];
    return b && b.billing_status !== "pago";
  }).length;
  const totalFees = filtered.reduce((sum, c) => sum + (c.billing?.[0]?.amount ?? 0), 0);
  const totalPaid = filtered
    .filter((c) => c.billing?.[0]?.billing_status === "pago")
    .reduce((sum, c) => sum + (c.billing?.[0]?.amount ?? 0), 0);

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const recentCases = useMemo(() => filtered.slice(0, 5), [filtered]);
  const urgentCases = useMemo(
    () => filtered.filter((c) => c.priority === "urgente" || c.status === "pendencia").slice(0, 5),
    [filtered]
  );

  return (
    <InternalLayout>
      <div className="p-6 space-y-6">
        {/* Filter bar */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Filter className="h-4 w-4" />
            <span>Responsável:</span>
          </div>
          <Select value={ownerFilter} onValueChange={setOwnerFilter}>
            <SelectTrigger className="w-[220px] h-9">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os responsáveis</SelectItem>
              <SelectItem value="sem_responsavel">Sem responsável</SelectItem>
              {owners.map((o) => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {ownerFilter !== "todos" && (
            <Button variant="ghost" size="sm" onClick={() => setOwnerFilter("todos")} className="text-xs h-8">
              Limpar filtro
            </Button>
          )}
        </div>

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
                <p className="text-sm text-muted-foreground text-center py-8">Nenhuma demanda encontrada.</p>
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
                  {urgentCases.map((c) => (
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
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Client Activity Notifications */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />
                Atividade dos Clientes
              </CardTitle>
              {recentActivity.length > 0 && (
                <Badge variant="secondary" className="text-xs">{recentActivity.length} recentes</Badge>
              )}
            </div>
            <CardDescription>Ações recentes dos clientes no portal</CardDescription>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum cliente finalizou o envio ainda.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentActivity.map((item: any) => {
                  const clientName = item.irpf_cases?.clients?.full_name ?? "Cliente";
                  const caseId = item.irpf_cases?.id ?? item.case_id;
                  const timeAgo = formatTimeAgo(item.created_at);

                  return (
                    <Link
                      key={item.id}
                      to={`/demandas/${caseId}`}
                      className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className={`mt-0.5 rounded-full p-1.5 shrink-0 ${
                        item.event_type === "Ajustes solicitados" ? "bg-warning/10" :
                        item.event_type === "Prévia aprovada" ? "bg-primary/10" : "bg-success/10"
                      }`}>
                        {item.event_type === "Ajustes solicitados" ? (
                          <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                        ) : item.event_type === "Prévia aprovada" ? (
                          <CheckCircle className="h-3.5 w-3.5 text-primary" />
                        ) : (
                          <CheckCircle className="h-3.5 w-3.5 text-success" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{clientName}</p>
                        <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">{timeAgo}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </InternalLayout>
  );
}
