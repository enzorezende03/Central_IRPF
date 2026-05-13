import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { InternalLayout } from "@/components/InternalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  CalendarCheck, Plus, X, ExternalLink, Search, Lock, AlertTriangle, ArrowRight,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useSeasons, useWeeklyGoals } from "@/hooks/use-irpf-goals";
import {
  useSeasonPlan, useAddToPlan, useRemoveFromPlan, useEligibleCases,
  useMovePlanWeek, getReferenceDate, type EligibleCase,
} from "@/hooks/use-weekly-plan";
import {
  useCapacities, getCapacityFor, DEFAULT_WEEKLY_CAPACITY,
} from "@/hooks/use-weekly-capacity";
import { parseISODate, addDays, formatBR } from "@/lib/goals-utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const COMPLETED_STATUSES = new Set(["finalizado", "previa_enviada", "previa_aprovada", "dispensada"]);
const CARRYOVER_EXCLUDED = COMPLETED_STATUSES;
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
  const { hasPermission, loading: authLoading } = useAuth();
  const canView = hasPermission("acesso_metas");

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
                Distribua e acompanhe as demandas da semana por responsável
              </p>
            </div>
          </div>
          {seasons.length > 0 && (
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
        ) : (
          <PlanContent season={season} />
        )}
      </div>
    </InternalLayout>
  );
}

