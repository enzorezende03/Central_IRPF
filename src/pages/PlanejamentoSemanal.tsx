import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { InternalLayout } from "@/components/InternalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  CalendarCheck, Sparkles, Plus, Trash2, ExternalLink, Search, Lock, Users,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  useSeasons, useWeeklyGoals, useFinalizedCasesInRange,
} from "@/hooks/use-irpf-goals";
import {
  useSeasonPlan, useAddToPlan, useRemoveFromPlan, useEligibleCases,
  getReferenceDate, type EligibleCase,
} from "@/hooks/use-weekly-plan";
import { parseISODate, addDays, formatBR } from "@/lib/goals-utils";
import { toast } from "@/hooks/use-toast";

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
      <div className="container mx-auto py-6 px-4 space-y-6 max-w-[1400px]">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-primary/60 grid place-items-center shadow-lg shadow-primary/20">
              <CalendarCheck className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Planejamento Semanal</h1>
              <p className="text-sm text-muted-foreground">Atribua quais IRs serão realizados em cada semana da temporada</p>
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
  const { data: weeks = [] } = useWeeklyGoals(season.id);
  const { data: plan = [] } = useSeasonPlan(season.id);
  const { data: finalized = [] } = useFinalizedCasesInRange(season.start_date, season.deadline_date);
  const { data: eligible = [] } = useEligibleCases();

  const add = useAddToPlan();
  const remove = useRemoveFromPlan();

  // Pick current week as default
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
  const weekStart = week ? parseISODate(week.week_start) : null;
  const weekEnd = week ? parseISODate(week.week_end) : null;

  // Map: case_id -> plan item (whole season)
  const planByCase = useMemo(() => {
    const m = new Map<string, typeof plan[number]>();
    plan.forEach((p) => m.set(p.case_id, p));
    return m;
  }, [plan]);

  // Plan items in selected week
  const weekPlan = useMemo(
    () => plan.filter((p) => p.week_number === selectedWeek),
    [plan, selectedWeek]
  );

  // Eligible cases (without already-planned anywhere) sorted by reference date asc
  const sortedEligible = useMemo(() => {
    return [...eligible]
      .filter((c) => !planByCase.has(c.id))
      .sort((a, b) => getReferenceDate(a).localeCompare(getReferenceDate(b)));
  }, [eligible, planByCase]);

  // Realized by responsible in selected week (week 1 absorbs pre-season)
  const realizedThisWeek = useMemo(() => {
    if (!weekStart || !weekEnd) return [] as typeof finalized;
    const isFirst = selectedWeek === 1;
    return finalized.filter((f) => {
      const d = new Date((f as any).completed_at ?? f.updated_at);
      const upper = d < addDays(weekEnd, 1);
      const lower = isFirst ? true : d >= weekStart;
      return upper && lower;
    });
  }, [finalized, weekStart, weekEnd, selectedWeek]);

  // ─── Summary ─────────────────────────────────────────────
  const meta = week?.goal_count ?? 0;
  const planejado = weekPlan.length;
  const realizado = realizedThisWeek.length;
  const saldo = realizado - meta;

  // Per-responsible breakdown
  const responsibles = useMemo(() => {
    const set = new Set<string>();
    eligible.forEach((c) => c.internal_owner && set.add(c.internal_owner));
    weekPlan.forEach((p) => p.responsible && set.add(p.responsible));
    return Array.from(set).sort();
  }, [eligible, weekPlan]);

  const perResponsible = useMemo(() => {
    const respList = responsibles.length > 0 ? responsibles : ["Sem responsável"];
    const metaShare = respList.length > 0 ? Math.round(meta / respList.length) : 0;
    return respList.map((r) => {
      const planned = weekPlan.filter((p) => (p.responsible ?? "Sem responsável") === r).length;
      const realized = realizedThisWeek.filter((c: any) => {
        // need internal_owner, fetch from eligible list (may not include finalized cases)
        // we don't have it here; use a separate map below.
        return false;
      }).length;
      return { responsible: r, meta: metaShare, planned, realized };
    });
  }, [responsibles, weekPlan, realizedThisWeek, meta]);

  // We need internal_owner for finalized too — fetch from eligible+plan can miss them.
  // Build a quick lookup using both eligible and the plan's responsible.
  // For realized counting we need the case's owner; finalized rows only have id+status+timestamps.
  // Use a small auxiliary fetch via plan/eligible lookup; finalized cases not in those won't be attributable.
  const ownerByCase = useMemo(() => {
    const m = new Map<string, string>();
    eligible.forEach((c) => c.internal_owner && m.set(c.id, c.internal_owner));
    plan.forEach((p) => p.responsible && m.set(p.case_id, p.responsible));
    return m;
  }, [eligible, plan]);

  const perResponsibleFixed = useMemo(() => {
    const respList = responsibles.length > 0 ? responsibles : ["Sem responsável"];
    const metaShare = respList.length > 0 ? Math.round(meta / respList.length) : 0;
    return respList.map((r) => {
      const planned = weekPlan.filter((p) => (p.responsible ?? "Sem responsável") === r).length;
      const realized = realizedThisWeek.filter((c: any) => (ownerByCase.get(c.id) ?? "Sem responsável") === r).length;
      return { responsible: r, meta: metaShare, planned, realized };
    });
  }, [responsibles, weekPlan, realizedThisWeek, meta, ownerByCase]);

  // ─── Suggestions ─────────────────────────────────────────
  // Apenas clientes que já enviaram toda a documentação (status "documentos_em_analise"),
  // ordenados pelos que enviaram há mais tempo.
  const [suggestionLimit, setSuggestionLimit] = useState(10);
  const suggestions = sortedEligible
    .filter((c) => c.status === "documentos_em_analise")
    .slice(0, suggestionLimit);
  const handleAddSuggestionsBulk = async () => {
    if (!week) return;
    await add.mutateAsync(
      suggestions.map((c) => ({
        season_id: season.id,
        week_number: week.week_number,
        case_id: c.id,
        responsible: c.internal_owner,
      }))
    );
  };
  const handleAddOne = async (c: EligibleCase) => {
    if (!week) return;
    await add.mutateAsync([{
      season_id: season.id,
      week_number: week.week_number,
      case_id: c.id,
      responsible: c.internal_owner,
    }]);
  };

  // ─── Available list with search ─────────────────────────
  const [search, setSearch] = useState("");
  const [respFilter, setRespFilter] = useState<string>("all");
  const [selectedAvail, setSelectedAvail] = useState<Set<string>>(new Set());
  const filteredAvail = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sortedEligible.filter((c) => {
      const matchSearch = !q || (c.client_name ?? "").toLowerCase().includes(q);
      const matchResp = respFilter === "all" || (c.internal_owner ?? "Sem responsável") === respFilter;
      return matchSearch && matchResp;
    });
  }, [sortedEligible, search, respFilter]);

  const toggleSel = (id: string) => {
    setSelectedAvail((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const handleAddSelected = async () => {
    if (!week) return;
    const items = filteredAvail
      .filter((c) => selectedAvail.has(c.id))
      .map((c) => ({
        season_id: season.id,
        week_number: week.week_number,
        case_id: c.id,
        responsible: c.internal_owner,
      }));
    if (items.length === 0) {
      toast({ title: "Selecione pelo menos uma demanda" });
      return;
    }
    await add.mutateAsync(items);
    setSelectedAvail(new Set());
  };

  // Lookup for plan items details
  const caseInfo = useMemo(() => {
    const m = new Map<string, EligibleCase>();
    eligible.forEach((c) => m.set(c.id, c));
    return m;
  }, [eligible]);

  function daysSince(iso: string) {
    const d = new Date(iso);
    const ms = today.getTime() - d.getTime();
    return Math.max(0, Math.floor(ms / 86400000));
  }

  if (weeks.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Nenhuma semana configurada para esta temporada. Vá em <strong>Metas IRPF</strong> e gere as semanas primeiro.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Week selector */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Semana:</span>
        <Select value={selectedWeek?.toString() ?? ""} onValueChange={(v) => setSelectedWeek(Number(v))}>
          <SelectTrigger className="w-[260px]"><SelectValue placeholder="Semana" /></SelectTrigger>
          <SelectContent>
            {weeks.map((w) => (
              <SelectItem key={w.id} value={w.week_number.toString()}>
                S{w.week_number} — {formatBR(parseISODate(w.week_start))} a {formatBR(parseISODate(w.week_end))}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiBox label="Meta da semana" value={meta} accent="text-blue-600 dark:text-blue-400" />
        <KpiBox label="Planejado" value={planejado} accent="text-primary" />
        <KpiBox label="Realizado" value={realizado} accent="text-emerald-600 dark:text-emerald-400" />
        <KpiBox label="Saldo (real - meta)" value={(saldo > 0 ? "+" : "") + saldo} accent={saldo >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"} />
      </div>

      {/* Per responsible */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" /> Por responsável
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Meta da semana distribuída igualmente entre os responsáveis ativos.
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Responsável</TableHead>
                  <TableHead className="text-center w-24">Meta</TableHead>
                  <TableHead className="text-center w-28">Planejado</TableHead>
                  <TableHead className="text-center w-28">Realizado</TableHead>
                  <TableHead className="text-center w-28">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {perResponsibleFixed.map((r) => {
                  const saldo = r.realized - r.meta;
                  return (
                    <TableRow key={r.responsible}>
                      <TableCell className="font-medium whitespace-nowrap">{r.responsible}</TableCell>
                      <TableCell className="text-center">{r.meta}</TableCell>
                      <TableCell className="text-center font-semibold">{r.planned}</TableCell>
                      <TableCell className="text-center font-semibold">{r.realized}</TableCell>
                      <TableCell className={`text-center font-semibold ${saldo >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                        {saldo > 0 ? `+${saldo}` : saldo}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Two columns: planned + available */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Planned for selected week */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Planejadas — S{selectedWeek}</CardTitle>
            <p className="text-xs text-muted-foreground">
              {weekPlan.length} {weekPlan.length === 1 ? "demanda" : "demandas"} no plano
            </p>
          </CardHeader>
          <CardContent>
            {weekPlan.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhuma demanda planejada.</p>
            ) : (
              <div className="space-y-1.5">
                {weekPlan.map((p) => {
                  const c = caseInfo.get(p.case_id);
                  return (
                    <div key={p.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 border">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {c?.client_name ?? "Demanda"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {p.responsible ?? "Sem responsável"}
                        </div>
                      </div>
                      <Link to={`/demandas/${p.case_id}`}>
                        <Button size="icon" variant="ghost" className="h-7 w-7"><ExternalLink className="h-3.5 w-3.5" /></Button>
                      </Link>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove.mutate(p.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Available */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Disponíveis</CardTitle>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input className="pl-7 h-9" placeholder="Buscar cliente..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <Select value={respFilter} onValueChange={setRespFilter}>
                <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos resp.</SelectItem>
                  {responsibles.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={handleAddSelected} disabled={selectedAvail.size === 0 || add.isPending}>
                <Plus className="h-4 w-4 mr-1.5" /> Adicionar ({selectedAvail.size})
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {filteredAvail.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhuma demanda disponível.</p>
            ) : (
              <div className="space-y-1 max-h-[480px] overflow-y-auto pr-1">
                {filteredAvail.slice(0, 200).map((c) => {
                  const ref = getReferenceDate(c);
                  const days = daysSince(ref);
                  const hasDocs = !!(c.docs_received_at || c.earliest_doc_at);
                  return (
                    <label key={c.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 border cursor-pointer">
                      <Checkbox checked={selectedAvail.has(c.id)} onCheckedChange={() => toggleSel(c.id)} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{c.client_name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {c.internal_owner ?? "Sem responsável"} · {hasDocs ? `há ${days}d` : "sem docs"}
                        </div>
                      </div>
                    </label>
                  );
                })}
                {filteredAvail.length > 200 && (
                  <p className="text-[11px] text-muted-foreground text-center pt-2">Refine a busca para ver mais resultados.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Suggestions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Sugestões
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Ordenadas pela data em que o cliente enviou a documentação (mais antigos primeiro).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={suggestionLimit.toString()} onValueChange={(v) => setSuggestionLimit(Number(v))}>
              <SelectTrigger className="w-[120px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[5, 10, 15, 20, 30].map((n) => <SelectItem key={n} value={n.toString()}>{n} primeiros</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={handleAddSuggestionsBulk} disabled={suggestions.length === 0 || add.isPending}>
              <Plus className="h-4 w-4 mr-1.5" /> Adicionar todos
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {suggestions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Sem sugestões pendentes.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[820px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead className="whitespace-nowrap">Docs enviados</TableHead>
                    <TableHead className="text-right w-32">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suggestions.map((c) => {
                    const ref = getReferenceDate(c);
                    const days = daysSince(ref);
                    const hasDocs = !!(c.docs_received_at || c.earliest_doc_at);
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium whitespace-nowrap">
                          <Link to={`/demandas/${c.id}`} className="hover:underline">
                            {c.client_name ?? "—"}
                          </Link>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{c.internal_owner ?? <span className="text-muted-foreground">Sem responsável</span>}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {hasDocs ? (
                            <Badge variant={days >= 14 ? "destructive" : days >= 7 ? "default" : "secondary"}>
                              há {days} {days === 1 ? "dia" : "dias"}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">sem documentos</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => handleAddOne(c)} disabled={add.isPending}>
                            <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function KpiBox({ label, value, accent }: { label: string; value: string | number; accent: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-2xl font-bold mt-1 ${accent}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
