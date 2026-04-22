import { useState, useMemo } from "react";
import { formatCPF } from "@/lib/format-utils";

import {
  Users, Clock, PlayCircle, AlertTriangle, CheckCircle,
  ArrowRight, Filter,
  FileText, Bell, Send, Ban,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
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
import { STATUS_LABELS } from "@/lib/types";
import { useUnreadMessages } from "@/hooks/use-unread-messages";
import { MessageCircle } from "lucide-react";
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
  const [statFilter, setStatFilter] = useState<string | null>(null);

  const { data: unreadMessages = [] } = useUnreadMessages();

  // Extract unique owners
  const owners = useMemo(() => {
    const set = new Set<string>();
    cases.forEach((c) => { if (c.internal_owner) set.add(c.internal_owner); });
    return Array.from(set).sort();
  }, [cases]);

  // Filtered cases by owner
  const filtered = useMemo(() => {
    if (ownerFilter === "todos") return cases;
    if (ownerFilter === "sem_responsavel") return cases.filter((c) => !c.internal_owner);
    return cases.filter((c) => c.internal_owner === ownerFilter);
  }, [cases, ownerFilter]);

  const total = filtered.length;
  const byStatus = (s: CaseStatus) => filtered.filter((c) => c.status === s).length;
  const previaEnviada = filtered.filter((c) => {
    if (c.status === "finalizado") return false;
    const fd = Array.isArray(c.final_deliverables) ? c.final_deliverables[0] : c.final_deliverables;
    return fd?.preview_file_url && fd?.preview_status !== "aprovado";
  }).length;



  // Cases filtered by stat card click
  const statFilteredCases = useMemo(() => {
    if (!statFilter) return null;
    switch (statFilter) {
      case "total": return filtered;
      case "aguardando_cliente": return filtered.filter((c) => c.status === "aguardando_cliente");
      case "documentos_em_analise": return filtered.filter((c) => c.status === "documentos_em_analise");
      case "em_andamento": return filtered.filter((c) => c.status === "em_andamento");
      case "pendencia": return filtered.filter((c) => c.status === "pendencia");
      case "previa_enviada": return filtered.filter((c) => { if (c.status === "finalizado") return false; const fd = Array.isArray(c.final_deliverables) ? c.final_deliverables[0] : c.final_deliverables; return fd?.preview_file_url && fd?.preview_status !== "aprovado"; });
      case "finalizado": return filtered.filter((c) => c.status === "finalizado");
      case "dispensada": return filtered.filter((c) => c.status === "dispensada");
      default: return null;
    }
  }, [statFilter, filtered, unreadMessages]);

  const statFilterLabels: Record<string, string> = {
    total: "Total de Demandas",
    aguardando_cliente: "Aguardando Cliente",
    documentos_em_analise: "Documentos em Análise",
    em_andamento: "Em Andamento",
    pendencia: "Pendências",
    previa_enviada: "Prévias Enviadas",
    finalizado: "Finalizados",
    dispensada: "Dispensadas",
  };

  const toggleStatFilter = (key: string) => {
    setStatFilter((prev) => (prev === key ? null : key));
  };

  const recentCases = useMemo(() => filtered.slice(0, 5), [filtered]);
  const urgentCases = useMemo(
    () => filtered.filter((c) => c.priority === "urgente" || c.status === "pendencia").slice(0, 5),
    [filtered]
  );

  return (
    <InternalLayout>
      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Filter className="h-4 w-4" />
            <span>Responsável:</span>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Select value={ownerFilter} onValueChange={setOwnerFilter}>
              <SelectTrigger className="w-full sm:w-[220px] h-9">
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
              <Button variant="ghost" size="sm" onClick={() => setOwnerFilter("todos")} className="text-xs h-8 shrink-0">
                Limpar
              </Button>
            )}
          </div>
        </div>

        {/* Stat Cards */}
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
              <StatCard label="Total de Demandas" value={total} icon={Users} color="text-primary" onClick={() => toggleStatFilter("total")} active={statFilter === "total"} />
              <StatCard label="Aguardando Cliente" value={byStatus("aguardando_cliente")} icon={Clock} color="text-warning" onClick={() => toggleStatFilter("aguardando_cliente")} active={statFilter === "aguardando_cliente"} />
              <StatCard label="Docs em Análise" value={byStatus("documentos_em_analise")} icon={FileText} color="text-blue-500" onClick={() => toggleStatFilter("documentos_em_analise")} active={statFilter === "documentos_em_analise"} />
              <StatCard label="Em Andamento" value={byStatus("em_andamento")} icon={PlayCircle} color="text-info" onClick={() => toggleStatFilter("em_andamento")} active={statFilter === "em_andamento"} />
              <StatCard label="Pendências" value={byStatus("pendencia")} icon={AlertTriangle} color="text-destructive" onClick={() => toggleStatFilter("pendencia")} active={statFilter === "pendencia"} />
              <StatCard label="Prévias Enviadas" value={previaEnviada} icon={Send} color="text-violet-500" onClick={() => toggleStatFilter("previa_enviada")} active={statFilter === "previa_enviada"} />
              <StatCard label="Finalizados" value={byStatus("finalizado")} icon={CheckCircle} color="text-success" onClick={() => toggleStatFilter("finalizado")} active={statFilter === "finalizado"} />
              <StatCard label="Dispensadas" value={byStatus("dispensada")} icon={Ban} color="text-muted-foreground" onClick={() => toggleStatFilter("dispensada")} active={statFilter === "dispensada"} />
            </div>

            {/* Filtered cases list from stat card click */}
            {statFilter && statFilteredCases && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{statFilterLabels[statFilter]}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">{statFilteredCases.length} demandas</Badge>
                      <Button variant="ghost" size="sm" onClick={() => setStatFilter(null)} className="text-xs h-7">
                        Fechar
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {statFilteredCases.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">Nenhuma demanda nesta categoria.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-80 overflow-y-auto">
                      {statFilteredCases.map((c) => (
                        <Link
                          key={c.id}
                          to={`/demandas/${c.id}`}
                          className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{c.clients?.full_name}</p>
                            <p className="text-xs text-muted-foreground">{formatCPF(c.clients?.cpf)} · {c.internal_owner ?? "Sem responsável"}</p>
                          </div>
                          <StatusBadge status={c.status} />
                          <PriorityBadge priority={c.priority} />
                          <div className="w-16 hidden sm:block">
                            <Progress value={c.progress_percent} className="h-1.5" />
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Unread Messages */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-primary" />
                Mensagens Não Lidas
              </CardTitle>
              {unreadMessages.length > 0 && (
                <Badge variant="destructive" className="text-xs">{unreadMessages.length} não lidas</Badge>
              )}
            </div>
            <CardDescription>Mensagens dos clientes aguardando resposta</CardDescription>
          </CardHeader>
          <CardContent>
            {unreadMessages.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="h-8 w-8 text-success mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Todas as mensagens foram respondidas!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {unreadMessages.map((item) => (
                  <Link
                    key={item.case_id}
                    to={`/demandas/${item.case_id}`}
                    className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="mt-0.5 rounded-full p-1.5 shrink-0 bg-destructive/10">
                      <MessageCircle className="h-3.5 w-3.5 text-destructive" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{item.client_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{item.last_message}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-[10px] text-muted-foreground">{formatTimeAgo(item.last_message_at)}</span>
                      {item.unread_count > 1 && (
                        <Badge variant="destructive" className="text-[10px] h-4 px-1.5">{item.unread_count}</Badge>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Access Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
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
                        <p className="text-xs text-muted-foreground">{formatCPF(c.clients?.cpf)} · {c.internal_owner ?? "Sem responsável"}</p>
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
      </div>
    </InternalLayout>
  );
}