function PlanContent({ season }: { season: any }) {
  const qc = useQueryClient();
  const { data: weeks = [] } = useWeeklyGoals(season.id);
  const { data: plan = [] } = useSeasonPlan(season.id);
  const { data: eligible = [] } = useEligibleCases();
  const { data: capacities = [] } = useCapacities();

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
  const isPastWeek = currentWeekNumber != null && selectedWeek != null && selectedWeek < currentWeekNumber;

  // Plan items
  const planByCase = useMemo(() => {
    const m = new Map<string, typeof plan[number]>();
    plan.forEach((p) => m.set(p.case_id, p));
    return m;
  }, [plan]);

  const weekPlanRaw = useMemo(
    () => plan.filter((p) => p.week_number === selectedWeek),
    [plan, selectedWeek]
  );
  const prevWeekPlan = useMemo(
    () => (prevWeek ? plan.filter((p) => p.week_number === prevWeek.week_number) : []),
    [plan, prevWeek]
  );

  // Fetch live status for all cases referenced in plan (current + previous week)
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
          priority: null, client_name: c.client_name,
        });
      }
    });
    return m;
  }, [planCases, eligible]);

  // Realtime: invalidate on irpf_cases status changes
  useEffect(() => {
    const channel = supabase
      .channel("planning-cases")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "irpf_cases" }, () => {
        qc.invalidateQueries({ queryKey: ["planning_cases_by_ids"] });
        qc.invalidateQueries({ queryKey: ["irpf_eligible_cases"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

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
      return !CARRYOVER_EXCLUDED.has(c.status);
    });
  }, [prevWeekPlan, caseById, ignored]);

  // Available queue
  const [search, setSearch] = useState("");
  const [respFilter, setRespFilter] = useState<string>("all");
  const responsibles = useMemo(() => {
    const set = new Set<string>();
    capacities.forEach((c) => set.add(c.responsible));
    eligible.forEach((c) => c.internal_owner && set.add(c.internal_owner));
    weekPlan.forEach((p) => p.responsible && set.add(p.responsible));
    return Array.from(set).sort();
  }, [capacities, eligible, weekPlan]);

  const queue = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...eligible]
      .filter((c) => !planByCase.has(c.id))
      .filter((c) => QUEUE_STATUSES.has(c.status))
      .filter((c) => !q || (c.client_name ?? "").toLowerCase().includes(q))
      .filter((c) => respFilter === "all" || (c.internal_owner ?? "Sem responsável") === respFilter)
      .sort((a, b) => getReferenceDate(a).localeCompare(getReferenceDate(b)));
  }, [eligible, planByCase, search, respFilter]);

  // Grade groups
  const gradeGroups = useMemo(() => {
    const set = new Set<string>(responsibles);
    weekPlan.forEach((p) => set.add(p.responsible ?? "Sem responsável"));
    if (set.size === 0) set.add("Sem responsável");
    return Array.from(set).sort();
  }, [responsibles, weekPlan]);

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
    // capacity check
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
        .from("irpf_cases")
        .update({ internal_owner: overrideOwner })
        .eq("id", c.id);
      if (error) {
        toast({ title: "Erro ao atribuir", description: error.message, variant: "destructive" });
        return;
      }
    }
    await add.mutateAsync([{
      season_id: season.id, week_number: week.week_number, case_id: c.id, responsible: owner,
    }]);
  };

  const handleMoveCarryover = async (planId: string) => {
    if (!week) return;
    await move.mutateAsync({ id: planId, week_number: week.week_number });
  };

  if (weeks.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Nenhuma semana configurada. Vá em <strong>Metas IRPF</strong> e gere as semanas primeiro.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Week selector + Summary */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Semana:</span>
          <Select value={selectedWeek?.toString() ?? ""} onValueChange={(v) => setSelectedWeek(Number(v))}>
            <SelectTrigger className="w-[280px]"><SelectValue placeholder="Semana" /></SelectTrigger>
            <SelectContent>
              {weeks.map((w) => (
                <SelectItem key={w.id} value={w.week_number.toString()}>
                  S{w.week_number} — {formatBR(parseISODate(w.week_start))} a {formatBR(parseISODate(w.week_end))}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-5 text-sm bg-muted/40 border rounded-lg px-4 py-2">
          <span><span className="text-muted-foreground">Planejadas esta semana:</span> <strong>{planejadas}</strong></span>
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
              <Select value={respFilter} onValueChange={setRespFilter}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os responsáveis</SelectItem>
                  <SelectItem value="Sem responsável">Sem responsável</SelectItem>
                  {responsibles.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
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
                  return (
                    <div key={c.id} className="flex items-start gap-2 p-2.5 rounded-md border hover:border-primary/50 hover:bg-muted/40 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{c.client_name ?? "—"}</div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <Badge variant="secondary" className="text-[10px]">{STATUS_LABELS[c.status] ?? c.status}</Badge>
                          {hasDocs && (
                            <Badge variant={days >= 14 ? "destructive" : days >= 7 ? "default" : "outline"} className="text-[10px]">
                              {days}d com docs
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
                            {c.internal_owner && (
                              <button
                                className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-muted"
                                onClick={() => handleAdd(c)}
                              >
                                <span className="font-medium">{c.internal_owner}</span> <span className="text-muted-foreground">(atual)</span>
                              </button>
                            )}
                            {responsibles.filter((r) => r !== c.internal_owner).map((r) => (
                              <button
                                key={r}
                                className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-muted"
                                onClick={() => handleAdd(c, r)}
                              >
                                {r}
                              </button>
                            ))}
                            {!c.internal_owner && (
                              <button
                                className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-muted text-muted-foreground"
                                onClick={() => handleAdd(c)}
                              >
                                Sem responsável
                              </button>
                            )}
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
                <Card key={resp} className="flex flex-col">
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
                  <CardContent className="flex-1 space-y-1.5 pt-1">
                    {items.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">Sem demandas planejadas.</p>
                    ) : (
                      items.map((p) => {
                        const c = caseById.get(p.case_id);
                        const status = c?.status ?? "";
                        const dotColor =
                          COMPLETED_STATUSES.has(status) ? "bg-emerald-500"
                          : "bg-blue-500";
                        return (
                          <div key={p.id} className="flex items-center gap-2 p-2 rounded-md border hover:bg-muted/40 transition-colors">
                            <span className={cn("h-2 w-2 rounded-full shrink-0", dotColor)} />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{c?.client_name ?? "—"}</div>
                              <div className="text-[11px] text-muted-foreground truncate">
                                {STATUS_LABELS[status] ?? status ?? "—"}
                              </div>
                            </div>
                            <Link to={`/demandas/${p.case_id}`}>
                              <Button size="icon" variant="ghost" className="h-6 w-6">
                                <ExternalLink className="h-3 w-3" />
                              </Button>
                            </Link>
                            <Button
                              size="icon" variant="ghost"
                              className="h-6 w-6 text-destructive"
                              onClick={() => remove.mutate(p.id)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
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
    </>
  );
}
