import { useState, useMemo } from "react";
import {
  Users, Clock, PlayCircle, AlertTriangle, CheckCircle,
  DollarSign, TrendingUp, Ban, Search, LayoutGrid, Table as TableIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import { StatCard } from "@/components/StatCard";
import { InternalLayout } from "@/components/InternalLayout";
import { StatusBadge, BillingBadge, PriorityBadge } from "@/components/StatusBadge";
import { CaseActions } from "@/components/CaseActions";
import { KanbanBoard } from "@/components/KanbanBoard";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useCases, CaseWithClient } from "@/hooks/use-cases";
import { STATUS_LABELS, BILLING_LABELS, PRIORITY_LABELS } from "@/lib/types";
import type { Database } from "@/integrations/supabase/types";

type CaseStatus = Database["public"]["Enums"]["case_status"];
type CasePriority = Database["public"]["Enums"]["case_priority"];
type BillingStatus = Database["public"]["Enums"]["billing_status"];

export default function Dashboard() {
  const { data: cases = [], isLoading } = useCases();
  const [view, setView] = useState<"table" | "kanban">("table");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [billingFilter, setBillingFilter] = useState("all");

  const owners = useMemo(() => {
    const set = new Set<string>();
    cases.forEach((c) => c.internal_owner && set.add(c.internal_owner));
    return Array.from(set).sort();
  }, [cases]);

  const filtered = useMemo(() => {
    return cases.filter((c) => {
      const q = search.toLowerCase();
      const name = c.clients?.full_name?.toLowerCase() ?? "";
      const cpf = c.clients?.cpf ?? "";
      const matchSearch = !q || name.includes(q) || cpf.includes(q);
      const matchStatus = statusFilter === "all" || c.status === statusFilter;
      const matchOwner = ownerFilter === "all" || c.internal_owner === ownerFilter;
      const matchPriority = priorityFilter === "all" || c.priority === priorityFilter;
      const billing = c.billing?.[0];
      const matchBilling = billingFilter === "all" || billing?.billing_status === billingFilter;
      return matchSearch && matchStatus && matchOwner && matchPriority && matchBilling;
    });
  }, [cases, search, statusFilter, ownerFilter, priorityFilter, billingFilter]);

  // Stats
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

  return (
    <InternalLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Visão geral da Central IRPF 2026</p>
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

        {/* Filters */}
        <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou CPF..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={ownerFilter} onValueChange={setOwnerFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Responsável" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos responsáveis</SelectItem>
                {owners.map((o) => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Prioridade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={billingFilter} onValueChange={setBillingFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Cobrança" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas cobranças</SelectItem>
                {Object.entries(BILLING_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-1 border rounded-lg p-0.5">
            <Button
              variant={view === "table" ? "default" : "ghost"}
              size="sm"
              onClick={() => setView("table")}
            >
              <TableIcon className="h-4 w-4 mr-1" />
              Tabela
            </Button>
            <Button
              variant={view === "kanban" ? "default" : "ghost"}
              size="sm"
              onClick={() => setView("kanban")}
            >
              <LayoutGrid className="h-4 w-4 mr-1" />
              Kanban
            </Button>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <Skeleton className="h-96 rounded-xl" />
        ) : view === "kanban" ? (
          <KanbanBoard cases={filtered} />
        ) : (
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="hidden md:table-cell">CPF</TableHead>
                  <TableHead className="hidden lg:table-cell">Ano-base</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Progresso</TableHead>
                  <TableHead className="hidden md:table-cell">Prioridade</TableHead>
                  <TableHead className="hidden lg:table-cell">Cobrança</TableHead>
                  <TableHead className="hidden lg:table-cell text-right">Honorário</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => {
                  const billing = c.billing?.[0];
                  return (
                    <TableRow key={c.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">
                        <Link to={`/clients/${c.id}`} className="hover:text-primary transition-colors">
                          {c.clients?.full_name}
                        </Link>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                        {c.clients?.cpf}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">
                        {c.base_year}
                      </TableCell>
                      <TableCell className="text-sm">{c.internal_owner ?? "—"}</TableCell>
                      <TableCell>
                        <StatusBadge status={c.status} />
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="flex items-center gap-2 min-w-[100px]">
                          <Progress value={c.progress_percent} className="h-1.5 flex-1" />
                          <span className="text-xs text-muted-foreground w-8">{c.progress_percent}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <PriorityBadge priority={c.priority} />
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {billing && <BillingBadge status={billing.billing_status} />}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-right text-sm font-medium">
                        {billing ? fmt(billing.amount) : "—"}
                      </TableCell>
                      <TableCell>
                        <CaseActions caseData={c} />
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-10 text-muted-foreground">
                      {cases.length === 0
                        ? "Nenhuma demanda cadastrada ainda."
                        : "Nenhuma demanda encontrada com os filtros aplicados."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </InternalLayout>
  );
}
