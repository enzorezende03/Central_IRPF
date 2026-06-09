import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Landmark, CheckCircle2, Clock, RotateCw, HelpCircle, CalendarRange } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
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
import { cn } from "@/lib/utils";
import { formatCPF } from "@/lib/format-utils";
import { useCases } from "@/hooks/use-cases";
import { useAuth } from "@/hooks/use-auth";
import { useSeasons } from "@/hooks/use-irpf-goals";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  RECEITA_SITUACOES, RECEITA_SITUACAO_MAP,
  MALHA_STATUS_OPTIONS, MALHA_STATUS_LABEL,
  type ReceitaSituacao, type MalhaStatus,
} from "@/lib/receita-situacao";

const FILTERS_KEY = "pos-entrega-filters";

function loadSaved() {
  try { return JSON.parse(localStorage.getItem(FILTERS_KEY) || "{}"); } catch { return {}; }
}

export default function PosEntrega() {
  const { role } = useAuth() as any;
  const allowed = role === "admin" || role === "operacional";

  const saved = useMemo(() => loadSaved(), []);
  const url = new URL(window.location.href);
  const initialSituacao = url.searchParams.get("situacao");

  const { data: cases = [], isLoading } = useCases();
  const { data: seasons = [] } = useSeasons();
  const qc = useQueryClient();

  const activeSeasonYear = useMemo(() => {
    if (!seasons.length) return null;
    const now = new Date().getFullYear();
    return seasons.find((s) => s.season_year === now)?.season_year
      ?? seasons[0].season_year;
  }, [seasons]);

  const [situacaoFilter, setSituacaoFilter] = useState<string[]>(
    initialSituacao ? [initialSituacao] : (saved.situacaoFilter ?? []),
  );
  const [ownerFilter, setOwnerFilter] = useState<string[]>(saved.ownerFilter ?? []);
  const [unitFilter, setUnitFilter] = useState<"all" | "2mc" | "2ms">(saved.unitFilter ?? "all");
  const [dateFrom, setDateFrom] = useState<string>(saved.dateFrom ?? "");
  const [dateTo, setDateTo] = useState<string>(saved.dateTo ?? "");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(FILTERS_KEY, JSON.stringify({
      situacaoFilter, ownerFilter, dateFrom, dateTo,
    }));
  }, [situacaoFilter, ownerFilter, dateFrom, dateTo]);

  if (!allowed) return <Navigate to="/" replace />;

  // Base: temporada ativa + status finalizado/retificada
  // Convenção: season_year (ano da entrega) = base_year (ano-calendário) + 1
  const baseCases = useMemo(() => {
    return cases.filter((c) => {
      const okStatus = c.status === "finalizado" || (c.status as any) === "retificada";
      const okSeason = !activeSeasonYear
        || c.base_year === activeSeasonYear
        || c.base_year === activeSeasonYear - 1;
      return okStatus && okSeason;
    });
  }, [cases, activeSeasonYear]);

  const owners = useMemo(() => {
    const set = new Set<string>();
    baseCases.forEach((c) => c.internal_owner && set.add(c.internal_owner));
    return Array.from(set).sort();
  }, [baseCases]);

  // Filtros sem situação (para os cards)
  const filteredNoSituacao = useMemo(() => {
    return baseCases.filter((c) => {
      const okOwner = ownerFilter.length === 0 || (c.internal_owner && ownerFilter.includes(c.internal_owner));
      const completed = c.completed_at ? new Date(c.completed_at) : null;
      const okFrom = !dateFrom || (completed && completed >= new Date(dateFrom));
      const okTo = !dateTo || (completed && completed <= new Date(dateTo + "T23:59:59"));
      return okOwner && okFrom && okTo;
    });
  }, [baseCases, ownerFilter, dateFrom, dateTo]);

  // Aplica filtro de situação por cima
  const filtered = useMemo(() => {
    let list = filteredNoSituacao;
    if (situacaoFilter.length > 0) {
      list = list.filter((c: any) => {
        const sit = c.receita_situacao ?? "__null__";
        return situacaoFilter.includes(sit);
      });
    }
    return [...list].sort((a, b) => {
      const ta = a.completed_at ? new Date(a.completed_at).getTime() : Number.POSITIVE_INFINITY;
      const tb = b.completed_at ? new Date(b.completed_at).getTime() : Number.POSITIVE_INFINITY;
      return ta - tb; // mais antigos primeiro
    });
  }, [filteredNoSituacao, situacaoFilter]);

  // Contagens dos cards (usa filteredNoSituacao)
  const counts = useMemo(() => {
    const c = { aguardando: 0, processadas: 0, em_malha: 0, regularizadas: 0, nao_informado: 0 };
    for (const x of filteredNoSituacao as any[]) {
      const s = x.receita_situacao as ReceitaSituacao | null;
      if (!s) c.nao_informado++;
      else if (s === "aguardando") c.aguardando++;
      else if (s === "processada_restituicao" || s === "processada_a_pagar" || s === "processada_sem_movimento") c.processadas++;
      else if (s === "em_malha") c.em_malha++;
      else if (s === "malha_regularizada") c.regularizadas++;
    }
    return c;
  }, [filteredNoSituacao]);

  const toggleSituacaoCard = (values: string[]) => {
    // Se já igual, limpa. Senão aplica.
    const eq = situacaoFilter.length === values.length && values.every((v) => situacaoFilter.includes(v));
    setSituacaoFilter(eq ? [] : values);
  };

  const updateSituacao = async (caseId: string, nova: ReceitaSituacao) => {
    setUpdatingId(caseId);
    const { data: { user } } = await supabase.auth.getUser();
    const payload: any = {
      receita_situacao: nova,
      receita_situacao_em: new Date().toISOString(),
      receita_situacao_por: user?.id ?? null,
    };
    // Trigger no banco limpa malha_motivo/status quando situacao != em_malha
    const { error } = await supabase.from("irpf_cases").update(payload).eq("id", caseId);
    setUpdatingId(null);
    if (error) {
      toast.error("Erro ao atualizar situação");
      return;
    }
    toast.success("Situação atualizada");
    qc.invalidateQueries({ queryKey: ["irpf-cases"] });
  };

  const updateMalhaStatus = async (caseId: string, status: MalhaStatus) => {
    setUpdatingId(caseId);
    const { error } = await supabase.from("irpf_cases")
      .update({ malha_status: status, updated_at: new Date().toISOString() })
      .eq("id", caseId);
    setUpdatingId(null);
    if (error) {
      toast.error("Erro ao atualizar status da análise");
      return;
    }
    toast.success("Status atualizado");
    qc.invalidateQueries({ queryKey: ["irpf-cases"] });
  };

  const hasActiveFilters = situacaoFilter.length > 0 || ownerFilter.length > 0 || !!dateFrom || !!dateTo;

  return (
    <InternalLayout>
      <TooltipProvider>
      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
        <div className="flex items-center gap-2">
          <Landmark className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold">Pós-Entrega · Acompanhamento Receita Federal</h1>
          {activeSeasonYear && (
            <span className="text-xs text-muted-foreground ml-1">Temporada {activeSeasonYear}</span>
          )}
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-2 items-center">
          <MultiSelectFilter
            options={[
              ...RECEITA_SITUACOES.map((s) => ({ value: s.value, label: `${s.icon} ${s.label}` })),
              { value: "__null__", label: "Não informado" },
            ]}
            selected={situacaoFilter}
            onChange={setSituacaoFilter}
            placeholder="Situação Receita"
            width="w-56"
          />
          <MultiSelectFilter
            options={owners.map((o) => ({ value: o, label: o }))}
            selected={ownerFilter}
            onChange={setOwnerFilter}
            placeholder="Responsáveis"
            width="w-48"
          />
          <div className="flex items-center gap-2">
            <CalendarRange className="h-4 w-4 text-muted-foreground" />
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-40 h-10"
              aria-label="Entregue a partir de"
            />
            <span className="text-xs text-muted-foreground">até</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-40 h-10"
              aria-label="Entregue até"
            />
          </div>
          {hasActiveFilters && (
            <Button
              variant="outline"
              onClick={() => {
                setSituacaoFilter([]);
                setOwnerFilter([]);
                setDateFrom("");
                setDateTo("");
              }}
            >
              Limpar filtros
            </Button>
          )}
        </div>

        {/* Cards */}
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-4">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-4">
            <StatCard
              label="Aguardando"
              value={counts.aguardando}
              icon={Clock}
              color="text-slate-500"
              onClick={() => toggleSituacaoCard(["aguardando"])}
              active={situacaoFilter.length === 1 && situacaoFilter[0] === "aguardando"}
            />
            <StatCard
              label="Processadas"
              value={counts.processadas}
              icon={CheckCircle2}
              color="text-emerald-600"
              onClick={() => toggleSituacaoCard(["processada_restituicao", "processada_a_pagar", "processada_sem_movimento"])}
              active={situacaoFilter.length === 3 && ["processada_restituicao","processada_a_pagar","processada_sem_movimento"].every(v => situacaoFilter.includes(v))}
            />
            <StatCard
              label="Em análise"
              value={counts.em_malha}
              icon={Landmark}
              color="text-amber-600"
              onClick={() => toggleSituacaoCard(["em_malha"])}
              active={situacaoFilter.length === 1 && situacaoFilter[0] === "em_malha"}
            />
            <StatCard
              label="Regularizadas"
              value={counts.regularizadas}
              icon={RotateCw}
              color="text-blue-600"
              onClick={() => toggleSituacaoCard(["malha_regularizada"])}
              active={situacaoFilter.length === 1 && situacaoFilter[0] === "malha_regularizada"}
            />
            <StatCard
              label="Não informado"
              value={counts.nao_informado}
              icon={HelpCircle}
              color="text-slate-400"
              onClick={() => toggleSituacaoCard(["__null__"])}
              active={situacaoFilter.length === 1 && situacaoFilter[0] === "__null__"}
            />
          </div>
        )}

        {/* Tabela */}
        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead className="whitespace-nowrap">Entregue em</TableHead>
                <TableHead className="w-[260px]">Situação Receita</TableHead>
                <TableHead className="w-[240px]">Status da análise</TableHead>
                <TableHead className="whitespace-nowrap">Atualizado em</TableHead>
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
                    Nenhuma declaração encontrada com os filtros atuais.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((c: any) => {
                  const sit = c.receita_situacao as ReceitaSituacao | null;
                  const isMalha = sit === "em_malha";
                  const meta = sit ? RECEITA_SITUACAO_MAP[sit] : null;
                  return (
                    <TableRow key={c.id} className={cn(isMalha && "bg-amber-50 hover:bg-amber-100/70")}>
                      <TableCell className="max-w-[220px]">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="block truncate font-medium">{c.clients?.full_name ?? "—"}</span>
                          </TooltipTrigger>
                          <TooltipContent>{c.clients?.full_name ?? "—"}</TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-xs">
                        {c.clients?.cpf ? formatCPF(c.clients.cpf) : "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{c.internal_owner ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {c.completed_at ? format(new Date(c.completed_at), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                      </TableCell>
                      <TableCell>
                        {sit ? (
                          <Select
                            value={sit}
                            disabled={updatingId === c.id}
                            onValueChange={(v) => updateSituacao(c.id, v as ReceitaSituacao)}
                          >
                            <SelectTrigger className={cn("h-8 text-xs", meta?.badgeClass)}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {RECEITA_SITUACOES.map((s) => (
                                <SelectItem key={s.value} value={s.value}>
                                  <span className="inline-flex items-center gap-2">
                                    <span>{s.icon}</span><span>{s.label}</span>
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Select
                            value=""
                            disabled={updatingId === c.id}
                            onValueChange={(v) => updateSituacao(c.id, v as ReceitaSituacao)}
                          >
                            <SelectTrigger className="h-8 text-xs border-dashed text-muted-foreground">
                              <SelectValue placeholder="Informar" />
                            </SelectTrigger>
                            <SelectContent>
                              {RECEITA_SITUACOES.map((s) => (
                                <SelectItem key={s.value} value={s.value}>
                                  <span className="inline-flex items-center gap-2">
                                    <span>{s.icon}</span><span>{s.label}</span>
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell>
                        {isMalha ? (
                          <Select
                            value={c.malha_status ?? ""}
                            disabled={updatingId === c.id}
                            onValueChange={(v) => updateMalhaStatus(c.id, v as MalhaStatus)}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Selecionar status..." />
                            </SelectTrigger>
                            <SelectContent>
                              {MALHA_STATUS_OPTIONS.map((s) => (
                                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {c.receita_situacao_em
                          ? format(new Date(c.receita_situacao_em), "dd/MM/yyyy HH:mm", { locale: ptBR })
                          : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <p className="text-xs text-muted-foreground">
          Mostrando {filtered.length} de {baseCases.length} declarações da temporada ativa.
        </p>
      </div>
      </TooltipProvider>
    </InternalLayout>
  );
}
