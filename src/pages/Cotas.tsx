import { useMemo, useState, useEffect } from "react";
import { Navigate, Link } from "react-router-dom";
import { Calculator, Download, Search } from "lucide-react";
import { InternalLayout } from "@/components/InternalLayout";
import { StatCard } from "@/components/StatCard";
import { MultiSelectFilter } from "@/components/MultiSelectFilter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { useCases } from "@/hooks/use-cases";
import { useAuth } from "@/hooks/use-auth";
import { useSeasons } from "@/hooks/use-irpf-goals";

const FILTERS_KEY = "cotas-filters";

function loadSaved() {
  try { return JSON.parse(localStorage.getItem(FILTERS_KEY) || "{}"); } catch { return {}; }
}

function formatBRL(v: number | null | undefined) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function Cotas() {
  const { role } = useAuth() as any;
  const allowed = role === "admin" || role === "operacional" || role === "financeiro";

  const saved = useMemo(() => loadSaved(), []);
  const { data: cases = [], isLoading } = useCases();
  const { data: seasons = [] } = useSeasons();

  const activeSeasonYear = useMemo(() => {
    if (!seasons.length) return null;
    const now = new Date().getFullYear();
    return seasons.find((s) => s.season_year === now)?.season_year ?? seasons[0].season_year;
  }, [seasons]);

  const [search, setSearch] = useState<string>(saved.search ?? "");
  const [unitFilter, setUnitFilter] = useState<"all" | "2mc" | "2ms">(saved.unitFilter ?? "all");
  const [quotasFilter, setQuotasFilter] = useState<string[]>(saved.quotasFilter ?? []);
  const [ownerFilter, setOwnerFilter] = useState<string[]>(saved.ownerFilter ?? []);

  useEffect(() => {
    localStorage.setItem(FILTERS_KEY, JSON.stringify({ search, unitFilter, quotasFilter, ownerFilter }));
  }, [search, unitFilter, quotasFilter, ownerFilter]);

  if (!allowed) return <Navigate to="/" replace />;

  // Linhas: 1 por demanda da temporada ativa cujo deliverable tem guide_payment_type = 'cotas'
  const rows = useMemo(() => {
    return cases
      .filter((c) => !activeSeasonYear || c.base_year === activeSeasonYear || c.base_year === activeSeasonYear - 1)
      .map((c) => {
        const fd = (c.final_deliverables ?? []).find(
          (d: any) => !d.retificacao && d.guide_payment_type === "cotas",
        ) as any | undefined;
        if (!fd) return null;
        return { c, fd };
      })
      .filter(Boolean) as Array<{ c: any; fd: any }>;
  }, [cases, activeSeasonYear]);

  const owners = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(({ c }) => c.internal_owner && set.add(c.internal_owner));
    return Array.from(set).sort();
  }, [rows]);

  const quotasOptions = useMemo(() => {
    const set = new Set<number>();
    rows.forEach(({ fd }) => fd.guide_quota_count && set.add(fd.guide_quota_count));
    return Array.from(set).sort((a, b) => a - b).map((n) => ({ value: String(n), label: `${n} cotas` }));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter(({ c, fd }) => {
        const name = (c.clients?.full_name ?? "").toLowerCase();
        const cpf = (c.clients?.cpf ?? "").replace(/\D/g, "");
        const okSearch = !q || name.includes(q) || cpf.includes(q.replace(/\D/g, ""));
        const tags = (c.clients?.tags ?? []) as string[];
        const okUnit = unitFilter === "all"
          || (unitFilter === "2mc" && tags.includes("2M Contabilidade"))
          || (unitFilter === "2ms" && tags.includes("2M Saúde"));
        const okOwner = ownerFilter.length === 0 || (c.internal_owner && ownerFilter.includes(c.internal_owner));
        const okQuotas = quotasFilter.length === 0 || quotasFilter.includes(String(fd.guide_quota_count ?? ""));
        return okSearch && okUnit && okOwner && okQuotas;
      })
      .sort((a, b) => (a.c.clients?.full_name ?? "").localeCompare(b.c.clients?.full_name ?? ""));
  }, [rows, search, unitFilter, ownerFilter, quotasFilter]);

  const totals = useMemo(() => {
    const totalClients = filtered.length;
    const totalImposto = filtered.reduce((s, { fd }) => s + (Number(fd.tax_due_amount) || 0), 0);
    const totalCotas = filtered.reduce((s, { fd }) => s + (Number(fd.guide_quota_count) || 0), 0);
    return { totalClients, totalImposto, totalCotas };
  }, [filtered]);

  const exportCSV = () => {
    const header = ["Cliente", "CPF", "Unidade", "Responsável", "Exercício", "Status", "Qtd Cotas", "Imposto Devido (R$)"];
    const lines = filtered.map(({ c, fd }) => {
      const tags = (c.clients?.tags ?? []) as string[];
      const unit = tags.includes("2M Contabilidade") ? "2MC" : tags.includes("2M Saúde") ? "2MS" : "";
      return [
        c.clients?.full_name ?? "",
        (c.clients?.cpf ?? "").replace(/\D/g, ""),
        unit,
        c.internal_owner ?? "",
        c.tax_year ?? "",
        c.status ?? "",
        fd.guide_quota_count ?? "",
        fd.tax_due_amount ?? "",
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
    });
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clientes-imposto-em-cotas-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasActiveFilters = !!search || unitFilter !== "all" || quotasFilter.length > 0 || ownerFilter.length > 0;

  return (
    <InternalLayout>
      <TooltipProvider>
        <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-semibold">Imposto em Cotas</h1>
              {activeSeasonYear && (
                <span className="text-xs text-muted-foreground ml-1">Temporada {activeSeasonYear}</span>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={exportCSV} disabled={filtered.length === 0}>
              <Download className="h-4 w-4 mr-2" /> Exportar CSV
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4">
            <StatCard label="Clientes em cotas" value={totals.totalClients} icon={Calculator} color="text-primary" />
            <StatCard label="Total de cotas" value={totals.totalCotas} icon={Calculator} color="text-amber-600" />
            <StatCard label="Imposto devido total" value={formatBRL(totals.totalImposto)} icon={Calculator} color="text-emerald-600" />
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-2 top-3 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou CPF"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64 h-10 pl-8"
              />
            </div>
            <Select value={unitFilter} onValueChange={(v) => setUnitFilter(v as any)}>
              <SelectTrigger className="w-40 h-10">
                <SelectValue placeholder="Unidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as unidades</SelectItem>
                <SelectItem value="2mc">2MC — 2M Contabilidade</SelectItem>
                <SelectItem value="2ms">2MS — 2M Saúde</SelectItem>
              </SelectContent>
            </Select>
            <MultiSelectFilter
              options={quotasOptions}
              selected={quotasFilter}
              onChange={setQuotasFilter}
              placeholder="Qtd de cotas"
              width="w-40"
            />
            <MultiSelectFilter
              options={owners.map((o) => ({ value: o, label: o }))}
              selected={ownerFilter}
              onChange={setOwnerFilter}
              placeholder="Responsáveis"
              width="w-48"
            />
            {hasActiveFilters && (
              <Button variant="outline" onClick={() => {
                setSearch(""); setUnitFilter("all"); setQuotasFilter([]); setOwnerFilter([]);
              }}>
                Limpar filtros
              </Button>
            )}
          </div>

          {/* Tabela */}
          <div className="rounded-lg border bg-card overflow-x-auto">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead className="whitespace-nowrap">Exercício</TableHead>
                  <TableHead className="whitespace-nowrap text-center">Qtd Cotas</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Imposto Devido</TableHead>
                  <TableHead className="whitespace-nowrap text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={7}><Skeleton className="h-6 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                      Nenhum cliente encontrado com imposto dividido em cotas.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map(({ c, fd }) => {
                    const tags = (c.clients?.tags ?? []) as string[];
                    const has2mc = tags.includes("2M Contabilidade");
                    const has2ms = tags.includes("2M Saúde");
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="max-w-[260px]">
                          <div className="flex items-center gap-2 min-w-0">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Link
                                  to={`/demandas/${c.id}`}
                                  className="block truncate font-medium hover:text-primary hover:underline transition-colors"
                                >
                                  {c.clients?.full_name ?? "—"}
                                </Link>
                              </TooltipTrigger>
                              <TooltipContent>Abrir demanda — {c.clients?.full_name ?? "—"}</TooltipContent>
                            </Tooltip>
                            <span className="flex shrink-0 gap-1">
                              {has2mc && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-info/10 text-info">2MC</span>}
                              {has2ms && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-600">2MS</span>}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-mono text-xs">
                          {c.clients?.cpf ? c.clients.cpf.replace(/\D/g, "") : "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{c.internal_owner ?? "—"}</TableCell>
                        <TableCell className="whitespace-nowrap">{c.tax_year ?? "—"}</TableCell>
                        <TableCell className="text-center font-semibold">{fd.guide_quota_count ?? "—"}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{formatBRL(fd.tax_due_amount)}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {String(c.status ?? "").replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </TooltipProvider>
    </InternalLayout>
  );
}
