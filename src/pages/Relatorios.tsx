import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, Navigate } from "react-router-dom";
import { format, startOfDay, endOfDay, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart3, Calendar, Download, ExternalLink, Filter, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { InternalLayout } from "@/components/InternalLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

type TimelineRow = {
  id: string;
  case_id: string;
  event_type: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
  visible_to_client: boolean;
};

type CaseLite = {
  id: string;
  internal_owner: string | null;
  clients: { full_name: string | null } | null;
};

type CaseReportInfo = {
  clientName: string;
  owner: string | null;
};

const CLIENT_AUTHORS = new Set(["Cliente"]);
const GENERIC_OFFICE_AUTHORS = new Set(["Escritório", "Equipe", "sistema"]);

export default function Relatorios() {
  const { role, loading: authLoading } = useAuth();
  const today = new Date();
  const [startDate, setStartDate] = useState<string>(format(today, "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState<string>(format(today, "yyyy-MM-dd"));
  const [authorFilter, setAuthorFilter] = useState<string>("__office__");
  const [eventFilter, setEventFilter] = useState<string>("__all__");
  const canView = !authLoading && role === "admin";

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["timeline-report", startDate, endDate],
    enabled: canView,
    queryFn: async () => {
      const from = startOfDay(new Date(startDate + "T00:00:00")).toISOString();
      const to = endOfDay(new Date(endDate + "T00:00:00")).toISOString();
      const { data, error } = await supabase
        .from("case_timeline")
        .select("id, case_id, event_type, description, created_by, created_at, visible_to_client")
        .gte("created_at", from)
        .lte("created_at", to)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as TimelineRow[]) ?? [];
    },
  });

  const caseIds = useMemo(
    () => Array.from(new Set(events.map((e) => e.case_id))),
    [events],
  );

  const { data: casesMap = {} } = useQuery({
    queryKey: ["timeline-report-cases", caseIds],
    enabled: canView && caseIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("irpf_cases")
        .select("id, internal_owner, clients(full_name)")
        .in("id", caseIds);
      const map: Record<string, CaseReportInfo> = {};
      (data as CaseLite[] | null)?.forEach((c) => {
        map[c.id] = {
          clientName: c.clients?.full_name ?? "Cliente sem nome",
          owner: c.internal_owner?.trim() || null,
        };
      });
      return map;
    },
  });

  const { data: allProfiles = [] } = useQuery({
    queryKey: ["report-profiles"],
    enabled: canView,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, email")
        .order("full_name");
      return ((data ?? []) as { full_name: string | null; email: string | null }[])
        .map((p) => (p.full_name?.trim() || p.email?.trim() || ""))
        .filter(Boolean);
    },
  });

  const authors = useMemo(() => {
    const set = new Set<string>();
    allProfiles.forEach((p) => set.add(p));
    events.forEach((e) => {
      const rawAuthor = (e.created_by || "Escritório").trim();
      const a = GENERIC_OFFICE_AUTHORS.has(rawAuthor)
        ? (casesMap[e.case_id]?.owner || rawAuthor)
        : rawAuthor;
      if (!CLIENT_AUTHORS.has(a)) set.add(a);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [events, allProfiles, casesMap]);

  const eventTypes = useMemo(() => {
    const set = new Set<string>();
    events.forEach((e) => set.add(e.event_type));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [events]);

  const filtered = useMemo(() => {
    return events.filter((e) => {
      const rawAuthor = (e.created_by || "Escritório").trim();
      const author = GENERIC_OFFICE_AUTHORS.has(rawAuthor)
        ? (casesMap[e.case_id]?.owner || rawAuthor)
        : rawAuthor;
      if (authorFilter === "__office__") {
        if (CLIENT_AUTHORS.has(author)) return false;
      } else if (authorFilter !== "__all__" && author !== authorFilter) {
        return false;
      }
      if (eventFilter !== "__all__" && e.event_type !== eventFilter) return false;
      return true;
    });
  }, [events, authorFilter, eventFilter, casesMap]);

  // Group by author
  const grouped = useMemo(() => {
    const map = new Map<string, TimelineRow[]>();
    filtered.forEach((e) => {
      const rawAuthor = (e.created_by || "Escritório").trim();
      const author = GENERIC_OFFICE_AUTHORS.has(rawAuthor)
        ? (casesMap[e.case_id]?.owner || rawAuthor)
        : rawAuthor;
      if (!map.has(author)) map.set(author, []);
      map.get(author)!.push(e);
    });
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [filtered, casesMap]);

  const totalActions = filtered.length;
  const uniqueCases = new Set(filtered.map((e) => e.case_id)).size;
  const uniqueAuthors = grouped.length;

  const setPreset = (days: number) => {
    const end = new Date();
    const start = subDays(end, days);
    setStartDate(format(start, "yyyy-MM-dd"));
    setEndDate(format(end, "yyyy-MM-dd"));
  };

  const exportCSV = () => {
    const rows = [
      ["Data/Hora", "Colaborador", "Cliente", "Evento", "Descrição"],
      ...filtered.map((e) => [
        format(new Date(e.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }),
        (e.created_by || "Escritório").trim(),
        casesMap[e.case_id] ?? "—",
        e.event_type,
        (e.description ?? "").replace(/\n/g, " "),
      ]),
    ];
    const csv = rows
      .map((r) =>
        r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";"),
      )
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio_${startDate}_a_${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <InternalLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-primary" />
              Relatório de Atividades
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Veja todas as ações realizadas pelos colaboradores nas demandas, agrupadas por pessoa.
            </p>
          </div>
          <Button variant="outline" onClick={exportCSV} disabled={filtered.length === 0}>
            <Download className="h-4 w-4 mr-1" /> Exportar CSV
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4" /> Filtros
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">De</label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Até</label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Colaborador</label>
                <Select value={authorFilter} onValueChange={setAuthorFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__office__">Apenas equipe (sem cliente)</SelectItem>
                    <SelectItem value="__all__">Todos (inclui cliente)</SelectItem>
                    {authors.map((a) => (
                      <SelectItem key={a} value={a}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Tipo de evento</label>
                <Select value={eventFilter} onValueChange={setEventFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value="__all__">Todos</SelectItem>
                    {eventTypes.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => setPreset(0)}>Hoje</Button>
              <Button size="sm" variant="secondary" onClick={() => setPreset(1)}>Últimas 24h</Button>
              <Button size="sm" variant="secondary" onClick={() => setPreset(7)}>Últimos 7 dias</Button>
              <Button size="sm" variant="secondary" onClick={() => setPreset(30)}>Últimos 30 dias</Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Ações totais</p>
              <p className="text-2xl font-bold">{totalActions}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Demandas trabalhadas</p>
              <p className="text-2xl font-bold">{uniqueCases}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Colaboradores ativos</p>
              <p className="text-2xl font-bold">{uniqueAuthors}</p>
            </CardContent>
          </Card>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : grouped.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              Nenhuma atividade encontrada no período selecionado.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {grouped.map(([author, items]) => {
              const cases = new Set(items.map((i) => i.case_id));
              return (
                <Collapsible key={author} defaultOpen>
                  <Card>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="pb-3 cursor-pointer hover:bg-muted/30 transition-colors">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <Users className="h-4 w-4 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <CardTitle className="text-base truncate">{author}</CardTitle>
                              <CardDescription>
                                {items.length} ação{items.length !== 1 ? "ões" : ""} • {cases.size} demanda{cases.size !== 1 ? "s" : ""}
                              </CardDescription>
                            </div>
                          </div>
                          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform data-[state=open]:rotate-180" />
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm" style={{ minWidth: 900 }}>
                            <thead>
                              <tr className="text-xs text-muted-foreground border-b">
                                <th className="text-left py-2 pr-3 whitespace-nowrap">Data/Hora</th>
                                <th className="text-left py-2 pr-3">Cliente</th>
                                <th className="text-left py-2 pr-3 whitespace-nowrap">Evento</th>
                                <th className="text-left py-2 pr-3">Descrição</th>
                                <th className="text-left py-2 pr-3 whitespace-nowrap">Ação</th>
                              </tr>
                            </thead>
                            <tbody>
                              {items.map((e) => (
                                <tr key={e.id} className="border-b last:border-0 hover:bg-muted/30">
                                  <td className="py-2 pr-3 whitespace-nowrap text-xs text-muted-foreground">
                                    {format(new Date(e.created_at), "dd/MM HH:mm", { locale: ptBR })}
                                  </td>
                                  <td className="py-2 pr-3 max-w-[220px] truncate" title={casesMap[e.case_id]}>
                                    {casesMap[e.case_id] ?? "—"}
                                  </td>
                                  <td className="py-2 pr-3 whitespace-nowrap">
                                    <Badge variant="secondary" className="text-[10px] font-normal">{e.event_type}</Badge>
                                  </td>
                                  <td className="py-2 pr-3 text-xs text-muted-foreground max-w-[420px] truncate" title={e.description ?? ""}>
                                    {e.description ?? "—"}
                                  </td>
                                  <td className="py-2 pr-3 whitespace-nowrap">
                                    <Link to={`/demandas/${e.case_id}`} className="text-primary hover:underline text-xs inline-flex items-center gap-1">
                                      Abrir <ExternalLink className="h-3 w-3" />
                                    </Link>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              );
            })}
          </div>
        )}

        <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
          <Calendar className="h-3 w-3 mt-0.5 shrink-0" />
          Ações registradas antes da atualização aparecem como "Escritório". A partir de agora, o nome do colaborador é gravado automaticamente em cada evento.
        </p>
      </div>
    </InternalLayout>
  );
}
