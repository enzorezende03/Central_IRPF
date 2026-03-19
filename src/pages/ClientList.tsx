import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Search, Filter, Eye, Plus } from "lucide-react";
import { InternalLayout } from "@/components/InternalLayout";
import { mockDemands } from "@/lib/mock-data";
import { StatusBadge, BillingBadge, PriorityBadge } from "@/components/StatusBadge";
import { DemandStatus, BillingStatus, STATUS_LABELS, BILLING_LABELS } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function ClientList() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [billingFilter, setBillingFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    return mockDemands.filter(d => {
      const q = search.toLowerCase();
      const matchSearch = !q || d.client?.name.toLowerCase().includes(q) || d.client?.cpf.includes(q) || d.responsible.toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || d.status === statusFilter;
      const matchBilling = billingFilter === "all" || d.billing_status === billingFilter;
      return matchSearch && matchStatus && matchBilling;
    });
  }, [search, statusFilter, billingFilter]);

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <InternalLayout>
      <div className="p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Clientes IRPF</h1>
            <p className="text-sm text-muted-foreground">{mockDemands.length} clientes cadastrados</p>
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Novo Cliente
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, CPF ou responsável..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={billingFilter} onValueChange={setBillingFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Cobrança" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas cobranças</SelectItem>
              {Object.entries(BILLING_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead className="hidden md:table-cell">CPF</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">Prioridade</TableHead>
                <TableHead className="hidden lg:table-cell">Cobrança</TableHead>
                <TableHead className="hidden lg:table-cell text-right">Honorário</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(d => (
                <TableRow key={d.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">{d.client?.name}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground text-sm">{d.client?.cpf}</TableCell>
                  <TableCell className="text-sm">{d.responsible}</TableCell>
                  <TableCell><StatusBadge status={d.status} /></TableCell>
                  <TableCell className="hidden lg:table-cell"><PriorityBadge priority={d.priority} /></TableCell>
                  <TableCell className="hidden lg:table-cell"><BillingBadge status={d.billing_status} /></TableCell>
                  <TableCell className="hidden lg:table-cell text-right text-sm font-medium">{fmt(d.fee_amount)}</TableCell>
                  <TableCell>
                    <Link to={`/clients/${d.id}`}>
                      <Button variant="ghost" size="icon">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                    Nenhum cliente encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </InternalLayout>
  );
}
