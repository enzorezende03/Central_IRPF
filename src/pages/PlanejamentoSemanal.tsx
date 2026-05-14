import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { InternalLayout } from "@/components/InternalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  CalendarCheck, Plus, X, ExternalLink, Search, Lock, AlertTriangle, ArrowRight,
  ChevronLeft, ChevronRight, MoreVertical, FilePen, CalendarPlus,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useSeasons, useWeeklyGoals } from "@/hooks/use-irpf-goals";
import {
  useSeasonPlan, useAddToPlan, useRemoveFromPlan, useEligibleCases,
  useMovePlanWeek, useProcuracaoFlags, getReferenceDate, type EligibleCase,
} from "@/hooks/use-weekly-plan";
import {
  useCapacities, getCapacityFor, DEFAULT_WEEKLY_CAPACITY,
} from "@/hooks/use-weekly-capacity";
import { useOperators } from "@/hooks/use-operators";
import { parseISODate, addDays, formatBR } from "@/lib/goals-utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const COMPLETED_STATUSES = new Set(["finalizado", "previa_enviada", "dispensada"]);
const QUEUE_STATUSES = new Set(["documentos_em_analise", "em_andamento"]);

const STATUS_LABELS: Record<string, string> = {
  aguardando_cliente: "Aguardando Cliente",
  documentos_parciais: "Documentos Parciais",
  documentos_em_analise: "Documentos em Análise",
  em_andamento: "Em Andamento",
  pendencia: "Pendência",
  previa_enviada: "Prévia Enviada",
  previa_aprovada: "Prévia Aprovada",
  finalizado: "Finalizado",
  impedida: "Impedida",
  dispensada: "Dispensada",
  reaberta: "Reaberta",
  solicitacao_documentacao: "Solicitação de Documentação",
  procuracao: "Procuração",
};

const PRIORITY_LABELS: Record<string, string> = {
  alta: "Alta", media: "Média", baixa: "Baixa",
};
const priorityVariant = (p: string | null): "destructive" | "secondary" | "outline" =>
  p === "alta" ? "destructive" : p === "baixa" ? "outline" : "secondary";

interface CaseLite {
  id: string;
  status: string;
  internal_owner: string | null;
  priority: string | null;
  client_name: string | null;
}

function useCasesByIds(ids: string[]) {
  const key = useMemo(() => [...ids].sort().join(","), [ids]);
  return useQuery({
    queryKey: ["planning_cases_by_ids", key],
    enabled: ids.length > 0,
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("irpf_cases")
        .select("id, status, internal_owner, priority, clients(full_name)")
        .in("id", ids);
      if (error) throw error;
      return ((data || []) as any[]).map<CaseLite>((c) => ({
        id: c.id,
        status: c.status,
        internal_owner: c.internal_owner,
        priority: c.priority,
        client_name: c.clients?.full_name ?? null,
      }));
    },
  });
}

