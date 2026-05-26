import { useState, useMemo, useEffect, useCallback } from "react";
import { formatCPF } from "@/lib/format-utils";
import { Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { InternalLayout } from "@/components/InternalLayout";
import { StatusBadge, BillingBadge, PriorityBadge } from "@/components/StatusBadge";
import { CaseActions } from "@/components/CaseActions";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { NewCaseDialog } from "@/components/NewCaseDialog";
import { MultiSelectFilter } from "@/components/MultiSelectFilter";
import { useCases } from "@/hooks/use-cases";
import { useLastClientUploads } from "@/hooks/use-last-client-upload";
import { useAuth } from "@/hooks/use-auth";
import { STATUS_LABELS, type DemandStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

// Normaliza valores salvos (string antiga "all"/valor único OU array) para string[]
function toArr(v: any): string[] {
  if (Array.isArray(v)) return v.filter((x) => x && x !== "all");
  if (typeof v === "string" && v && v !== "all") return [v];
  return [];
}

const DEMANDAS_FILTERS_KEY = "demandas-filters";

function loadSavedFilters() {
  try {
    const saved = localStorage.getItem(DEMANDAS_FILTERS_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch { return {}; }
}

export default function Demandas() {
  const saved0 = useMemo(() => loadSavedFilters(), []);
  const [showDeleted, setShowDeleted] = useState<boolean>(saved0.showDeleted ?? false);
  const { data: cases = [], isLoading } = useCases(showDeleted);
  const { data: lastUploads } = useLastClientUploads();
  const { role, hasPermission, user, profileName } = useAuth() as any;
  const canCreate = role === "admin" || hasPermission("criar_demandas");
  const canEdit = role === "admin" || hasPermission("editar_demandas");
  const [searchParams, setSearchParams] = useSearchParams();
  const saved = useMemo(() => loadSavedFilters(), []);

  // Special filter keys vindos do Dashboard (não são status reais)
  const SPECIAL_FILTERS = ["previa_ajustes", "notes_alert_mine", "notes_alert_all"] as const;
  const rawStatusParam = searchParams.get("status");
  const isSpecial = !!rawStatusParam && (SPECIAL_FILTERS as readonly string[]).includes(rawStatusParam);

  // Query params override saved filters when presentes (vindo do Dashboard)
  const initialStatus = rawStatusParam && !isSpecial
    ? toArr(rawStatusParam)
    : toArr(saved.internalStatusFilter);
  const initialOwner = searchParams.get("owner")
    ? toArr(searchParams.get("owner"))
    : toArr(saved.ownerFilter);
  const initialPriority = searchParams.get("priority")
    ? toArr(searchParams.get("priority"))
    : toArr(saved.priorityFilter);

  const [search, setSearch] = useState(saved.search ?? "");
  const [tagFilter, setTagFilter] = useState<string[]>(toArr(saved.tagFilter));
  const [ownerFilter, setOwnerFilter] = useState<string[]>(initialOwner);
  const [internalStatusFilter, setInternalStatusFilter] = useState<string[]>(initialStatus);
  const [clientStatusFilter, setClientStatusFilter] = useState<string[]>(toArr(saved.clientStatusFilter));
  const [priorityFilter, setPriorityFilter] = useState<string[]>(initialPriority);
  const [specialFilter, setSpecialFilter] = useState<string | null>(isSpecial ? rawStatusParam : null);
  const [procuracaoFilter, setProcuracaoFilter] = useState<string>(saved.procuracaoFilter ?? "all");
  const [declarationTypeFilter, setDeclarationTypeFilter] = useState<string[]>(toArr(saved.declarationTypeFilter));
  const [sortField, setSortField] = useState<"cliente" | "ano" | "ultimo_doc" | null>(saved.sortField ?? null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(saved.sortDir ?? "asc");
  const [pageSize, setPageSize] = useState<number>(saved.pageSize ?? 50);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<string>("");
  const [bulkApplying, setBulkApplying] = useState(false);
  const queryClient = useQueryClient();
  

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const applyBulkStatus = async () => {
    if (!bulkStatus || selectedIds.size === 0) return;
    setBulkApplying(true);
    const ids = Array.from(selectedIds);
    const label = STATUS_LABELS[bulkStatus as DemandStatus] ?? bulkStatus;
    const author = profileName || user?.email || "Sistema";
    try {
      const { error } = await supabase
        .from("irpf_cases")
        .update({ status: bulkStatus as DemandStatus, updated_at: new Date().toISOString() })
        .in("id", ids);
      if (error) throw error;
      const events = ids.map((case_id) => ({
        case_id,
        event_type: "Status alterado em lote",
        description: `Status alterado para "${label}"`,
        created_by: author,
        visible_to_client: false,
      }));
      await supabase.from("case_timeline").insert(events);
      toast({ title: "Status atualizado", description: `${ids.length} demanda(s) atualizada(s) para "${label}".` });
      setSelectedIds(new Set());
      setBulkStatus("");
      queryClient.invalidateQueries({ queryKey: ["irpf-cases"] });
    } catch (e: any) {
      toast({ title: "Erro ao atualizar", description: e?.message ?? "Falha ao alterar status em lote", variant: "destructive" });
    } finally {
      setBulkApplying(false);
    }
  };

  // Reagir a mudanças nos query params (ex.: clicar em outro card vindo do Dashboard)
  useEffect(() => {
    const qStatus = searchParams.get("status");
    const qOwner = searchParams.get("owner");
    const qPriority = searchParams.get("priority");
    if (qStatus !== null) {
      if ((SPECIAL_FILTERS as readonly string[]).includes(qStatus)) {
        setSpecialFilter(qStatus);
        setInternalStatusFilter([]);
      } else {
        setSpecialFilter(null);
        setInternalStatusFilter(toArr(qStatus));
      }
    }
    if (qOwner !== null) setOwnerFilter(toArr(qOwner));
    if (qPriority !== null) setPriorityFilter(toArr(qPriority));
    if (qStatus !== null || qOwner !== null || qPriority !== null) {
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    localStorage.setItem(DEMANDAS_FILTERS_KEY, JSON.stringify({
      search, tagFilter, ownerFilter, internalStatusFilter, clientStatusFilter, priorityFilter, procuracaoFilter, declarationTypeFilter, sortField, sortDir, pageSize, showDeleted,
    }));
  }, [search, tagFilter, ownerFilter, internalStatusFilter, clientStatusFilter, priorityFilter, procuracaoFilter, declarationTypeFilter, sortField, sortDir, pageSize, showDeleted]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, tagFilter, ownerFilter, internalStatusFilter, clientStatusFilter, priorityFilter, procuracaoFilter, declarationTypeFilter, sortField, sortDir, pageSize]);

  const handleSort = (field: "cliente" | "ano" | "ultimo_doc") => {
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
      const matchTag = tagFilter.length === 0 || (c.clients?.tags ?? []).some((t: string) => tagFilter.includes(t));
      const matchOwner = ownerFilter.length === 0 || (c.internal_owner ? ownerFilter.includes(c.internal_owner) : false);
      const matchInternal = internalStatusFilter.length === 0 || internalStatusFilter.includes(c.status);
      const matchClient = clientStatusFilter.length === 0 || clientStatusFilter.includes(c.status);
      const matchPriority = priorityFilter.length === 0 || priorityFilter.includes(c.priority);
      let matchProc = true;
      if (procuracaoFilter !== "all") {
        const procItem = (c.internal_checklist ?? []).find((it: any) => it.label?.toLowerCase().includes("procura"));
        const hasProc = !!procItem?.checked;
        matchProc = procuracaoFilter === "ok" ? hasProc : !hasProc;
      }
      const matchDeclType = declarationTypeFilter.length === 0 || declarationTypeFilter.includes((c as any).declaration_type);
      // Hide dispensadas unless explicitly filtered
      if (c.status === "dispensada" && !internalStatusFilter.includes("dispensada")) return false;
      // Quando filtro por urgentes em aberto, ocultar finalizadas
      if (priorityFilter.length === 1 && priorityFilter[0] === "urgente" && (c.status === "finalizado" || c.status === "dispensada")) return false;
      return matchSearch && matchTag && matchOwner && matchInternal && matchClient && matchPriority && matchProc && matchDeclType;
    });
    if (sortField) {
      list.sort((a, b) => {
        let cmp = 0;
        if (sortField === "cliente") {
          cmp = (a.clients?.full_name ?? "").localeCompare(b.clients?.full_name ?? "", "pt-BR");
        } else if (sortField === "ano") {
          cmp = (a.base_year ?? 0) - (b.base_year ?? 0);
        } else if (sortField === "ultimo_doc") {
          const da = lastUploads?.get(a.id);
          const db = lastUploads?.get(b.id);
          const ta = da ? new Date(da).getTime() : Number.POSITIVE_INFINITY;
          const tb = db ? new Date(db).getTime() : Number.POSITIVE_INFINITY;
          cmp = ta - tb;
        }
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return list;
  }, [cases, search, tagFilter, ownerFilter, internalStatusFilter, clientStatusFilter, priorityFilter, procuracaoFilter, declarationTypeFilter, sortField, sortDir, lastUploads]);

  // Quantos resultados existem considerando apenas a busca (ignorando filtros), para detectar quando filtros estão ocultando matches
  const searchOnlyMatches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return 0;
    return cases.filter((c) => (c.clients?.full_name?.toLowerCase() ?? "").includes(q)).length;
  }, [cases, search]);

  const hasActiveFilters = tagFilter.length > 0 || ownerFilter.length > 0 || internalStatusFilter.length > 0 || procuracaoFilter !== "all" || priorityFilter.length > 0 || clientStatusFilter.length > 0 || declarationTypeFilter.length > 0;

  const totalPages = pageSize === 0 ? 1 : Math.ceil(filtered.length / pageSize);
  const paginatedData = useMemo(() => {
    if (pageSize === 0) return filtered;
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  return (
    <InternalLayout>
      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
        {/* Filters */}
        <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center justify-between">
          {canCreate && <NewCaseDialog />}
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
            <MultiSelectFilter
              options={tags.map((t) => ({ value: t, label: t }))}
              selected={tagFilter}
              onChange={setTagFilter}
              placeholder="Tags"
              width="w-40"
            />
            <MultiSelectFilter
              options={owners.map((o) => ({ value: o, label: o }))}
              selected={ownerFilter}
              onChange={setOwnerFilter}
              placeholder="Responsáveis"
              width="w-44"
            />
            <MultiSelectFilter
              options={Object.entries(STATUS_LABELS).map(([k, v]) => ({ value: k, label: v }))}
              selected={internalStatusFilter}
              onChange={setInternalStatusFilter}
              placeholder="Status"
              width="w-44"
            />
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
            <MultiSelectFilter
              options={[
                { value: "urgente", label: "Urgente" },
                { value: "alta", label: "Alta" },
                { value: "media", label: "Média" },
                { value: "baixa", label: "Baixa" },
              ]}
              selected={priorityFilter}
              onChange={setPriorityFilter}
              placeholder="Prioridades"
              width="w-44"
            />
            <MultiSelectFilter
              options={[
                { value: "simples", label: "Simples" },
                { value: "completa", label: "Completa" },
              ]}
              selected={declarationTypeFilter}
              onChange={setDeclarationTypeFilter}
              placeholder="Tipo de declaração"
              width="w-44"
            />
            {role === "admin" && (
              <Button
                variant={showDeleted ? "default" : "outline"}
                onClick={() => setShowDeleted((v) => !v)}
              >
                {showDeleted ? "Mostrando excluídas" : "Ver excluídas"}
              </Button>
            )}
            {(search || hasActiveFilters) && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearch("");
                  setTagFilter([]);
                  setOwnerFilter([]);
                  setInternalStatusFilter([]);
                  setProcuracaoFilter("all");
                  setPriorityFilter([]);
                  setClientStatusFilter([]);
                  setDeclarationTypeFilter([]);
                }}
              >
                Limpar filtros
              </Button>
            )}
          </div>
        </div>

        {/* Bulk action bar */}
        {canEdit && selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-accent/40 p-3">
            <span className="text-sm font-medium">{selectedIds.size} selecionada{selectedIds.size !== 1 ? "s" : ""}</span>
            <Select value={bulkStatus} onValueChange={setBulkStatus}>
              <SelectTrigger className="w-56 h-9">
                <SelectValue placeholder="Alterar status para..." />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={applyBulkStatus} disabled={!bulkStatus || bulkApplying}>
              {bulkApplying ? "Aplicando..." : "Aplicar"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setSelectedIds(new Set()); setBulkStatus(""); }}>
              <X className="h-4 w-4 mr-1" /> Limpar seleção
            </Button>
          </div>
        )}

        {/* Table */}
        {isLoading ? (
          <Skeleton className="h-96 rounded-xl" />
        ) : (
          <>
            <div className="rounded-xl border bg-card shadow-sm overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {canEdit && (
                      <TableHead className="w-10">
                        <Checkbox
                          checked={paginatedData.length > 0 && paginatedData.every((c) => selectedIds.has(c.id))}
                          onCheckedChange={(v) => {
                            setSelectedIds((prev) => {
                              const next = new Set(prev);
                              if (v) paginatedData.forEach((c) => next.add(c.id));
                              else paginatedData.forEach((c) => next.delete(c.id));
                              return next;
                            });
                          }}
                          aria-label="Selecionar todas"
                        />
                      </TableHead>
                    )}
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
                    <TableHead className="hidden md:table-cell whitespace-nowrap cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("ultimo_doc")}>
                      <span className="flex items-center gap-1">
                        Últ. doc cliente
                        {sortField === "ultimo_doc" ? (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                      </span>
                    </TableHead>
                    {showDeleted && <TableHead className="whitespace-nowrap">Excluída por</TableHead>}
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.map((c) => {
                    const billing = c.billing?.[0];
                    return (
                      <TableRow key={c.id} className={`hover:bg-muted/50 ${billing && billing.billing_status !== "pago" ? "border-l-2 border-l-warning" : ""}`}>
                        {canEdit && (
                          <TableCell className="w-10">
                            <Checkbox
                              checked={selectedIds.has(c.id)}
                              onCheckedChange={() => toggleSelect(c.id)}
                              aria-label="Selecionar demanda"
                            />
                          </TableCell>
                        )}
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
                          <div className="flex flex-col gap-1">
                            <StatusBadge status={c.status} />
                            {c.status === "previa_enviada" && (() => {
                              const fd = Array.isArray(c.final_deliverables) ? c.final_deliverables[0] : (c.final_deliverables as any);
                              if (fd?.preview_status === "ajustes_solicitados") {
                                return (
                                  <span className="inline-flex w-fit items-center rounded-md border border-destructive/30 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">
                                    Ajuste de Prévia
                                  </span>
                                );
                              }
                              const sentAt = fd?.uploaded_at;
                              if (!sentAt) return null;
                              const days = Math.max(0, Math.floor((Date.now() - new Date(sentAt).getTime()) / (1000 * 60 * 60 * 24)));
                              const colorClass = days >= 7 ? "text-destructive" : days >= 3 ? "text-warning" : "text-muted-foreground";
                              const label = days === 0 ? "Enviada hoje" : days === 1 ? "Há 1 dia sem retorno" : `Há ${days} dias sem retorno`;
                              return (
                                <span className={`text-[10px] font-medium ${colorClass}`}>{label}</span>
                              );
                            })()}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <PriorityBadge priority={c.priority} />
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <Badge variant={c.declaration_type === "completa" ? "default" : "outline"} className="text-xs">
                            {c.declaration_type === "completa" ? "Completa" : "Simples"}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell whitespace-nowrap text-xs text-muted-foreground">
                          {(() => {
                            const d = lastUploads?.get(c.id);
                            if (!d) return <span className="opacity-60">—</span>;
                            const days = Math.floor((Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24));
                            const label = days === 0 ? "hoje" : days === 1 ? "há 1 dia" : `há ${days} dias`;
                            return (
                              <div className="flex flex-col">
                                <span className="font-medium text-foreground">{new Date(d).toLocaleDateString("pt-BR")}</span>
                                <span>{label}</span>
                              </div>
                            );
                          })()}
                        </TableCell>
                        {showDeleted && (
                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                            {(c as any).deleted_by_name ? (
                              <div className="flex flex-col">
                                <span className="font-medium text-foreground">{(c as any).deleted_by_name}</span>
                                {(c as any).deleted_at && (
                                  <span>{new Date((c as any).deleted_at).toLocaleString("pt-BR")}</span>
                                )}
                              </div>
                            ) : "—"}
                          </TableCell>
                        )}
                        <TableCell>
                          <CaseActions caseData={c} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={(showDeleted ? 12 : 11) + (canEdit ? 1 : 0)} className="text-center py-10 text-muted-foreground">
                        {cases.length === 0 ? (
                          "Nenhuma demanda cadastrada ainda."
                        ) : search && searchOnlyMatches > 0 && hasActiveFilters ? (
                          <div className="flex flex-col items-center gap-2">
                            <span>
                              {searchOnlyMatches} demanda{searchOnlyMatches !== 1 ? "s" : ""} encontrada{searchOnlyMatches !== 1 ? "s" : ""} para "{search}", mas oculta{searchOnlyMatches !== 1 ? "s" : ""} pelos filtros ativos.
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setTagFilter([]);
                                setOwnerFilter([]);
                                setInternalStatusFilter([]);
                                setProcuracaoFilter("all");
                                setPriorityFilter([]);
                                setClientStatusFilter([]);
                              }}
                            >
                              Limpar filtros e ver resultados
                            </Button>
                          </div>
                        ) : (
                          "Nenhuma demanda encontrada com os filtros aplicados."
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            {/* Pagination */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Exibir</span>
                <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                  <SelectTrigger className="w-28 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 por página</SelectItem>
                    <SelectItem value="50">50 por página</SelectItem>
                    <SelectItem value="100">100 por página</SelectItem>
                    <SelectItem value="0">Todos</SelectItem>
                  </SelectContent>
                </Select>
                <span>— {filtered.length} demanda{filtered.length !== 1 ? "s" : ""}</span>
              </div>
              {pageSize > 0 && totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm px-2">
                    {currentPage} de {totalPages}
                  </span>
                  <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </InternalLayout>
  );
}
