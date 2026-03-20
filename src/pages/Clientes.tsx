import { useState, useMemo } from "react";
import { Search, Users, Mail, Phone } from "lucide-react";
import { Link } from "react-router-dom";
import { InternalLayout } from "@/components/InternalLayout";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useCases } from "@/hooks/use-cases";
import { NewClientDialog } from "@/components/NewClientDialog";
import { ImportClientsDialog } from "@/components/ImportClientsDialog";

export default function Clientes() {
  const { data: cases = [], isLoading } = useCases();
  const [search, setSearch] = useState("");

  // Deduplicate clients
  const clients = useMemo(() => {
    const map = new Map<string, { client: NonNullable<typeof cases[0]["clients"]>; caseCount: number; latestStatus: string }>();
    cases.forEach((c) => {
      if (!c.clients) return;
      const existing = map.get(c.clients.id);
      if (existing) {
        existing.caseCount++;
      } else {
        map.set(c.clients.id, { client: c.clients, caseCount: 1, latestStatus: c.status });
      }
    });
    return Array.from(map.values());
  }, [cases]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return clients.filter(({ client }) => {
      const name = client.full_name.toLowerCase();
      const cpf = client.cpf;
      return !q || name.includes(q) || cpf.includes(q);
    });
  }, [clients, search]);

  return (
    <InternalLayout>
      <div className="p-6 space-y-6">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome ou CPF..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="secondary">
              <Users className="h-3 w-3 mr-1" /> {clients.length} clientes
            </Badge>
            <NewClientDialog />
          </div>
        </div>

        {isLoading ? (
          <Skeleton className="h-96 rounded-xl" />
        ) : (
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome Completo</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead className="hidden md:table-cell">Telefone</TableHead>
                  <TableHead className="hidden md:table-cell">E-mail</TableHead>
                  <TableHead>Demandas</TableHead>
                  <TableHead className="hidden lg:table-cell">Cadastro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(({ client, caseCount }) => (
                  <TableRow key={client.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">{client.full_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground font-mono">{client.cpf}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm">
                      {client.phone ? (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Phone className="h-3 w-3" /> {client.phone}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm">
                      {client.email ? (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Mail className="h-3 w-3" /> {client.email}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{caseCount} demanda(s)</Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {new Date(client.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                      Nenhum cliente encontrado.
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
