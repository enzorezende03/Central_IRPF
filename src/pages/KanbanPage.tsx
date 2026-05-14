import { useState, useMemo, useEffect } from "react";
import { Search, CalendarCheck } from "lucide-react";
import { InternalLayout } from "@/components/InternalLayout";
import { KanbanBoard } from "@/components/KanbanBoard";
import { KanbanSettingsDialog } from "@/components/KanbanSettingsDialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useCases } from "@/hooks/use-cases";
import { useKanbanPreferences } from "@/hooks/use-kanban-preferences";
import { useAuth } from "@/hooks/use-auth";
import { useSeasons, useWeeklyGoals } from "@/hooks/use-irpf-goals";
import { useAllPlanItems } from "@/hooks/use-weekly-plan";
import { parseISODate, addDays } from "@/lib/goals-utils";
import { PRIORITY_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";

const KANBAN_FILTERS_KEY = "kanban-filters";
const MY_WEEK_EXCLUDED = new Set(["finalizado", "previa_enviada", "dispensada"]);

function loadSavedFilters() {
  try {
    const saved = localStorage.getItem(KANBAN_FILTERS_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch { return {}; }
}

export default function KanbanPage() {
  const { data: cases = [], isLoading } = useCases();
  const { preferences } = useKanbanPreferences();
  const { profileName } = useAuth();
  const saved = useMemo(() => loadSavedFilters(), []);
  const [search, setSearch] = useState(saved.search ?? "");
  const [ownerFilter, setOwnerFilter] = useState(saved.ownerFilter ?? "all");
  const [priorityFilter, setPriorityFilter] = useState(saved.priorityFilter ?? "all");
  const [tagFilter, setTagFilter] = useState(saved.tagFilter ?? "all");
  const [procuracaoFilter, setProcuracaoFilter] = useState(saved.procuracaoFilter ?? "all");
  const [myWeek, setMyWeek] = useState<boolean>(saved.myWeek ?? false);

  // Apply saved DB filters only if no localStorage filters exist
  useEffect(() => {
    const sf = preferences.saved_filters;
    if (!localStorage.getItem(KANBAN_FILTERS_KEY)) {
      if (sf.owner) setOwnerFilter(sf.owner);
      if (sf.priority) setPriorityFilter(sf.priority);
      if (sf.tag) setTagFilter(sf.tag);
    }
  }, [preferences.saved_filters]);

  useEffect(() => {
    localStorage.setItem(KANBAN_FILTERS_KEY, JSON.stringify({
      search, ownerFilter, priorityFilter, tagFilter, procuracaoFilter, myWeek,
    }));
  }, [search, ownerFilter, priorityFilter, tagFilter, procuracaoFilter, myWeek]);

  // ----- Minha semana: identify current ISO week of the active season -----
  const { data: seasons = [] } = useSeasons();
  const activeSeason = useMemo(() => {
    const y = new Date().getFullYear();
    return seasons.find((s) => s.season_year === y) ?? seasons[0] ?? null;
  }, [seasons]);
  const { data: weeks = [] } = useWeeklyGoals(activeSeason?.id);
  const currentWeekNumber = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const w = weeks.find((w) => {
      const ws = parseISODate(w.week_start);
      const we = addDays(parseISODate(w.week_end), 1);
      return today >= ws && today < we;
    });
    return w?.week_number ?? null;
  }, [weeks]);

  const { data: planItems = [] } = useAllPlanItems();
  const myWeekCaseIds = useMemo(() => {
    if (!myWeek || !profileName || currentWeekNumber == null || !activeSeason) return null;
    const set = new Set<string>();
    planItems.forEach((p) => {
      if (
        p.season_id === activeSeason.id &&
        p.week_number === currentWeekNumber &&
        (p.responsible ?? "") === profileName
      ) set.add(p.case_id);
    });
    return set;
  }, [myWeek, profileName, currentWeekNumber, activeSeason, planItems]);

  const owners = useMemo(() => {
    const set = new Set<string>();
    cases.forEach((c) => c.internal_owner && set.add(c.internal_owner));
    return Array.from(set).sort();
  }, [cases]);

  const tags = useMemo(() => {
    const set = new Set<string>();
    cases.forEach((c) => c.clients?.tags?.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [cases]);

  const filtered = useMemo(() => {
    return cases.filter((c) => {
      const q = search.toLowerCase();
      const name = c.clients?.full_name?.toLowerCase() ?? "";
      const cpf = c.clients?.cpf ?? "";
      const matchSearch = !q || name.includes(q) || cpf.includes(q);
      const matchOwner = ownerFilter === "all" || (ownerFilter === "__none__" ? !c.internal_owner : c.internal_owner === ownerFilter);
      const matchPriority = priorityFilter === "all" || c.priority === priorityFilter;
      const matchTag = tagFilter === "all" || (c.clients?.tags?.includes(tagFilter) ?? false);
      let matchProc = true;
      if (procuracaoFilter !== "all") {
        const procItem = (c.internal_checklist ?? []).find((it: any) => it.label?.toLowerCase().includes("procura"));
        const hasProc = !!procItem?.checked;
        matchProc = procuracaoFilter === "ok" ? hasProc : !hasProc;
      }
      let matchMyWeek = true;
      if (myWeekCaseIds) {
        matchMyWeek = myWeekCaseIds.has(c.id) && !MY_WEEK_EXCLUDED.has(c.status as string);
      }
      return matchSearch && matchOwner && matchPriority && matchTag && matchProc && matchMyWeek;
    });
  }, [cases, search, ownerFilter, priorityFilter, tagFilter, procuracaoFilter, myWeekCaseIds]);

  const myWeekCount = useMemo(() => {
    if (!profileName || currentWeekNumber == null || !activeSeason) return 0;
    const ids = new Set<string>();
    planItems.forEach((p) => {
      if (
        p.season_id === activeSeason.id &&
        p.week_number === currentWeekNumber &&
        (p.responsible ?? "") === profileName
      ) ids.add(p.case_id);
    });
    let n = 0;
    cases.forEach((c) => {
      if (ids.has(c.id) && !MY_WEEK_EXCLUDED.has(c.status as string)) n++;
    });
    return n;
  }, [cases, planItems, profileName, currentWeekNumber, activeSeason]);

  const toggleMyWeek = () => {
    setMyWeek((v) => {
      const next = !v;
      if (next) setOwnerFilter("all"); // evita conflito com filtro de responsável
      return next;
    });
  };

  const myWeekDisabled = !profileName || currentWeekNumber == null;

  return (
    <InternalLayout>
      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Button
            variant={myWeek ? "default" : "outline"}
            onClick={toggleMyWeek}
            disabled={myWeekDisabled}
            title={myWeekDisabled ? "Sem semana ativa ou perfil sem nome" : "Mostrar apenas minhas demandas planejadas para esta semana"}
            className={cn("gap-2 whitespace-nowrap", myWeek && "ring-2 ring-primary/30")}
          >
            <CalendarCheck className="h-4 w-4" />
            Minha semana
            <span className={cn(
              "ml-1 inline-flex items-center justify-center rounded-full text-xs font-semibold min-w-[1.25rem] h-5 px-1.5",
              myWeek ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-foreground"
            )}>
              {myWeekCount}
            </span>
          </Button>
          <KanbanSettingsDialog />
          <Select value={ownerFilter} onValueChange={setOwnerFilter} disabled={myWeek}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Responsável" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos responsáveis</SelectItem>
              <SelectItem value="__none__">Sem responsável</SelectItem>
              {owners.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Prioridade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {Object.entries(PRIORITY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={tagFilter} onValueChange={setTagFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Tag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas tags</SelectItem>
              {tags.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={procuracaoFilter} onValueChange={setProcuracaoFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Procuração" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Procuração: todas</SelectItem>
              <SelectItem value="ok">Com procuração</SelectItem>
              <SelectItem value="missing">Sem procuração</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <Skeleton className="h-96 rounded-xl" />
        ) : (
          <KanbanBoard cases={filtered} columnOrder={preferences.column_order} hiddenColumns={preferences.hidden_columns} />
        )}
      </div>
    </InternalLayout>
  );
}
