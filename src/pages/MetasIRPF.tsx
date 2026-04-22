import { useEffect, useMemo, useState } from "react";
import { InternalLayout } from "@/components/InternalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Target, TrendingUp, TrendingDown, CalendarDays, Trophy, AlertTriangle,
  Plus, Save, Wand2, Pencil, Trash2, Activity, Calendar, Lock,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  useSeasons, useWeeklyGoals, useUpsertSeason, useDeleteSeason,
  useReplaceWeeklyGoals, useUpdateWeeklyGoal, useFinalizedCasesInRange,
} from "@/hooks/use-irpf-goals";
import {
  generateWeeks, distributeGoals, parseISODate, formatBR, formatBRFull,
  daysBetween, toISODate, addDays,
} from "@/lib/goals-utils";
import {
  ResponsiveContainer, LineChart, Line as RLine, XAxis as RXAxis, YAxis as RYAxis, CartesianGrid,
  Legend as RLegend, Tooltip as RTip,
} from "recharts";
const Line = RLine as any;
const XAxis = RXAxis as any;
const YAxis = RYAxis as any;
const Legend = RLegend as any;
const RTooltip = RTip as any;
import { toast } from "@/hooks/use-toast";

export default function MetasIRPF() {
  const { hasPermission, loading: authLoading } = useAuth();
  const canView = hasPermission("acesso_metas");
  const canManage = hasPermission("gerenciar_metas");

  const { data: seasons = [], isLoading: loadingSeasons } = useSeasons();
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  // pick default season: current year > most recent
  useEffect(() => {
    if (seasons.length === 0 || selectedYear !== null) return;
    const currentYear = new Date().getFullYear();
    const match = seasons.find((s) => s.season_year === currentYear);
    setSelectedYear(match?.season_year ?? seasons[0].season_year);
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
              <div className="h-16 w-16 rounded-full bg-muted grid place-items-center">
                <Lock className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Acesso restrito</h3>
                <p className="text-sm text-muted-foreground max-w-md mt-1">
                  Você não tem permissão para visualizar as Metas IRPF. Solicite ao
                  administrador a liberação da permissão <strong>Visualizar Metas IRPF</strong>.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </InternalLayout>
    );
  }

  return (
    <InternalLayout>
      <div className="container mx-auto py-6 px-4 space-y-6 max-w-[1400px]">
        <Header
          seasons={seasons}
          selectedYear={selectedYear}
          onSelectYear={setSelectedYear}
          loadingSeasons={loadingSeasons}
          canManage={canManage}
        />

        {!season && !loadingSeasons && (
          canManage ? (
            <EmptyState onCreate={(year) => setSelectedYear(year)} />
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-16 text-center text-sm text-muted-foreground">
                Nenhuma temporada configurada. Solicite ao administrador a criação de uma temporada.
              </CardContent>
            </Card>
          )
        )}

        {season && (
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="overview" className="gap-2"><Activity className="h-4 w-4" /> Visão Geral</TabsTrigger>
              <TabsTrigger value="weekly" className="gap-2"><Calendar className="h-4 w-4" /> Metas Semanais</TabsTrigger>
              {canManage && (
                <TabsTrigger value="config" className="gap-2"><Target className="h-4 w-4" /> Configuração</TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <OverviewBlock season={season} />
            </TabsContent>

            <TabsContent value="weekly" className="space-y-6">
              <WeeklyBlock season={season} canManage={canManage} />
            </TabsContent>

            {canManage && (
              <TabsContent value="config" className="space-y-6">
                <ConfigBlock season={season} onYearChange={setSelectedYear} />
              </TabsContent>
            )}
          </Tabs>
        )}
      </div>
    </InternalLayout>
  );
}

/* ─────────────────────────────  HEADER  ───────────────────────────── */

function Header({
  seasons, selectedYear, onSelectYear, loadingSeasons, canManage,
}: {
  seasons: any[];
  selectedYear: number | null;
  onSelectYear: (y: number) => void;
  loadingSeasons: boolean;
  canManage: boolean;
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-primary/60 grid place-items-center shadow-lg shadow-primary/20">
          <Target className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Metas IRPF</h1>
          <p className="text-sm text-muted-foreground">Painel de controle interno da temporada</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {seasons.length > 0 && (
          <Select value={selectedYear?.toString() ?? ""} onValueChange={(v) => onSelectYear(Number(v))}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Temporada" />
            </SelectTrigger>
            <SelectContent>
              {seasons.map((s) => (
                <SelectItem key={s.id} value={s.season_year.toString()}>
                  Temporada {s.season_year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {canManage && <NewSeasonDialog onCreated={(y) => onSelectYear(y)} />}
      </div>
    </div>
  );
}

/* ─────────────────────────────  EMPTY  ───────────────────────────── */

function EmptyState({ onCreate }: { onCreate: (y: number) => void }) {
  return (
    <Card className="border-dashed">
      <CardContent className="py-16 flex flex-col items-center justify-center text-center gap-4">
        <div className="h-16 w-16 rounded-full bg-muted grid place-items-center">
          <Target className="h-8 w-8 text-muted-foreground" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Nenhuma temporada configurada</h3>
          <p className="text-sm text-muted-foreground max-w-md mt-1">
            Crie a primeira temporada para começar a definir metas semanais e
            acompanhar a produção do escritório.
          </p>
        </div>
        <NewSeasonDialog onCreated={onCreate} initial />
      </CardContent>
    </Card>
  );
}

/* ─────────────────────────────  OVERVIEW  ───────────────────────────── */

function OverviewBlock({ season }: { season: any }) {
  const { data: weeks = [] } = useWeeklyGoals(season.id);
  const { data: finalized = [] } = useFinalizedCasesInRange(season.start_date, season.deadline_date);

  const totalPlanned = season.total_planned || 0;
  const totalFinalized = finalized.length;
  const percentDone = totalPlanned > 0 ? (totalFinalized / totalPlanned) * 100 : 0;

  // Normalize "today" to local midnight so day math is consistent with
  // start_date / deadline_date (which are date-only ISO strings).
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const deadline = parseISODate(season.deadline_date);
  const start = parseISODate(season.start_date);

  const daysRemaining = Math.max(0, daysBetween(today, deadline));
  const totalSeasonDays = Math.max(1, daysBetween(start, deadline) + 1); // inclusive
  const seasonStarted = today >= start;
  const seasonEnded = today > deadline;
  // Days actually elapsed within the season window (1..totalSeasonDays)
  const elapsedDays = !seasonStarted
    ? 0
    : Math.min(totalSeasonDays, daysBetween(start, today) + 1);
  const daysUntilStart = !seasonStarted ? Math.max(0, daysBetween(today, start)) : 0;

  const totalGoal = weeks.reduce((s, w) => s + (w.goal_count || 0), 0);

  // Per-week realized.
  // Week 1 absorbs everything done BEFORE or DURING its window (includes pre-season
  // work). Subsequent weeks count only items completed within their own range.
  const realizedPerWeek = weeks.map((w) => {
    const ws = parseISODate(w.week_start);
    const we = parseISODate(w.week_end);
    const isFirst = w.week_number === 1;
    const count = finalized.filter((f) => {
      const d = new Date(f.updated_at);
      const upper = d < addDays(we, 1);
      const lower = isFirst ? true : d >= ws;
      return upper && lower;
    }).length;
    return { ...w, realized: count };
  });

  // Cumulative chart data
  let goalAcc = 0;
  let realAcc = 0;
  const chartData = realizedPerWeek.map((w) => {
    goalAcc += w.goal_count;
    realAcc += w.realized;
    return {
      semana: `S${w.week_number}`,
      label: `${formatBR(parseISODate(w.week_start))}–${formatBR(parseISODate(w.week_end))}`,
      meta: goalAcc,
      realizado: realAcc,
    };
  });

  // Projection — only meaningful while the season is in progress.
  // Pre-season: averages would divide by 0 (or be inflated by pre-season work).
  // Post-season: just show what was achieved.
  const projectionAvailable = seasonStarted && !seasonEnded && elapsedDays > 0;
  const avgPerDay = projectionAvailable ? totalFinalized / elapsedDays : 0;
  const avgPerWeek = avgPerDay * 7;
  const projection = projectionAvailable
    ? Math.round(avgPerDay * totalSeasonDays)
    : seasonEnded
    ? totalFinalized
    : 0;
  const willMissGoal = projectionAvailable && totalPlanned > 0 && projection < totalPlanned;

  const statusVsGoal = realAcc - goalAcc;

  return (
    <>
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard
          icon={<Target className="h-4 w-4" />}
          label="IRPFs previstos"
          value={totalPlanned.toString()}
          accent="from-blue-500/20 to-blue-500/5 text-blue-600 dark:text-blue-400"
        />
        <KpiCard
          icon={<Trophy className="h-4 w-4" />}
          label="Realizados"
          value={totalFinalized.toString()}
          subtitle="Finalizados + Prévia enviada"
          accent="from-emerald-500/20 to-emerald-500/5 text-emerald-600 dark:text-emerald-400"
        />
        <KpiCard
          icon={<Activity className="h-4 w-4" />}
          label="Concluído"
          value={`${percentDone.toFixed(1)}%`}
          accent="from-violet-500/20 to-violet-500/5 text-violet-600 dark:text-violet-400"
          progress={Math.min(100, percentDone)}
        />
        <KpiCard
          icon={<CalendarDays className="h-4 w-4" />}
          label="Dias restantes"
          value={daysRemaining.toString()}
          accent={daysRemaining <= 7
            ? "from-red-500/20 to-red-500/5 text-red-600 dark:text-red-400"
            : daysRemaining <= 14
            ? "from-amber-500/20 to-amber-500/5 text-amber-600 dark:text-amber-400"
            : "from-slate-500/20 to-slate-500/5 text-slate-600 dark:text-slate-400"
          }
        />
        <KpiCard
          icon={<CalendarDays className="h-4 w-4" />}
          label="Prazo final"
          value={formatBRFull(deadline)}
          subtitle={`Início: ${formatBRFull(start)}`}
          accent="from-primary/20 to-primary/5 text-primary"
        />
      </div>

      {/* Chart */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Acompanhamento acumulado</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Comparativo entre meta acumulada e produção real semana a semana
            </p>
          </div>
          <Badge
            variant="outline"
            className={
              statusVsGoal > 0 ? "border-emerald-500/50 text-emerald-600 bg-emerald-500/10"
              : statusVsGoal === 0 ? "border-blue-500/50 text-blue-600 bg-blue-500/10"
              : "border-red-500/50 text-red-600 bg-red-500/10"
            }
          >
            {statusVsGoal > 0 ? <><TrendingUp className="h-3 w-3 mr-1" />+{statusVsGoal} acima da meta</>
              : statusVsGoal === 0 ? "Na meta"
              : <><TrendingDown className="h-3 w-3 mr-1" />{statusVsGoal} abaixo da meta</>}
          </Badge>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="h-[280px] grid place-items-center text-sm text-muted-foreground">
              Configure as semanas na aba "Metas Semanais" para visualizar o gráfico.
            </div>
          ) : (
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 12, right: 24, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="semana" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <RTooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelFormatter={(_, p) => p?.[0]?.payload?.label ?? ""}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="meta" stroke="hsl(var(--primary))" strokeWidth={2.5} name="Meta acumulada" dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="realizado" stroke="hsl(142 71% 45%)" strokeWidth={2.5} name="Realizado acumulado" dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Projection */}
      <Card className={willMissGoal ? "border-red-500/40" : projectionAvailable ? "border-emerald-500/40" : ""}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Projeção
          </CardTitle>
        </CardHeader>

        {!seasonStarted ? (
          <CardContent className="py-6">
            <div className="flex items-start gap-3 p-4 rounded-md bg-blue-500/10 border border-blue-500/30">
              <CalendarDays className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
              <div className="text-sm">
                <strong className="text-blue-700 dark:text-blue-400">Temporada ainda não iniciou.</strong>{" "}
                A projeção fica disponível a partir de <strong>{formatBRFull(start)}</strong>
                {daysUntilStart > 0 && <> — faltam <strong>{daysUntilStart}</strong> {daysUntilStart === 1 ? "dia" : "dias"}.</>}
                <div className="text-xs text-muted-foreground mt-1">
                  Já realizados antes do início da temporada: <strong>{totalFinalized}</strong> (serão absorvidos pela S1).
                </div>
              </div>
            </div>
          </CardContent>
        ) : seasonEnded ? (
          <CardContent className="py-6">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <Stat label="Total realizado" value={totalFinalized.toString()} tone={totalFinalized >= totalPlanned ? "success" : "danger"} />
              <Stat label="Meta total" value={totalPlanned.toString()} />
              <Stat
                label="Diferença vs. meta"
                value={`${totalFinalized - totalPlanned >= 0 ? "+" : ""}${totalFinalized - totalPlanned}`}
                tone={totalFinalized >= totalPlanned ? "success" : "danger"}
              />
            </div>
          </CardContent>
        ) : (
          <>
            <CardContent className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Stat label="Média / dia" value={avgPerDay.toFixed(1)} />
              <Stat label="Média / semana" value={avgPerWeek.toFixed(1)} />
              <Stat
                label="Projeção até o prazo"
                value={projection.toString()}
                tone={willMissGoal ? "danger" : "success"}
              />
              <Stat
                label="Diferença vs. previsto"
                value={`${projection - totalPlanned >= 0 ? "+" : ""}${projection - totalPlanned}`}
                tone={willMissGoal ? "danger" : "success"}
              />
            </CardContent>
            {willMissGoal && (
              <div className="mx-6 mb-6 p-3 rounded-md bg-red-500/10 border border-red-500/30 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                <div className="text-xs">
                  <strong className="text-red-600 dark:text-red-400">Alerta de meta:</strong>{" "}
                  No ritmo atual, faltarão <strong>{totalPlanned - projection}</strong> declarações até o prazo final.
                  Considere aumentar a produção semanal para atingir a meta total.
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </>
  );
}

function KpiCard({
  icon, label, value, subtitle, accent, progress,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle?: string;
  accent: string;
  progress?: number;
}) {
  return (
    <Card className={`bg-gradient-to-br ${accent} border-0 shadow-sm`}>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium opacity-80">{label}</span>
          <span className="opacity-70">{icon}</span>
        </div>
        <div>
          <div className="text-2xl font-bold tracking-tight">{value}</div>
          {subtitle && <div className="text-[10px] opacity-70 mt-0.5">{subtitle}</div>}
        </div>
        {progress !== undefined && (
          <div className="h-1.5 rounded-full bg-foreground/10 overflow-hidden">
            <div
              className="h-full bg-current transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "success" | "danger" }) {
  const color = tone === "success"
    ? "text-emerald-600 dark:text-emerald-400"
    : tone === "danger" ? "text-red-600 dark:text-red-400"
    : "text-foreground";
  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

/* ─────────────────────────────  WEEKLY  ───────────────────────────── */

function WeeklyBlock({ season, canManage }: { season: any; canManage: boolean }) {
  const { data: weeks = [], isLoading } = useWeeklyGoals(season.id);
  const { data: finalized = [] } = useFinalizedCasesInRange(season.start_date, season.deadline_date);
  const replace = useReplaceWeeklyGoals();
  const update = useUpdateWeeklyGoal();

  const [edits, setEdits] = useState<Record<string, number>>({});

  // Generate / reset weeks
  const handleGenerate = async (distribute: boolean) => {
    const generated = generateWeeks(season.start_date, season.deadline_date);
    const goals = distribute
      ? distributeGoals(season.total_planned || 0, generated.length)
      : generated.map(() => 0);
    await replace.mutateAsync({
      seasonId: season.id,
      weeks: generated.map((w, i) => ({
        week_number: w.week_number,
        week_start: w.week_start,
        week_end: w.week_end,
        goal_count: goals[i],
      })),
    });
    toast({
      title: "Semanas geradas",
      description: distribute
        ? `${generated.length} semanas com meta distribuída automaticamente.`
        : `${generated.length} semanas criadas. Defina as metas manualmente.`,
    });
  };

  const handleSaveAll = async () => {
    const entries = Object.entries(edits);
    if (entries.length === 0) {
      toast({ title: "Nada para salvar", description: "Nenhuma meta foi alterada." });
      return;
    }
    await Promise.all(entries.map(([id, goal_count]) =>
      update.mutateAsync({ id, goal_count })
    ));
    setEdits({});
    toast({ title: "Metas atualizadas" });
  };

  const today = new Date();

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base">Metas Semanais</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {weeks.length > 0
                ? `${weeks.length} semanas configuradas — soma das metas: ${weeks.reduce((s, w) => s + w.goal_count, 0)}`
                : "Nenhuma semana gerada para esta temporada"}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => handleGenerate(false)} disabled={replace.isPending}>
              <Plus className="h-4 w-4 mr-1.5" /> Gerar semanas (vazias)
            </Button>
            <Button size="sm" onClick={() => handleGenerate(true)} disabled={replace.isPending}>
              <Wand2 className="h-4 w-4 mr-1.5" /> Distribuir automaticamente
            </Button>
            {Object.keys(edits).length > 0 && (
              <Button size="sm" variant="default" onClick={handleSaveAll}>
                <Save className="h-4 w-4 mr-1.5" /> Salvar alterações ({Object.keys(edits).length})
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground py-8 text-center">Carregando…</div>
          ) : weeks.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Nenhuma semana configurada. Use "Gerar semanas" ou "Distribuir automaticamente" acima.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[820px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Semana</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead className="w-32">Meta</TableHead>
                    <TableHead className="w-24 text-center">Realizado</TableHead>
                    <TableHead className="w-24 text-center">Diferença</TableHead>
                    <TableHead className="w-32 text-center">% atingido</TableHead>
                    <TableHead className="w-32 text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {weeks.map((w) => {
                    const ws = parseISODate(w.week_start);
                    const we = parseISODate(w.week_end);
                    const isFirst = w.week_number === 1;
                    const realized = finalized.filter((f) => {
                      const d = new Date(f.updated_at);
                      const upper = d < addDays(we, 1);
                      const lower = isFirst ? true : d >= ws;
                      return upper && lower;
                    }).length;
                    const currentGoal = edits[w.id] ?? w.goal_count;
                    const diff = realized - currentGoal;
                    const pct = currentGoal > 0 ? (realized / currentGoal) * 100 : 0;
                    const isPast = today > addDays(we, 1);
                    const isCurrent = today >= ws && today <= addDays(we, 1);

                    let status: { label: string; cls: string } = { label: "—", cls: "" };
                    if (currentGoal === 0) {
                      status = { label: "Sem meta", cls: "bg-muted text-muted-foreground" };
                    } else if (pct >= 100) {
                      status = { label: "Meta atingida", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30" };
                    } else if (pct >= 70) {
                      status = { label: "Próximo da meta", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30" };
                    } else if (isPast) {
                      status = { label: "Atrasado", cls: "bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/30" };
                    } else {
                      status = { label: "Em andamento", cls: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30" };
                    }

                    return (
                      <TableRow key={w.id} className={isCurrent ? "bg-primary/5" : ""}>
                        <TableCell className="font-semibold">
                          S{w.week_number}
                          {isCurrent && (
                            <Badge variant="outline" className="ml-1.5 text-[9px] py-0 px-1 border-primary/40 text-primary">
                              atual
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatBR(ws)} a {formatBR(we)}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            value={currentGoal}
                            onChange={(e) => setEdits((p) => ({ ...p, [w.id]: Math.max(0, Number(e.target.value) || 0) }))}
                            className="h-8 w-24"
                          />
                        </TableCell>
                        <TableCell className="text-center font-semibold">{realized}</TableCell>
                        <TableCell className={`text-center font-medium ${diff > 0 ? "text-emerald-600" : diff < 0 ? "text-red-600" : ""}`}>
                          {diff > 0 ? `+${diff}` : diff}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="font-semibold">{pct.toFixed(0)}%</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${status.cls}`}>
                            {status.label}
                          </span>
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

/* ─────────────────────────────  CONFIG  ───────────────────────────── */

function ConfigBlock({ season, onYearChange }: { season: any; onYearChange: (y: number) => void }) {
  const upsert = useUpsertSeason();
  const remove = useDeleteSeason();
  const [form, setForm] = useState({
    season_year: season.season_year,
    start_date: season.start_date,
    deadline_date: season.deadline_date,
    total_planned: season.total_planned,
    notes: season.notes ?? "",
  });

  useEffect(() => {
    setForm({
      season_year: season.season_year,
      start_date: season.start_date,
      deadline_date: season.deadline_date,
      total_planned: season.total_planned,
      notes: season.notes ?? "",
    });
  }, [season.id]);

  const handleSave = async () => {
    if (!form.start_date || !form.deadline_date) {
      toast({ title: "Datas obrigatórias", variant: "destructive" });
      return;
    }
    if (form.deadline_date < form.start_date) {
      toast({ title: "Datas inválidas", description: "Prazo final deve ser depois do início.", variant: "destructive" });
      return;
    }
    const saved = await upsert.mutateAsync({
      ...form,
      total_planned: Number(form.total_planned) || 0,
    });
    onYearChange(saved.season_year);
  };

  const handleDelete = async () => {
    if (!confirm(`Excluir a temporada ${season.season_year}? Todas as metas semanais serão removidas.`)) return;
    await remove.mutateAsync(season.id);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Configuração da Temporada</CardTitle>
        <p className="text-xs text-muted-foreground">
          Ajuste o período e o total previsto. Cada ano possui sua própria configuração.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <Label>Ano da temporada</Label>
            <Input
              type="number"
              value={form.season_year}
              onChange={(e) => setForm({ ...form, season_year: Number(e.target.value) || season.season_year })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Data de início</Label>
            <Input
              type="date"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Prazo final (Receita)</Label>
            <Input
              type="date"
              value={form.deadline_date}
              onChange={(e) => setForm({ ...form, deadline_date: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Total de declarações previstas</Label>
            <Input
              type="number"
              min={0}
              value={form.total_planned}
              onChange={(e) => setForm({ ...form, total_planned: Number(e.target.value) || 0 })}
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <Button variant="outline" size="sm" onClick={handleDelete} className="text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4 mr-1.5" /> Excluir temporada
          </Button>
          <Button onClick={handleSave} disabled={upsert.isPending}>
            <Save className="h-4 w-4 mr-1.5" /> Salvar configuração
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ───────────────────  NEW SEASON DIALOG  ─────────────────── */

function NewSeasonDialog({ onCreated, initial }: { onCreated: (year: number) => void; initial?: boolean }) {
  const upsert = useUpsertSeason();
  const replace = useReplaceWeeklyGoals();
  const [open, setOpen] = useState(false);
  const currentYear = new Date().getFullYear();
  const [form, setForm] = useState({
    season_year: currentYear,
    start_date: toISODate(new Date(currentYear, 3, 27)), // 27/04
    deadline_date: toISODate(new Date(currentYear, 4, 29)), // 29/05
    total_planned: 0,
    auto_distribute: true,
  });

  const handleCreate = async () => {
    if (form.deadline_date < form.start_date) {
      toast({ title: "Datas inválidas", description: "Prazo final deve ser depois do início.", variant: "destructive" });
      return;
    }
    const saved = await upsert.mutateAsync({
      season_year: form.season_year,
      start_date: form.start_date,
      deadline_date: form.deadline_date,
      total_planned: Number(form.total_planned) || 0,
      notes: null,
    });
    // Auto-generate weekly goals
    const generated = generateWeeks(form.start_date, form.deadline_date);
    const goals = form.auto_distribute
      ? distributeGoals(form.total_planned, generated.length)
      : generated.map(() => 0);
    await replace.mutateAsync({
      seasonId: saved.id,
      weeks: generated.map((w, i) => ({
        week_number: w.week_number,
        week_start: w.week_start,
        week_end: w.week_end,
        goal_count: goals[i],
      })),
    });
    onCreated(saved.season_year);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size={initial ? "default" : "sm"} className="gap-1.5">
          <Plus className="h-4 w-4" /> Nova temporada
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova temporada</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Ano</Label>
            <Input
              type="number"
              value={form.season_year}
              onChange={(e) => setForm({ ...form, season_year: Number(e.target.value) || currentYear })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Início</Label>
              <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Prazo final</Label>
              <Input type="date" value={form.deadline_date} onChange={(e) => setForm({ ...form, deadline_date: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Total previsto</Label>
            <Input
              type="number"
              min={0}
              value={form.total_planned}
              onChange={(e) => setForm({ ...form, total_planned: Number(e.target.value) || 0 })}
            />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form.auto_distribute}
              onChange={(e) => setForm({ ...form, auto_distribute: e.target.checked })}
              className="rounded"
            />
            Distribuir o total automaticamente entre as semanas
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleCreate} disabled={upsert.isPending}>
            Criar temporada
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
