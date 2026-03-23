import { useState, useMemo } from "react";
import { Search, Users, Mail, Phone, Trash2 } from "lucide-react";
import { formatCPF, formatPhone } from "@/lib/format-utils";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { InternalLayout } from "@/components/InternalLayout";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { NewClientDialog } from "@/components/NewClientDialog";
import { ImportClientsDialog } from "@/components/ImportClientsDialog";
import { EditClientDialog } from "@/components/EditClientDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function Clientes() {
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  const { role } = useAuth();

  // Fetch all clients directly
  const { data: allClients = [], isLoading: loadingClients } = useQuery({
    queryKey: ["all-clients"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("*").order("full_name");
      return data ?? [];
    },
  });

  // Fetch case counts per client
  const { data: caseCounts = {} } = useQuery({
    queryKey: ["client-case-counts"],
    queryFn: async () => {
      const { data } = await supabase.from("irpf_cases").select("client_id");
      const counts: Record<string, number> = {};
      (data ?? []).forEach((c) => {
        counts[c.client_id] = (counts[c.client_id] || 0) + 1;
      });
      return counts;
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("clients").update({ is_active } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-clients"] });
    },
    onError: () => {
      toast.error("Erro ao atualizar status do cliente.");
    },
  });

  const deleteClient = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-clients"] });
      queryClient.invalidateQueries({ queryKey: ["client-case-counts"] });
      toast.success("Cliente excluído com sucesso.");
    },
    onError: () => {
      toast.error("Erro ao excluir cliente. Verifique se não há demandas vinculadas.");
    },
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allClients.filter((client) => {
      const name = client.full_name.toLowerCase();
      const cpf = client.cpf;
      return !q || name.includes(q) || cpf.includes(q);
    });
  }, [allClients, search]);

  return (
    <InternalLayout>
      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome ou CPF..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
            <Badge variant="secondary" className="shrink-0">
              <Users className="h-3 w-3 mr-1" /> {allClients.length} clientes
            </Badge>
            <ImportClientsDialog />
            <NewClientDialog onCreated={() => queryClient.invalidateQueries({ queryKey: ["all-clients"] })} />
          </div>
        </div>

        {loadingClients ? (
          <Skeleton className="h-96 rounded-xl" />
        ) : (
          <div className="rounded-xl border bg-card shadow-sm overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[120px]">Nome</TableHead>
                  <TableHead className="min-w-[110px]">CPF</TableHead>
                  <TableHead className="hidden md:table-cell">Telefone</TableHead>
                  <TableHead className="hidden md:table-cell">E-mail</TableHead>
                  <TableHead>Demandas</TableHead>
                  <TableHead className="hidden sm:table-cell">Tag</TableHead>
                  <TableHead className="hidden lg:table-cell">Cadastro</TableHead>
                  <TableHead className="text-center">Ativo</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((client) => {
                  const isActive = (client as any).is_active !== false;
                  const caseCount = caseCounts[client.id] || 0;
                  return (
                    <TableRow key={client.id} className={`hover:bg-muted/50 ${!isActive ? "opacity-50" : ""}`}>
                      <TableCell className="font-medium">{client.full_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground font-mono">{formatCPF(client.cpf)}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm">
                        {client.phone ? (
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Phone className="h-3 w-3" /> {formatPhone(client.phone)}
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
                      <TableCell className="hidden sm:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {(client.tags ?? []).map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {new Date(client.created_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={isActive}
                          onCheckedChange={(checked) => toggleActive.mutate({ id: client.id, is_active: checked })}
                        />
                      </TableCell>
                      <TableCell className="flex items-center gap-1">
                        <EditClientDialog client={client as any} />
                        {role === "admin" && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir cliente</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir <strong>{client.full_name}</strong>? Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() => deleteClient.mutate(client.id)}
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
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
        )}
      </div>
    </InternalLayout>
  );
}