export default function PlanejamentoSemanal() {
  const { hasPermission, role, loading: authLoading } = useAuth();
  const canView = hasPermission("acesso_metas");
  const isAdmin = role === "admin";

  const { data: seasons = [] } = useSeasons();
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  useEffect(() => {
    if (seasons.length === 0 || selectedYear !== null) return;
    const y = new Date().getFullYear();
    const m = seasons.find((s) => s.season_year === y);
    setSelectedYear(m?.season_year ?? seasons[0].season_year);
  }, [seasons, selectedYear]);

  const season = useMemo(
    () => seasons.find((s) => s.season_year === selectedYear) ?? null,
    [seasons, selectedYear]
  );

  if (!authLoading && !canView) {
    return (
      <InternalLayout>
        <div className="container mx-auto py-12 px-4 max-w-2xl">
          <Card className="border-dashed">
            <CardContent className="py-16 flex flex-col items-center justify-center text-center gap-4">
              <Lock className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground max-w-md">
                Você não tem permissão para acessar o Planejamento Semanal.
              </p>
            </CardContent>
          </Card>
        </div>
      </InternalLayout>
    );
  }

  return (
    <InternalLayout>
      <div className="container mx-auto py-6 px-4 space-y-5 max-w-[1500px]">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-primary/60 grid place-items-center shadow-lg shadow-primary/20">
              <CalendarCheck className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Planejamento Semanal</h1>
              <p className="text-sm text-muted-foreground">
                {isAdmin
                  ? "Distribua e acompanhe as demandas da semana por operadora"
                  : "Suas demandas planejadas para a semana"}
              </p>
            </div>
          </div>
          {isAdmin && seasons.length > 0 && (
            <Select value={selectedYear?.toString() ?? ""} onValueChange={(v) => setSelectedYear(Number(v))}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Temporada" /></SelectTrigger>
              <SelectContent>
                {seasons.map((s) => (
                  <SelectItem key={s.id} value={s.season_year.toString()}>Temporada {s.season_year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {!season ? (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center text-sm text-muted-foreground">
              Configure uma temporada em <strong>Metas IRPF</strong> para começar.
            </CardContent>
          </Card>
        ) : isAdmin ? (
          <AdminPlanContent season={season} />
        ) : (
          <OperationalView season={season} />
        )}
      </div>
    </InternalLayout>
  );
}

/* ---------------- OPERATIONAL VIEW (read-only) ---------------- */

function OperationalView({ season }: { season: any }) {
  const { profileName } = useAuth();
  const { data: weeks = [] } = useWeeklyGoals(season.id);
  const { data: plan = [] } = useSeasonPlan(season.id);

  const today = useMemo(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }, []);
  const currentWeek = useMemo(() => {
    return weeks.find((w) => {
      const ws = parseISODate(w.week_start);
      const we = addDays(parseISODate(w.week_end), 1);
      return today >= ws && today < we;
    }) ?? null;
  }, [weeks, today]);

  const myItems = useMemo(() => {
    if (!currentWeek || !profileName) return [];
    return plan.filter(
      (p) => p.week_number === currentWeek.week_number && (p.responsible ?? "") === profileName
    );
  }, [plan, currentWeek, profileName]);

  const ids = useMemo(() => myItems.map((p) => p.case_id), [myItems]);
  const { data: cases = [] } = useCasesByIds(ids);
  const byId = useMemo(() => {
    const m = new Map<string, CaseLite>();
    cases.forEach((c) => m.set(c.id, c));
    return m;
  }, [cases]);

  return (
    <>
      <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        Seu planejamento desta semana · para editar, fale com a coordenação.
      </div>

      {!profileName ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Configure seu nome no perfil para ver seu planejamento.
          </CardContent>
        </Card>
      ) : !currentWeek ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhuma semana configurada para a temporada.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              S{currentWeek.week_number} — {formatBR(parseISODate(currentWeek.week_start))} a {formatBR(parseISODate(currentWeek.week_end))}
            </CardTitle>
            <p className="text-xs text-muted-foreground">{myItems.length} demandas planejadas</p>
          </CardHeader>
          <CardContent>
            {myItems.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhuma demanda planejada para você nesta semana.
              </p>
            ) : (
              <div className="space-y-1.5">
                {myItems.map((p) => {
                  const c = byId.get(p.case_id);
                  return (
                    <Link
                      key={p.id}
                      to={`/demandas/${p.case_id}`}
                      className="flex items-center gap-2 p-2.5 rounded-md border hover:border-primary/50 hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{c?.client_name ?? "—"}</div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <Badge variant="secondary" className="text-[10px]">
                            {STATUS_LABELS[c?.status ?? ""] ?? c?.status ?? "—"}
                          </Badge>
                          {c?.priority && (
                            <Badge variant={priorityVariant(c.priority)} className="text-[10px]">
                              {PRIORITY_LABELS[c.priority] ?? c.priority}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}

/* ---------------- ADMIN VIEW ---------------- */

function AdminPlanContent({ season }: { season: any }) {
  const { data: weeks = [] } = useWeeklyGoals(season.id);
  const { data: plan = [] } = useSeasonPlan(season.id);
  const { data: eligible = [] } = useEligibleCases();
  const { data: capacities = [] } = useCapacities();
  const { data: operators = [] } = useOperators();

  const add = useAddToPlan();
  const remove = useRemoveFromPlan();
  const move = useMovePlanWeek();

  const today = useMemo(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }, []);

  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  useEffect(() => {
    if (weeks.length === 0) { setSelectedWeek(null); return; }
    if (selectedWeek != null && weeks.find((w) => w.week_number === selectedWeek)) return;
    const current = weeks.find((w) => {
      const ws = parseISODate(w.week_start);
      const we = addDays(parseISODate(w.week_end), 1);
      return today >= ws && today < we;
    });
    setSelectedWeek(current?.week_number ?? weeks[0].week_number);
  }, [weeks, today, selectedWeek]);

  const week = weeks.find((w) => w.week_number === selectedWeek) ?? null;
  const prevWeek = weeks.find((w) => w.week_number === (selectedWeek ?? 0) - 1) ?? null;
  const currentWeekNumber = useMemo(() => {
    const w = weeks.find((w) => {
      const ws = parseISODate(w.week_start);
      const we = addDays(parseISODate(w.week_end), 1);
      return today >= ws && today < we;
    });
    return w?.week_number ?? null;
  }, [weeks, today]);

  // Plan items
  const planByCase = useMemo(() => {
    const m = new Map<string, typeof plan[number]>();
    plan.forEach((p) => m.set(p.case_id, p));
    return m;
  }, [plan]);

  const weekPlan = useMemo(
    () => plan.filter((p) => p.week_number === selectedWeek),
    [plan, selectedWeek]
  );
  const prevWeekPlan = useMemo(
    () => (prevWeek ? plan.filter((p) => p.week_number === prevWeek.week_number) : []),
    [plan, prevWeek]
  );

  const planCaseIds = useMemo(
    () => Array.from(new Set([...weekPlan, ...prevWeekPlan].map((p) => p.case_id))),
    [weekPlan, prevWeekPlan]
  );
  const { data: planCases = [] } = useCasesByIds(planCaseIds);
  const caseById = useMemo(() => {
    const m = new Map<string, CaseLite>();
    planCases.forEach((c) => m.set(c.id, c));
    eligible.forEach((c) => {
      if (!m.has(c.id)) {
        m.set(c.id, {
          id: c.id, status: c.status, internal_owner: c.internal_owner,
          priority: c.priority, client_name: c.client_name,
        });
      }
    });
    return m;
  }, [planCases, eligible]);

  // Carryover (previous week, not completed, not ignored)
  const [ignored, setIgnored] = useState<Set<string>>(() => {
    try {
      const raw = sessionStorage.getItem("planning.ignoredCarryover");
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch { return new Set(); }
  });
  const persistIgnored = (next: Set<string>) => {
    setIgnored(next);
    try { sessionStorage.setItem("planning.ignoredCarryover", JSON.stringify([...next])); } catch {}
  };
  const carryover = useMemo(() => {
    return prevWeekPlan.filter((p) => {
      if (ignored.has(p.id)) return false;
      const c = caseById.get(p.case_id);
      if (!c) return false;
      return !COMPLETED_STATUSES.has(c.status);
    });
  }, [prevWeekPlan, caseById, ignored]);

  // Available queue
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  const allTags = useMemo(() => {
    const set = new Set<string>();
    eligible.forEach((c) => c.client_tags.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [eligible]);

  const queue = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...eligible]
      .filter((c) => !planByCase.has(c.id))
      .filter((c) => QUEUE_STATUSES.has(c.status))
      .filter((c) => !q || (c.client_name ?? "").toLowerCase().includes(q))
      .filter((c) => tagFilter === "all" || c.client_tags.includes(tagFilter))
      .filter((c) => priorityFilter === "all" || (c.priority ?? "media") === priorityFilter)
      .sort((a, b) => getReferenceDate(a).localeCompare(getReferenceDate(b)));
  }, [eligible, planByCase, search, tagFilter, priorityFilter]);

  const queueIds = useMemo(() => queue.slice(0, 200).map((c) => c.id), [queue]);
  const { data: procuracaoSet } = useProcuracaoFlags(queueIds);

  // Grade groups — only operadores
  const opNames = useMemo(() => operators.map((o) => o.full_name), [operators]);
  const gradeGroups = useMemo(() => {
    const set = new Set<string>(opNames);
    weekPlan.forEach((p) => { if (p.responsible) set.add(p.responsible); });
    if (set.size === 0) set.add("Sem responsável");
    return Array.from(set).sort();
  }, [opNames, weekPlan]);

  const planByOwner = useMemo(() => {
    const m = new Map<string, typeof weekPlan>();
    weekPlan.forEach((p) => {
      const k = p.responsible ?? "Sem responsável";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(p);
    });
    return m;
  }, [weekPlan]);

  // Summary
  const planejadas = weekPlan.length;
  const concluidas = useMemo(
    () => weekPlan.filter((p) => COMPLETED_STATUSES.has(caseById.get(p.case_id)?.status ?? "")).length,
    [weekPlan, caseById]
  );
  const emAberto = planejadas - concluidas;

  function daysSince(iso: string) {
    const d = new Date(iso);
    return Math.max(0, Math.floor((today.getTime() - d.getTime()) / 86400000));
  }

  const handleAdd = async (c: EligibleCase, overrideOwner?: string | null) => {
    if (!week) return;
    const owner = overrideOwner ?? c.internal_owner;
    if (owner) {
      const planned = (planByOwner.get(owner)?.length ?? 0);
      const cap = getCapacityFor(owner, capacities);
      if (planned + 1 > cap) {
        toast({
          title: "Capacidade excedida",
          description: `${owner} já tem ${planned} demandas planejadas (capacidade ${cap}).`,
        });
      }
    }
    if (overrideOwner && (c.internal_owner ?? null) !== overrideOwner) {
      const { error } = await supabase
        .from("irpf_cases").update({ internal_owner: overrideOwner }).eq("id", c.id);
      if (error) {
        toast({ title: "Erro ao atribuir", description: error.message, variant: "destructive" });
        return;
      }
    }
    await add.mutateAsync([{
      season_id: season.id, week_number: week.week_number, case_id: c.id, responsible: owner,
    }]);
  };

  const handleReassign = async (planId: string, caseId: string, newOwner: string) => {
    await move.mutateAsync({ id: planId, week_number: week!.week_number, responsible: newOwner });
    await supabase.from("irpf_cases").update({ internal_owner: newOwner }).eq("id", caseId);
  };

  const handleMoveCarryover = async (planId: string) => {
    if (!week) return;
    await move.mutateAsync({ id: planId, week_number: week.week_number });
  };

  // Week navigation
  const idx = weeks.findIndex((w) => w.week_number === selectedWeek);
  const goPrev = () => idx > 0 && setSelectedWeek(weeks[idx - 1].week_number);
  const goNext = () => idx < weeks.length - 1 && setSelectedWeek(weeks[idx + 1].week_number);
  const goToday = () => currentWeekNumber != null && setSelectedWeek(currentWeekNumber);

  // New week dialog
  const [newWeekOpen, setNewWeekOpen] = useState(false);

  if (weeks.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Nenhuma semana configurada. Vá em <strong>Metas IRPF</strong> e gere as semanas primeiro.
        </CardContent>
      </Card>
    );
  }

  // Drag-and-drop handlers
  const onDragStart = (e: React.DragEvent, planId: string, caseId: string) => {
    e.dataTransfer.setData("text/plan-id", planId);
    e.dataTransfer.setData("text/case-id", caseId);
    e.dataTransfer.effectAllowed = "move";
  };
  const onDropTo = async (e: React.DragEvent, owner: string) => {
    e.preventDefault();
    const planId = e.dataTransfer.getData("text/plan-id");
    const caseId = e.dataTransfer.getData("text/case-id");
    if (!planId || !caseId) return;
    const item = weekPlan.find((p) => p.id === planId);
    if (!item || (item.responsible ?? "Sem responsável") === owner) return;
    await handleReassign(planId, caseId, owner);
  };

  return (
    <>
      {/* Header: week nav + summary + new week */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button size="icon" variant="outline" className="h-9 w-9" onClick={goPrev} disabled={idx <= 0}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[260px] px-3 py-2 rounded-md border bg-card text-sm font-medium text-center">
            {week ? <>S{week.week_number} — {formatBR(parseISODate(week.week_start))} a {formatBR(parseISODate(week.week_end))}</> : "—"}
          </div>
          <Button size="icon" variant="outline" className="h-9 w-9" onClick={goNext} disabled={idx >= weeks.length - 1}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" className="h-9" onClick={goToday} disabled={currentWeekNumber == null || selectedWeek === currentWeekNumber}>
            Hoje
          </Button>
          <Button size="sm" variant="default" className="h-9 ml-2" onClick={() => setNewWeekOpen(true)} disabled={!prevWeek}>
            <CalendarPlus className="h-4 w-4 mr-1" /> Nova semana
          </Button>
        </div>
        <div className="flex items-center gap-5 text-sm bg-muted/40 border rounded-lg px-4 py-2">
          <span><span className="text-muted-foreground">Planejadas:</span> <strong>{planejadas}</strong></span>
          <span className="text-muted-foreground">|</span>
          <span><span className="text-muted-foreground">Concluídas:</span> <strong className="text-emerald-600 dark:text-emerald-400">{concluidas}</strong></span>
          <span className="text-muted-foreground">|</span>
          <span><span className="text-muted-foreground">Em aberto:</span> <strong className="text-blue-600 dark:text-blue-400">{emAberto}</strong></span>
        </div>
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] gap-4">
        {/* Queue */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Fila de disponíveis</CardTitle>
            <p className="text-xs text-muted-foreground">
              Documentação completa, ainda não planejadas. Mais antigas primeiro.
            </p>
            <div className="flex flex-col gap-2 mt-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input className="pl-7 h-9" placeholder="Buscar cliente..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Select value={tagFilter} onValueChange={setTagFilter}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Tag" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as tags</SelectItem>
                    {allTags.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Prioridade" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as prioridades</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="baixa">Baixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {queue.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhuma demanda disponível.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-[640px] overflow-y-auto pr-1">
                {queue.slice(0, 200).map((c) => {
                  const ref = getReferenceDate(c);
                  const days = daysSince(ref);
                  const hasDocs = !!(c.docs_received_at || c.earliest_doc_at);
                  const hasProc = procuracaoSet?.has(c.id);
                  return (
                    <div key={c.id} className="flex items-start gap-2 p-2.5 rounded-md border hover:border-primary/50 hover:bg-muted/40 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{c.client_name ?? "—"}</div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <Badge variant="secondary" className="text-[10px]">{STATUS_LABELS[c.status] ?? c.status}</Badge>
                          {c.priority && (
                            <Badge variant={priorityVariant(c.priority)} className="text-[10px]">
                              {PRIORITY_LABELS[c.priority] ?? c.priority}
                            </Badge>
                          )}
                          {hasDocs && (
                            <Badge variant={days >= 14 ? "destructive" : days >= 7 ? "default" : "outline"} className="text-[10px]">
                              {days}d com docs
                            </Badge>
                          )}
                          {hasProc && (
                            <Badge variant="outline" className="text-[10px] gap-0.5">
                              <FilePen className="h-2.5 w-2.5" /> Procuração
                            </Badge>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-1 truncate">
                          {c.internal_owner ?? "Sem responsável"}
                        </div>
                      </div>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0">
                            <Plus className="h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-2" align="end">
                          <p className="text-xs text-muted-foreground px-1.5 pb-1.5">Atribuir a</p>
                          <div className="space-y-0.5 max-h-60 overflow-y-auto">
                            {opNames.length === 0 && (
                              <p className="text-xs text-muted-foreground px-2 py-1.5">Nenhuma operadora cadastrada.</p>
                            )}
                            {opNames.map((r) => (
                              <button
                                key={r}
                                className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-muted"
                                onClick={() => handleAdd(c, r)}
                              >
                                {r} {c.internal_owner === r && <span className="text-muted-foreground text-xs">(atual)</span>}
                              </button>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  );
                })}
                {queue.length > 200 && (
                  <p className="text-[11px] text-muted-foreground text-center pt-2">
                    Refine a busca para ver mais resultados.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Grade */}
        <div className="space-y-4">
          {/* Carryover */}
          {carryover.length > 0 && (
            <Card className="border-dashed border-amber-500/60 bg-amber-50/40 dark:bg-amber-950/10">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2 text-amber-900 dark:text-amber-200">
                  <AlertTriangle className="h-4 w-4" />
                  Da semana anterior ({carryover.length})
                </CardTitle>
                <p className="text-xs text-amber-800/80 dark:text-amber-200/70">
                  Demandas que ficaram em aberto na S{prevWeek?.week_number}.
                </p>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {carryover.map((p) => {
                  const c = caseById.get(p.case_id);
                  return (
                    <div key={p.id} className="flex items-center gap-2 p-2 rounded-md border bg-background">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{c?.client_name ?? "—"}</div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {p.responsible ?? "Sem responsável"} · {STATUS_LABELS[c?.status ?? ""] ?? c?.status ?? "—"}
                        </div>
                      </div>
                      <Button size="sm" variant="default" className="h-7" onClick={() => handleMoveCarryover(p.id)}>
                        <ArrowRight className="h-3.5 w-3.5 mr-1" /> Mover
                      </Button>
                      <Button
                        size="sm" variant="ghost" className="h-7 text-muted-foreground"
                        onClick={() => persistIgnored(new Set([...ignored, p.id]))}
                      >
                        Ignorar
                      </Button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Grade by responsible */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {gradeGroups.map((resp) => {
              const items = planByOwner.get(resp) ?? [];
              const cap = getCapacityFor(resp, capacities);
              const pct = cap > 0 ? Math.round((items.length / cap) * 100) : 0;
              const barColor =
                pct > 100 ? "bg-red-500"
                : pct >= 80 ? "bg-amber-500"
                : "bg-emerald-500";
              return (
                <Card
                  key={resp}
                  className="flex flex-col"
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
                  onDrop={(e) => onDropTo(e, resp)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <CardTitle className="text-sm truncate">{resp}</CardTitle>
                      <span className={cn(
                        "text-xs font-semibold whitespace-nowrap",
                        pct > 100 ? "text-red-600" : pct >= 80 ? "text-amber-600" : "text-muted-foreground"
                      )}>
                        {items.length}/{cap}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden mt-1">
                      <div className={cn("h-full transition-all", barColor)} style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 space-y-1.5 pt-1 min-h-[60px]">
                    {items.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">Solte uma demanda aqui ou adicione pela fila.</p>
                    ) : (
                      items.map((p) => {
                        const c = caseById.get(p.case_id);
                        const status = c?.status ?? "";
                        const isCompleted = COMPLETED_STATUSES.has(status);
                        return (
                          <div
                            key={p.id}
                            draggable
                            onDragStart={(e) => onDragStart(e, p.id, p.case_id)}
                            className={cn(
                              "flex items-center gap-2 p-2 rounded-md border transition-colors cursor-grab active:cursor-grabbing",
                              isCompleted ? "opacity-60 bg-muted/30" : "hover:bg-muted/40"
                            )}
                          >
                            <div className="flex-1 min-w-0">
                              <div className={cn(
                                "text-sm font-medium truncate",
                                isCompleted && "line-through text-muted-foreground"
                              )}>
                                {c?.client_name ?? "—"}
                              </div>
                              <div className="text-[11px] text-muted-foreground truncate">
                                {STATUS_LABELS[status] ?? status ?? "—"}
                              </div>
                            </div>
                            <Link to={`/demandas/${p.case_id}`}>
                              <Button size="icon" variant="ghost" className="h-6 w-6">
                                <ExternalLink className="h-3 w-3" />
                              </Button>
                            </Link>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-6 w-6">
                                  <MoreVertical className="h-3 w-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuLabel className="text-xs">Mover para…</DropdownMenuLabel>
                                {opNames.filter((n) => n !== resp).map((n) => (
                                  <DropdownMenuItem key={n} onClick={() => handleReassign(p.id, p.case_id, n)}>
                                    {n}
                                  </DropdownMenuItem>
                                ))}
                                {opNames.filter((n) => n !== resp).length === 0 && (
                                  <DropdownMenuItem disabled className="text-xs">Sem outras operadoras</DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => remove.mutate(p.id)}
                                >
                                  <X className="h-3 w-3 mr-1" /> Remover do plano
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        );
                      })
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {capacities.length === 0 && (
            <p className="text-[11px] text-muted-foreground text-center">
              Capacidade padrão de {DEFAULT_WEEKLY_CAPACITY} por responsável. Configure em Configurações &gt; Capacidade Semanal.
            </p>
          )}
        </div>
      </div>

      {/* New week dialog */}
      {prevWeek && week && (
        <NewWeekDialog
          open={newWeekOpen}
          onOpenChange={setNewWeekOpen}
          season={season}
          targetWeek={week}
          prevWeek={prevWeek}
          prevPlan={prevWeekPlan}
          caseById={caseById}
          weekPlanCaseIds={new Set(weekPlan.map((p) => p.case_id))}
          onCopied={() => setNewWeekOpen(false)}
        />
      )}
    </>
  );
}

/* ---------------- New week dialog ---------------- */

function NewWeekDialog({
  open, onOpenChange, season, targetWeek, prevWeek, prevPlan, caseById, weekPlanCaseIds, onCopied,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  season: any;
  targetWeek: { week_number: number };
  prevWeek: { week_number: number };
  prevPlan: Array<{ id: string; case_id: string; responsible: string | null }>;
  caseById: Map<string, CaseLite>;
  weekPlanCaseIds: Set<string>;
  onCopied: () => void;
}) {
  const add = useAddToPlan();

  const candidates = useMemo(() => {
    return prevPlan
      .filter((p) => !weekPlanCaseIds.has(p.case_id))
      .filter((p) => {
        const c = caseById.get(p.case_id);
        return c && !COMPLETED_STATUSES.has(c.status);
      });
  }, [prevPlan, caseById, weekPlanCaseIds]);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (open) setSelected(new Set(candidates.map((c) => c.case_id)));
  }, [open, candidates]);

  const toggle = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const handleCopy = async () => {
    const items = candidates
      .filter((p) => selected.has(p.case_id))
      .map((p) => ({
        season_id: season.id,
        week_number: targetWeek.week_number,
        case_id: p.case_id,
        responsible: p.responsible,
      }));
    if (items.length === 0) { onCopied(); return; }
    await add.mutateAsync(items);
    onCopied();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Copiar para S{targetWeek.week_number}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Demandas planejadas em S{prevWeek.week_number} que ainda não foram concluídas.
        </p>
        {candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhuma demanda em aberto na semana anterior.
          </p>
        ) : (
          <div className="max-h-[420px] overflow-y-auto space-y-1.5 border rounded-md p-2">
            {candidates.map((p) => {
              const c = caseById.get(p.case_id);
              const checked = selected.has(p.case_id);
              return (
                <label
                  key={p.id}
                  className="flex items-center gap-2 p-2 rounded hover:bg-muted/40 cursor-pointer"
                >
                  <Checkbox checked={checked} onCheckedChange={() => toggle(p.case_id)} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{c?.client_name ?? "—"}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {p.responsible ?? "Sem responsável"} · {STATUS_LABELS[c?.status ?? ""] ?? c?.status ?? "—"}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleCopy} disabled={selected.size === 0 || add.isPending}>
            Copiar {selected.size > 0 ? `(${selected.size})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
