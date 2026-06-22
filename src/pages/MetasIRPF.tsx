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
  Plus, Save, Wand2, Pencil, Trash2, Activity, Calendar, Lock, Filter, X,
} from "lucide-react";
import { MultiSelectFilter } from "@/components/MultiSelectFilter";
import { useAuth } from "@/hooks/use-auth";
import {
  useSeasons, useWeeklyGoals, useUpsertSeason, useDeleteSeason,
  useReplaceWeeklyGoals, useUpdateWeeklyGoal, useFinalizedCasesInRange,
  useSnapshotWeeklyRealized,
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
  const canManage = hasPermission("editar_metas");

  const { data: seasons = [], isLoading: loadingSeasons } = useSeasons();
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [excludedOwners, setExcludedOwners] = useState<string[]>([]);

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
          <>
            <OwnerFilterBar season={season} excluded={excludedOwners} onChange={setExcludedOwners} />
            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList className="bg-muted/50">
                <TabsTrigger value="overview" className="gap-2"><Activity className="h-4 w-4" /> Visão Geral</TabsTrigger>
                <TabsTrigger value="weekly" className="gap-2"><Calendar className="h-4 w-4" /> Metas Semanais</TabsTrigger>
                {canManage && (
                  <TabsTrigger value="config" className="gap-2"><Target className="h-4 w-4" /> Configuração</TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="overview" className="space-y-6">
                <OverviewBlock season={season} excludedOwners={excludedOwners} />
              </TabsContent>

              <TabsContent value="weekly" className="space-y-6">
                <WeeklyBlock season={season} canManage={canManage} excludedOwners={excludedOwners} />
              </TabsContent>

              {canManage && (
                <TabsContent value="config" className="space-y-6">
                  <ConfigBlock season={season} onYearChange={setSelectedYear} />
                </TabsContent>
              )}
            </Tabs>
          </>
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

function computeLiveRealized(
  week: { week_number: number; week_start: string; week_end: string },
  finalized: any[]
): number {
  const ws = parseISODate(week.week_start);
  const we = parseISODate(week.week_end);
  const isFirst = week.week_number === 1;
  return finalized.filter((f) => {
    const d = new Date(f.completed_at ?? f.updated_at);
    const upper = d < addDays(we, 1);
    const lower = isFirst ? true : d >= ws;
    return upper && lower;
  }).length;
}

function OverviewBlock({ season, excludedOwners = [] }: { season: any; excludedOwners?: string[] }) {
  const { data: weeks = [] } = useWeeklyGoals(season.id);
  const { data: rawFinalized = [], isSuccess: finalizedLoaded } = useFinalizedCasesInRange(season.start_date, season.deadline_date);
  const snapshot = useSnapshotWeeklyRealized();
  const hasExclusion = excludedOwners.length > 0;
  const finalized = useMemo(() => {
    if (!hasExclusion) return rawFinalized;
    const set = new Set(excludedOwners);
    return rawFinalized.filter((f: any) => {
      const owner = f.internal_owner ?? "__none__";
      return !set.has(owner);
    });
  }, [rawFinalized, excludedOwners, hasExclusion]);

  const totalPlanned = season.total_planned || 0;

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
  // - Closed weeks (week_end < today) use the persisted snapshot if available;
  //   otherwise we compute once and persist so the value freezes.
  // - The current/future weeks compute live.
  const realizedPerWeek = weeks.map((w) => {
    const we = parseISODate(w.week_end);
    const isClosed = today > we; // week ended yesterday or earlier
    const live = computeLiveRealized(w, finalized);
    const realized = !hasExclusion && isClosed && w.realized_snapshot != null ? w.realized_snapshot : live;
    return { ...w, realized };
  });

  // Auto-snapshot any closed week that hasn't been frozen yet.
  // IMPORTANT: only run after the finalized cases query actually returned data,
  // otherwise we'd freeze a "0" while the request is still in-flight.
  
  useEffect(() => {
    if (hasExclusion) return; // don't freeze simulated values
    if (!finalizedLoaded || weeks.length === 0) return;
    const pending = weeks
      .filter((w) => today > parseISODate(w.week_end) && (w.realized_snapshot == null))
      .map((w) => ({ id: w.id, realized: computeLiveRealized(w, finalized) }))
      .filter((p) => p.realized > 0); // never freeze a zero — wait for real data
    if (pending.length > 0 && !snapshot.isPending) {
      snapshot.mutate(pending);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weeks, finalized, finalizedLoaded, hasExclusion]);

  const totalFinalized = realizedPerWeek.reduce((s, w) => s + w.realized, 0);
  const percentDone = totalPlanned > 0 ? (totalFinalized / totalPlanned) * 100 : 0;

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

  // Projection — média móvel dos últimos 7 dias (mais responsiva ao ritmo atual,
  // evita distorção de picos antigos ou trabalho pré-temporada).
  const projectionAvailable = seasonStarted && !seasonEnded;
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); // janela inclusiva de 7 dias
  const windowStart = sevenDaysAgo < start ? start : sevenDaysAgo;
  const windowDays = Math.max(1, daysBetween(windowStart, today) + 1);
  const finalizedInWindow = finalized.filter((f) => {
    const d = new Date((f as any).completed_at ?? f.updated_at);
    return d >= windowStart && d <= new Date(today.getTime() + 86400000 - 1);
  }).length;
  const avgPerDay = projectionAvailable ? finalizedInWindow / windowDays : 0;
  const avgPerWeek = avgPerDay * 7;
  const projection = projectionAvailable
    ? totalFinalized + Math.round(avgPerDay * daysRemaining)
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

      {/* Bonus scale */}
      <BonusScaleCard weeks={realizedPerWeek} today={today} />

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

/* ─────────────────────────────  BONUS SCALE  ───────────────────────────── */

const BONUS_TIERS = [
  { min: 0, max: 70, value: 0, label: "Abaixo de 70%" },
  { min: 70, max: 80, value: 1000, label: "70% a 79%" },
  { min: 80, max: 90, value: 1400, label: "80% a 89%" },
  { min: 90, max: 100, value: 1700, label: "90% a 99%" },
  { min: 100, max: Infinity, value: 2000, label: "100% ou mais" },
];

function getBonusTier(percent: number) {
  return BONUS_TIERS.findIndex((t) => percent >= t.min && percent < t.max);
}

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 });
}

function BonusScaleCard({
  weeks,
  today,
}: {
  weeks: Array<{ id: string; week_number: number; week_start: string; week_end: string; goal_count: number; realized: number }>;
  today: Date;
}) {
  // Determine current week (today within window) — fallback to last completed week
  const currentWeek =
    weeks.find((w) => {
      const ws = parseISODate(w.week_start);
      const we = addDays(parseISODate(w.week_end), 1);
      return today >= ws && today < we;
    }) ?? null;

  const totalEarned = weeks.reduce((sum, w) => {
    const we = parseISODate(w.week_end);
    const closed = today > addDays(we, 0); // só conta semanas já encerradas
    if (!closed) return sum;
    const pct = w.goal_count > 0 ? (w.realized / w.goal_count) * 100 : 0;
    const tierIdx = getBonusTier(pct);
    return sum + (BONUS_TIERS[tierIdx]?.value ?? 0);
  }, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="h-4 w-4" /> Escala de premiação semanal
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">
          Bonificação calculada por semana, conforme % de atingimento da meta semanal
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Tier table */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {BONUS_TIERS.map((t, i) => {
            const currentPct = currentWeek && currentWeek.goal_count > 0
              ? (currentWeek.realized / currentWeek.goal_count) * 100
              : -1;
            const active = currentPct >= 0 && i === getBonusTier(currentPct);
            return (
              <div
                key={i}
                className={`rounded-lg border p-3 text-center transition-all ${
                  active
                    ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/40"
                    : "border-border bg-muted/30"
                }`}
              >
                <div className={`text-[11px] font-medium ${active ? "text-primary" : "text-muted-foreground"}`}>
                  {t.label}
                </div>
                <div className={`text-lg font-bold mt-1 ${active ? "text-primary" : "text-foreground"}`}>
                  {formatBRL(t.value)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Weekly breakdown */}
        <div className="overflow-x-auto">
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Semana</TableHead>
                <TableHead>Período</TableHead>
                <TableHead className="text-center w-20">Meta</TableHead>
                <TableHead className="text-center w-24">Realizado</TableHead>
                <TableHead className="text-center w-24">% atingido</TableHead>
                <TableHead className="text-right w-28">Premiação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {weeks.map((w) => {
                const ws = parseISODate(w.week_start);
                const we = parseISODate(w.week_end);
                const isCurrent = today >= ws && today < addDays(we, 1);
                const isClosed = today > we;
                const pct = w.goal_count > 0 ? (w.realized / w.goal_count) * 100 : 0;
                const tierIdx = getBonusTier(pct);
                const bonus = w.goal_count > 0 ? (BONUS_TIERS[tierIdx]?.value ?? 0) : 0;
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
                    <TableCell className="text-sm whitespace-nowrap">
                      {formatBR(ws)} a {formatBR(we)}
                    </TableCell>
                    <TableCell className="text-center">{w.goal_count}</TableCell>
                    <TableCell className="text-center font-semibold">{w.realized}</TableCell>
                    <TableCell className="text-center font-medium">
                      {w.goal_count > 0 ? `${pct.toFixed(0)}%` : "—"}
                    </TableCell>
                    <TableCell className={`text-right font-bold ${bonus > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                      {formatBRL(bonus)}
                      {!isClosed && isCurrent && (
                        <span className="block text-[9px] font-normal text-muted-foreground">parcial</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between pt-1 border-t text-sm">
          <span className="text-muted-foreground">Total acumulado (semanas encerradas)</span>
          <strong className="text-lg text-emerald-600 dark:text-emerald-400">{formatBRL(totalEarned)}</strong>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─────────────────────────────  WEEKLY  ───────────────────────────── */

function WeeklyBlock({ season, canManage, excludedOwners = [] }: { season: any; canManage: boolean; excludedOwners?: string[] }) {
  const { data: weeks = [], isLoading } = useWeeklyGoals(season.id);
  const { data: rawFinalized = [] } = useFinalizedCasesInRange(season.start_date, season.deadline_date);
  const hasExclusion = excludedOwners.length > 0;
  const finalized = useMemo(() => {
    if (!hasExclusion) return rawFinalized;
    const set = new Set(excludedOwners);
    return rawFinalized.filter((f: any) => !set.has(f.internal_owner ?? "__none__"));
  }, [rawFinalized, excludedOwners, hasExclusion]);
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
          {canManage && (
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
          )}
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
                    const isClosed = today > we;
                    const live = computeLiveRealized(w, finalized);
                    const realized = !hasExclusion && isClosed && w.realized_snapshot != null ? w.realized_snapshot : live;
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
                          {canManage ? (
                            <Input
                              type="number"
                              min={0}
                              value={currentGoal}
                              onChange={(e) => setEdits((p) => ({ ...p, [w.id]: Math.max(0, Number(e.target.value) || 0) }))}
                              className="h-8 w-24"
                            />
                          ) : (
                            <span className="font-semibold">{currentGoal}</span>
                          )}
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

/* ─────────────────────  OWNER FILTER BAR  ───────────────────── */

function OwnerFilterBar({
  season,
  excluded,
  onChange,
}: {
  season: any;
  excluded: string[];
  onChange: (v: string[]) => void;
}) {
  const { data: finalized = [] } = useFinalizedCasesInRange(season.start_date, season.deadline_date);

  const options = useMemo(() => {
    const set = new Set<string>();
    let hasNone = false;
    finalized.forEach((f: any) => {
      const o = f.internal_owner;
      if (o && String(o).trim().length > 0) set.add(o);
      else hasNone = true;
    });
    const arr = Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
    const opts = arr.map((v) => ({ value: v, label: v }));
    if (hasNone) opts.push({ value: "__none__", label: "Sem responsável" });
    return opts;
  }, [finalized]);

  const hasExclusion = excluded.length > 0;
  const labels = excluded
    .map((v) => (v === "__none__" ? "Sem responsável" : v))
    .join(", ");

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Simular sem entregas de:</span>
        <MultiSelectFilter
          options={options}
          selected={excluded}
          onChange={onChange}
          placeholder="Responsável"
          width="w-56"
        />
      </div>
      {hasExclusion && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>
            Simulação ativa: ignorando entregas de <strong>{labels}</strong>. Snapshots semanais não estão sendo aplicados.
          </span>
          <button
            type="button"
            onClick={() => onChange([])}
            className="ml-1 inline-flex items-center gap-1 hover:underline"
          >
            <X className="h-3 w-3" /> Limpar
          </button>
        </div>
      )}
    </div>
  );
}

