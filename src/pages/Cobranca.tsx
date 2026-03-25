import { useState, useMemo } from "react";
import {
  Search, DollarSign, TrendingUp, Ban, CheckCircle, Pencil, ArrowUpDown, ArrowUp, ArrowDown,
} from "lucide-react";
import { Link } from "react-router-dom";
import { InternalLayout } from "@/components/InternalLayout";
import { StatCard } from "@/components/StatCard";
import { BillingBadge } from "@/components/StatusBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useCases } from "@/hooks/use-cases";
import { BILLING_LABELS, BILLING_TYPE_LABELS } from "@/lib/types";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { EditBillingDialog } from "@/components/EditBillingDialog";
import type { Database } from "@/integrations/supabase/types";

type BillingStatus = Database["public"]["Enums"]["billing_status"];

export default function Cobranca() {
  const { data: cases = [], isLoading } = useCases();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [billingFilter, setBillingFilter] = useState("all");
  type SortField = "cliente" | "honorario" | "data_pgto" | null;
  type SortDir = "asc" | "desc";
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };
  const [editBilling, setEditBilling] = useState<Database["public"]["Tables"]["billing"]["Row"] | null>(null);
  const [editClientName, setEditClientName] = useState("");

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const extraCases = cases.filter((c) => (c.billing?.[0] as any)?.billing_type !== "incluso_mensalidade");
  const inclusoCases = cases.filter((c) => (c.billing?.[0] as any)?.billing_type === "incluso_mensalidade");
  const totalFees = extraCases.reduce((sum, c) => sum + (c.billing?.[0]?.amount ?? 0), 0);
  const totalPaid = extraCases
    .filter((c) => c.billing?.[0]?.billing_status === "pago")
    .reduce((sum, c) => sum + (c.billing?.[0]?.amount ?? 0), 0);
  const totalPending = totalFees - totalPaid;
  const pendingCount = extraCases.filter((c) => {
    const b = c.billing?.[0];
    return b && b.billing_status !== "pago";
  }).length;

  const filtered = useMemo(() => {
    const list = cases.filter((c) => {
      const q = search.toLowerCase();
      const name = c.clients?.full_name?.toLowerCase() ?? "";
      const matchSearch = !q || name.includes(q);
      const billing = c.billing?.[0];
      const matchBilling = billingFilter === "all" || billing?.billing_status === billingFilter;
      return matchSearch && matchBilling;
    });
    if (sortField) {
      list.sort((a, b) => {
        let cmp = 0;
        if (sortField === "cliente") {
          cmp = (a.clients?.full_name ?? "").localeCompare(b.clients?.full_name ?? "", "pt-BR");
        } else if (sortField === "honorario") {
          cmp = (a.billing?.[0]?.amount ?? 0) - (b.billing?.[0]?.amount ?? 0);
        } else if (sortField === "data_pgto") {
          const da = a.billing?.[0]?.payment_date ?? "";
          const db = b.billing?.[0]?.payment_date ?? "";
          cmp = da.localeCompare(db);
        }
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return list;
  }, [cases, search, billingFilter, sortField, sortDir]);

  const handleQuickStatusChange = async (billingId: string, newStatus: BillingStatus) => {
    const updates: Record<string, unknown> = { billing_status: newStatus };
    if (newStatus === "pago") {
      updates.payment_date = new Date().toISOString().split("T")[0];
    }
    const { error } = await supabase.from("billing").update(updates).eq("id", billingId);
    if (error) {
      toast.error("Erro ao atualizar cobrança.");
    } else {
      toast.success("Status de cobrança atualizado!");
      queryClient.invalidateQueries({ queryKey: ["irpf-cases"] });
    }
  };

  return (
    <InternalLayout>
      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
        {/* Stats */}
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
            <StatCard label="Honorários Previstos" value={fmt(totalFees)} icon={TrendingUp} color="text-primary" />
            <StatCard label="Já Recebido" value={fmt(totalPaid)} icon={DollarSign} color="text-success" />
            <StatCard label="A Receber" value={fmt(totalPending)} icon={Ban} color="text-warning" />
            <StatCard label="Cobranças Pendentes" value={pendingCount} icon={Ban} color="text-destructive" />
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={billingFilter} onValueChange={setBillingFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Status cobrança" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas cobranças</SelectItem>
              {Object.entries(BILLING_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
                  <TableHead className="hidden sm:table-cell">Responsável</TableHead>
                  <TableHead className="hidden sm:table-cell">Tipo</TableHead>
                  <TableHead className="min-w-[90px] cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("honorario")}>
                    <span className="flex items-center gap-1">
                      Honorário
                      {sortField === "honorario" ? (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                    </span>
                  </TableHead>
                  <TableHead className="min-w-[100px]">Status</TableHead>
                  <TableHead className="hidden md:table-cell cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("data_pgto")}>
                    <span className="flex items-center gap-1">
                      Data Pgto
                      {sortField === "data_pgto" ? (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                    </span>
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">Forma</TableHead>
                  <TableHead className="min-w-[90px]">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => {
                  const billing = c.billing?.[0];
                  const bil = billing as any;
                  const isIncluso = bil?.billing_type === "incluso_mensalidade";
                  const isPending = billing && billing.billing_status !== "pago" && !isIncluso;
                  return (
                    <TableRow key={c.id} className={isPending ? "border-l-2 border-l-warning" : ""}>
                      <TableCell className="font-medium">
                        <Link to={`/demandas/${c.id}`} className="hover:text-primary transition-colors">
                          {c.clients?.full_name}
                        </Link>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{c.internal_owner ?? "—"}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isIncluso ? "bg-success/10 text-success" : "bg-primary/10 text-primary"}`}>
                          {isIncluso ? "Mensalidade" : "Extra"}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm font-medium">{billing ? fmt(billing.amount) : "—"}</TableCell>
                      <TableCell>
                        {isIncluso ? (
                          <span className="text-xs text-success flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" /> Incluso
                          </span>
                        ) : billing ? (
                          <BillingBadge status={billing.billing_status} billingType={billing.billing_type} />
                        ) : (
                          <span className="text-xs text-muted-foreground">Sem cobrança</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {billing?.payment_date ? new Date(billing.payment_date).toLocaleDateString("pt-BR") : "—"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {billing?.payment_method ?? "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {!isIncluso && billing && billing.billing_status !== "pago" && (
                            <>
                              {billing.billing_status === "nao_cobrado" && (
                                <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => handleQuickStatusChange(billing.id, "cobrado")}>
                                  Cobrar
                                </Button>
                              )}
                              <Button variant="default" size="sm" className="text-xs h-7" onClick={() => handleQuickStatusChange(billing.id, "pago")}>
                                <CheckCircle className="h-3 w-3 mr-1" /> Pago
                              </Button>
                            </>
                          )}
                          {!isIncluso && billing?.billing_status === "pago" && (
                            <span className="text-xs text-success flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" /> Quitado
                            </span>
                          )}
                          {!isIncluso && billing && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => {
                                setEditBilling(billing);
                                setEditClientName(c.clients?.full_name ?? "");
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-10 text-muted-foreground">
                      Nenhuma cobrança encontrada.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        <EditBillingDialog
          open={!!editBilling}
          onOpenChange={(open) => { if (!open) setEditBilling(null); }}
          billing={editBilling}
          clientName={editClientName}
        />
      </div>
    </InternalLayout>
  );
}
