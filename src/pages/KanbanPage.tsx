import { useState, useMemo, useEffect } from "react";
import { Search } from "lucide-react";
import { InternalLayout } from "@/components/InternalLayout";
import { KanbanBoard } from "@/components/KanbanBoard";
import { KanbanSettingsDialog } from "@/components/KanbanSettingsDialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useCases } from "@/hooks/use-cases";
import { useKanbanPreferences } from "@/hooks/use-kanban-preferences";
import { PRIORITY_LABELS } from "@/lib/types";

export default function KanbanPage() {
  const { data: cases = [], isLoading } = useCases();
  const { preferences } = useKanbanPreferences();
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");

  // Apply saved filters on load
  useEffect(() => {
    const sf = preferences.saved_filters;
    if (sf.owner) setOwnerFilter(sf.owner);
    if (sf.priority) setPriorityFilter(sf.priority);
    if (sf.tag) setTagFilter(sf.tag);
  }, [preferences.saved_filters]);

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
      return matchSearch && matchOwner && matchPriority && matchTag;
    });
  }, [cases, search, ownerFilter, priorityFilter, tagFilter]);

  return (
    <InternalLayout>
      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <KanbanSettingsDialog />
          <Select value={ownerFilter} onValueChange={setOwnerFilter}>
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
