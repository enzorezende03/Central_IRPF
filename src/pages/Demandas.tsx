import { useState, useMemo, useEffect, useCallback } from "react";
import { formatCPF } from "@/lib/format-utils";
import { Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Link } from "react-router-dom";
import { InternalLayout } from "@/components/InternalLayout";
import { StatusBadge, BillingBadge, PriorityBadge } from "@/components/StatusBadge";
import { CaseActions } from "@/components/CaseActions";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { NewCaseDialog } from "@/components/NewCaseDialog";
import { useCases } from "@/hooks/use-cases";
import { STATUS_LABELS } from "@/lib/types";

const DEMANDAS_FILTERS_KEY = "demandas-filters";

function loadSavedFilters() {
  try {
    const saved = localStorage.getItem(DEMANDAS_FILTERS_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch { return {}; }
}

export default function Demandas() {
  const { data: cases = [], isLoading } = useCases();
  const saved = useMemo(() => loadSavedFilters(), []);
  const [search, setSearch] = useState(saved.search ?? "");
  const [tagFilter, setTagFilter] = useState(saved.tagFilter ?? "all");
  const [ownerFilter, setOwnerFilter] = useState(saved.ownerFilter ?? "all");
  const [internalStatusFilter, setInternalStatusFilter] = useState(saved.internalStatusFilter ?? "all");
  const [clientStatusFilter, setClientStatusFilter] = useState(saved.clientStatusFilter ?? "all");
  const [sortField, setSortField] = useState<"cliente" | "ano" | null>(saved.sortField ?? null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(saved.sortDir ?? "asc");

  useEffect(() => {
    localStorage.setItem(DEMANDAS_FILTERS_KEY, JSON.stringify({
      search, tagFilter, ownerFilter, internalStatusFilter, clientStatusFilter, sortField, sortDir,
    }));
  }, [search, tagFilter, ownerFilter, internalStatusFilter, clientStatusFilter, sortField, sortDir]);

  const handleSort = (field: "cliente" | "ano") => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const owners = useMemo(() => {
    const set = new Set<string>();
    cases.forEach((c) => c.internal_owner && set.add(c.internal_owner));
    return Array.from(set).sort();
  }, [cases]);

  const tags = useMemo(() => {
    const set = new Set<string>();
    cases.forEach((c) => (c.clients?.tags ?? []).forEach((t: string) => set.add(t)));
    return Array.from(set).sort();
  }, [cases]);

  const filtered = useMemo(() => {
    const list = cases.filter((c) => {
      const q = search.toLowerCase();
      const name = c.clients?.full_name?.toLowerCase() ?? "";
      const matchSearch = !q || name.includes(q);
      const matchTag = tagFilter === "all" || (c.clients?.tags ?? []).includes(tagFilter);
      const matchOwner = ownerFilter === "all" || c.internal_owner === ownerFilter;
      const matchInternal = internalStatusFilter === "all" || c.status === internalStatusFilter;
      const matchClient = clientStatusFilter === "all" || c.status === clientStatusFilter;
      // Hide dispensadas unless explicitly filtered
      if (c.status === "dispensada" && internalStatusFilter !== "dispensada") return false;
      if (c.status === "documentos_parciais" && internalStatusFilter !== "documentos_parciais" && internalStatusFilter !== "all") {
      }
      return matchSearch && matchTag && matchOwner && matchInternal && matchClient;
    });
    if (sortField) {
      list.sort((a, b) => {
        let cmp = 0;
        if (sortField === "cliente") {
          cmp = (a.clients?.full_name ?? "").localeCompare(b.clients?.full_name ?? "", "pt-BR");
        } else if (sortField === "ano") {
          cmp = (a.base_year ?? 0) - (b.base_year ?? 0);
        }
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return list;
  }, [cases, search, tagFilter, ownerFilter, internalStatusFilter, clientStatusFilter, sortField, sortDir]);

  return (
    <InternalLayout>
      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
        {/* Filters */}
        <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center justify-between">
          <NewCaseDialog />
        </div>
        <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome do cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={tagFilter} onValueChange={setTagFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Tag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as tags</SelectItem>
                {tags.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
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
            <Select value={internalStatusFilter} onValueChange={setInternalStatusFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <Skeleton className="h-96 rounded-xl" />
        ) : (
          <div className="rounded-xl border bg-card shadow-sm overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[120px] cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("cliente")}>
                    <span className="flex items-center gap-1">
                      Cliente
                      {sortField === "cliente" ? (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                    </span>
                  </TableHead>
                  <TableHead className="hidden sm:table-cell">Tag</TableHead>
                  <TableHead className="hidden md:table-cell">CPF</TableHead>
                  <TableHead className="hidden lg:table-cell cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("ano")}>
                    <span className="flex items-center gap-1">
                      Ano-base
                      {sortField === "ano" ? (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                    </span>
                  </TableHead>
                  <TableHead className="hidden sm:table-cell">Responsável</TableHead>
                  <TableHead className="min-w-[100px]">Status</TableHead>
                  <TableHead className="hidden md:table-cell">Prioridade</TableHead>
                  <TableHead className="hidden lg:table-cell">Tipo</TableHead>
                  
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => {
                  const billing = c.billing?.[0];
                  const caseStatus = c.status;
                  return (
                    <TableRow key={c.id} className={`hover:bg-muted/50 ${billing && billing.billing_status !== "pago" ? "border-l-2 border-l-warning" : ""}`}>
                      <TableCell className="font-medium">
                        <Link to={`/demandas/${c.id}`} className="hover:text-primary transition-colors">
                          {c.clients?.full_name}
                        </Link>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {(c.clients?.tags ?? []).map((tag: string) => (
                            <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                        {formatCPF(c.clients?.cpf)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">
                        {c.base_year}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm">{c.internal_owner ?? "—"}</TableCell>
                      <TableCell>
                        <StatusBadge status={c.status} />
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <PriorityBadge priority={c.priority} />
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <Badge variant={c.declaration_type === "completa" ? "default" : "outline"} className="text-xs">
                          {c.declaration_type === "completa" ? "Completa" : "Simples"}
                        </Badge>
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
