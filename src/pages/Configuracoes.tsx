import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { InternalLayout } from "@/components/InternalLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shield, Bell, Building2, CreditCard, UserPlus, Trash2, Pencil, Loader2, Upload, ImageIcon, FileText, Plus, GripVertical, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Checkbox } from "@/components/ui/checkbox";

const PERMISSIONS_BY_ROLE: Record<string, { key: string; label: string }[]> = {
  operacional: [
    { key: "acesso_demandas", label: "Acesso a Demandas" },
    { key: "acesso_configuracao", label: "Acesso a Configuração" },
  ],
  financeiro: [
    { key: "acesso_cobranca", label: "Acesso a Cobrança" },
    { key: "acesso_configuracao", label: "Acesso a Configuração" },
  ],
};

const ALL_PERMISSIONS = [
  { key: "acesso_demandas", label: "Acesso a Demandas" },
  { key: "acesso_cobranca", label: "Acesso a Cobrança" },
  { key: "acesso_configuracao", label: "Acesso a Configuração" },
] as const;

interface UserRow {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
  role: string;
  permissions: string[];
}

interface OfficeData {
  id: string;
  name: string;
  cnpj: string;
  address: string;
  phone: string;
  email: string;
  logo_url: string | null;
}

export default function Configuracoes() {
  const { role, user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = role === "admin";

  const { data: users = [], isLoading } = useQuery<UserRow[]>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data: profiles } = await supabase
        .from("profiles" as any)
        .select("id, full_name, email, created_at");
      if (!profiles) return [];

      const { data: roles } = await supabase
        .from("user_roles" as any)
        .select("user_id, role");

      const { data: perms } = await supabase
        .from("user_permissions" as any)
        .select("user_id, permission");

      const roleMap = new Map<string, string>();
      (roles ?? []).forEach((r: any) => roleMap.set(r.user_id, r.role));

      const permMap = new Map<string, string[]>();
      (perms ?? []).forEach((p: any) => {
        const arr = permMap.get(p.user_id) ?? [];
        arr.push(p.permission);
        permMap.set(p.user_id, arr);
      });

      return (profiles as any[]).map((p) => ({
        ...p,
        role: roleMap.get(p.id) ?? "sem_perfil",
        permissions: permMap.get(p.id) ?? [],
      }));
    },
    enabled: isAdmin,
  });

  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: { action: "delete", user_id: userId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast.success("Usuário excluído com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (err: any) => toast.error(err.message || "Erro ao excluir usuário."),
  });

  return (
    <InternalLayout>
      <div className="p-6 space-y-6 max-w-4xl">
        <div>
          <p className="text-sm text-muted-foreground">Gerencie as configurações do sistema</p>
        </div>

        {isAdmin && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  Usuários do Sistema
                </CardTitle>
                <CardDescription>Gerencie os administradores e operadores</CardDescription>
              </div>
              <InviteUserDialog />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Perfil</TableHead>
                      <TableHead>Cadastro</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                        <TableCell>
                          <Badge variant={u.role === "admin" ? "default" : u.role === "operacional" ? "secondary" : "outline"} className="text-xs">
                            {u.role === "admin" ? "Administrador" : u.role === "operacional" ? "Operacional" : "Sem perfil"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(u.created_at).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <EditUserDialog user={u} />
                            {u.id !== user?.id && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Excluir">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Excluir usuário</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Tem certeza que deseja excluir <strong>{u.full_name || u.email}</strong>? Esta ação não pode ser desfeita.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteMutation.mutate(u.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Excluir
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {users.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                          Nenhum usuário cadastrado.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        <OfficeSettingsCard />

        <DocumentChecklistCard />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />
                Notificações
              </CardTitle>
              <CardDescription>Alertas de novas entregas e pendências</CardDescription>
            </CardHeader>
            <CardContent>
              <NotificationsPanel />
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary" />
                Integração de Pagamento
              </CardTitle>
              <CardDescription>Link de pagamento e cobranças automáticas</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant="secondary" className="text-xs">Em breve</Badge>
            </CardContent>
          </Card>
        </div>
      </div>
    </InternalLayout>
  );
}

function OfficeSettingsCard() {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: office, isLoading } = useQuery<OfficeData | null>({
    queryKey: ["office-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("office_settings" as any)
        .select("*")
        .limit(1)
        .single();
      return (data as any) as OfficeData | null;
    },
  });

  const [form, setForm] = useState({
    name: "", cnpj: "", cep: "", address: "", number: "", complement: "", neighborhood: "", city: "", state: "", phone: "", email: "",
  });
  const [cepLoading, setCepLoading] = useState(false);

  useEffect(() => {
    if (office) {
      setForm({
        name: (office as any).name || "",
        cnpj: (office as any).cnpj || "",
        cep: (office as any).cep || "",
        address: (office as any).address || "",
        number: (office as any).number || "",
        complement: (office as any).complement || "",
        neighborhood: (office as any).neighborhood || "",
        city: (office as any).city || "",
        state: (office as any).state || "",
        phone: (office as any).phone || "",
        email: (office as any).email || "",
      });
    }
  }, [office]);

  const fetchCep = async (cep: string) => {
    const clean = cep.replace(/\D/g, "");
    if (clean.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setForm((p) => ({
          ...p,
          address: data.logradouro || "",
          neighborhood: data.bairro || "",
          city: data.localidade || "",
          state: data.uf || "",
          complement: data.complemento || p.complement,
        }));
      } else {
        toast.error("CEP não encontrado.");
      }
    } catch {
      toast.error("Erro ao buscar CEP.");
    } finally {
      setCepLoading(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!office?.id) return;
      const { error } = await supabase
        .from("office_settings" as any)
        .update({
          name: form.name.trim(),
          cnpj: form.cnpj.trim(),
          cep: form.cep.trim(),
          address: form.address.trim(),
          number: form.number.trim(),
          complement: form.complement.trim(),
          neighborhood: form.neighborhood.trim(),
          city: form.city.trim(),
          state: form.state.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
        })
        .eq("id", office.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dados do escritório salvos!");
      queryClient.invalidateQueries({ queryKey: ["office-settings"] });
    },
    onError: () => toast.error("Erro ao salvar dados."),
  });

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !office?.id) return;

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `logo.${ext}`;

      // Remove old file if exists
      await supabase.storage.from("office-assets").remove([path]);

      const { error: uploadErr } = await supabase.storage
        .from("office-assets")
        .upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage
        .from("office-assets")
        .getPublicUrl(path);

      const logoUrl = urlData.publicUrl + "?t=" + Date.now();

      await supabase
        .from("office_settings" as any)
        .update({ logo_url: logoUrl })
        .eq("id", office.id);

      queryClient.invalidateQueries({ queryKey: ["office-settings"] });
      toast.success("Logo atualizada!");
    } catch {
      toast.error("Erro ao enviar logo.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const set = (field: string, value: string) => setForm((p) => ({ ...p, [field]: value }));

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          Dados do Escritório
        </CardTitle>
        <CardDescription>Nome, CNPJ, endereço, contato e logo</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Logo */}
        <div className="flex items-center gap-5">
          <div
            className="h-20 w-20 rounded-xl border-2 border-dashed flex items-center justify-center overflow-hidden bg-muted/30 cursor-pointer hover:border-primary/50 transition-colors shrink-0"
            onClick={() => fileRef.current?.click()}
          >
            {office?.logo_url ? (
              <img src={office.logo_url} alt="Logo" className="h-full w-full object-contain" />
            ) : (
              <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
            )}
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">Logo do Escritório</p>
            <p className="text-xs text-muted-foreground">Clique na área ao lado ou use o botão para enviar</p>
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
              {uploading ? "Enviando..." : "Enviar Logo"}
            </Button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
          </div>
        </div>

        {/* Form fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="of-name">Nome do Escritório</Label>
            <Input id="of-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="2M Contabilidade" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="of-cnpj">CNPJ</Label>
            <Input id="of-cnpj" value={form.cnpj} onChange={(e) => set("cnpj", e.target.value)} placeholder="00.000.000/0001-00" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="of-cep">CEP</Label>
            <div className="relative">
              <Input
                id="of-cep"
                value={form.cep}
                onChange={(e) => {
                  set("cep", e.target.value);
                  const clean = e.target.value.replace(/\D/g, "");
                  if (clean.length === 8) fetchCep(clean);
                }}
                placeholder="00000-000"
              />
              {cepLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="of-addr">Logradouro</Label>
            <Input id="of-addr" value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Rua, Avenida..." />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="of-number">Número</Label>
            <Input id="of-number" value={form.number} onChange={(e) => set("number", e.target.value)} placeholder="123" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="of-comp">Complemento</Label>
            <Input id="of-comp" value={form.complement} onChange={(e) => set("complement", e.target.value)} placeholder="Sala 1" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="of-neigh">Bairro</Label>
            <Input id="of-neigh" value={form.neighborhood} onChange={(e) => set("neighborhood", e.target.value)} placeholder="Centro" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="of-city">Cidade</Label>
            <Input id="of-city" value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="São Paulo" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="of-state">Estado</Label>
            <Input id="of-state" value={form.state} onChange={(e) => set("state", e.target.value)} placeholder="SP" maxLength={2} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="of-phone">Telefone</Label>
            <Input id="of-phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="(11) 3000-0000" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="of-email">E-mail</Label>
            <Input id="of-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="contato@escritorio.com" />
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Salvando..." : "Salvar Dados"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function EditUserDialog({ user: u }: { user: UserRow }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState(u.full_name || "");
  const [role, setRole] = useState(u.role);
  const [permissions, setPermissions] = useState<string[]>(u.permissions);

  const togglePerm = (key: string) => {
    setPermissions((prev) => prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]);
  };

  const isAdminRole = role === "admin";

  const mutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: {
          action: "update",
          user_id: u.id,
          full_name: fullName.trim(),
          role,
          permissions: isAdminRole ? ALL_PERMISSIONS.map((p) => p.key) : permissions,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast.success("Usuário atualizado!");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setOpen(false);
    },
    onError: (err: any) => toast.error(err.message || "Erro ao atualizar."),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) { setFullName(u.full_name || ""); setRole(u.role); setPermissions(u.permissions); } }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Usuário</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>E-mail</Label>
            <Input value={u.email} disabled className="opacity-60" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">Nome Completo</Label>
            <Input id="edit-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Perfil de Acesso</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Administrador — Acesso total</SelectItem>
                <SelectItem value="operacional">Operacional — Acesso a Demandas</SelectItem>
                <SelectItem value="financeiro">Financeiro — Acesso a Cobrança</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {!isAdminRole && (
            <div className="space-y-2">
              <Label>Permissões</Label>
              <div className="space-y-2 rounded-lg border p-3">
                {(PERMISSIONS_BY_ROLE[role] ?? ALL_PERMISSIONS).map((p) => (
                  <div key={p.key} className="flex items-center gap-2">
                    <Checkbox
                      id={`edit-perm-${p.key}`}
                      checked={permissions.includes(p.key)}
                      onCheckedChange={() => togglePerm(p.key)}
                    />
                    <label htmlFor={`edit-perm-${p.key}`} className="text-sm cursor-pointer">{p.label}</label>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Selecione as áreas que este usuário pode acessar.</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InviteUserDialog() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("admin");
  const [permissions, setPermissions] = useState<string[]>(["acesso_demandas"]);

  const togglePerm = (key: string) => {
    setPermissions((prev) => prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]);
  };

  const isAdminRole = role === "admin";

  const mutation = useMutation({
    mutationFn: async () => {
      if (!email.trim() || !password.trim()) throw new Error("E-mail e senha são obrigatórios.");
      if (password.length < 6) throw new Error("A senha deve ter pelo menos 6 caracteres.");

      const { data, error } = await supabase.functions.invoke("create-user", {
        body: {
          action: "create",
          email: email.trim(),
          password,
          full_name: fullName.trim(),
          role,
          permissions: isAdminRole ? ALL_PERMISSIONS.map((p) => p.key) : permissions,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("Usuário convidado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setOpen(false);
      setEmail(""); setPassword(""); setFullName(""); setRole("admin"); setPermissions(["acesso_demandas"]);
    },
    onError: (err: any) => toast.error(err.message || "Erro ao convidar usuário."),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="h-4 w-4 mr-1.5" />
          Convidar Usuário
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Convidar Novo Usuário</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="inv-name">Nome Completo</Label>
            <Input id="inv-name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nome do colaborador" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv-email">E-mail *</Label>
            <Input id="inv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="colaborador@2m.com" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv-pass">Senha *</Label>
            <Input id="inv-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
          </div>
          <div className="space-y-1.5">
            <Label>Perfil de Acesso</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Administrador — Acesso total</SelectItem>
                <SelectItem value="operacional">Operacional — Acesso a Demandas</SelectItem>
                <SelectItem value="financeiro">Financeiro — Acesso a Cobrança</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {!isAdminRole && (
            <div className="space-y-2">
              <Label>Permissões</Label>
              <div className="space-y-2 rounded-lg border p-3">
                {(PERMISSIONS_BY_ROLE[role] ?? ALL_PERMISSIONS).map((p) => (
                  <div key={p.key} className="flex items-center gap-2">
                    <Checkbox
                      id={`inv-perm-${p.key}`}
                      checked={permissions.includes(p.key)}
                      onCheckedChange={() => togglePerm(p.key)}
                    />
                    <label htmlFor={`inv-perm-${p.key}`} className="text-sm cursor-pointer">{p.label}</label>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Selecione as áreas que este usuário pode acessar.</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Criando..." : "Criar Usuário"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ChecklistTemplate {
  id: string;
  title: string;
  is_required: boolean;
  sort_order: number;
}

function DocumentChecklistCard() {
  const queryClient = useQueryClient();
  const [newTitle, setNewTitle] = useState("");

  const { data: items = [], isLoading } = useQuery<ChecklistTemplate[]>({
    queryKey: ["checklist-templates"],
    queryFn: async () => {
      const { data } = await supabase
        .from("document_checklist_templates" as any)
        .select("*")
        .order("sort_order");
      return (data as any) ?? [];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!newTitle.trim()) throw new Error("Título obrigatório");
      const maxOrder = items.length > 0 ? Math.max(...items.map((i) => i.sort_order)) + 1 : 0;
      const { error } = await supabase
        .from("document_checklist_templates" as any)
        .insert({ title: newTitle.trim(), is_required: false, sort_order: maxOrder });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewTitle("");
      queryClient.invalidateQueries({ queryKey: ["checklist-templates"] });
      toast.success("Documento adicionado!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const toggleRequired = async (item: ChecklistTemplate) => {
    await supabase
      .from("document_checklist_templates" as any)
      .update({ is_required: !item.is_required })
      .eq("id", item.id);
    queryClient.invalidateQueries({ queryKey: ["checklist-templates"] });
  };

  const deleteItem = async (id: string) => {
    await supabase
      .from("document_checklist_templates" as any)
      .delete()
      .eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["checklist-templates"] });
    toast.success("Documento removido.");
  };

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const saveEdit = async (id: string) => {
    if (!editTitle.trim()) return;
    await supabase
      .from("document_checklist_templates" as any)
      .update({ title: editTitle.trim() })
      .eq("id", id);
    setEditingId(null);
    queryClient.invalidateQueries({ queryKey: ["checklist-templates"] });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          Checklist Documental
        </CardTitle>
        <CardDescription>
          Documentos solicitados automaticamente ao criar uma nova demanda
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-1">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-muted/50 group transition-colors"
              >
                <Checkbox
                  checked={item.is_required}
                  onCheckedChange={() => toggleRequired(item)}
                  title="Obrigatório"
                />
                {editingId === item.id ? (
                  <div className="flex-1 flex gap-2">
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="h-8 text-sm"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit(item.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                    />
                    <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => saveEdit(item.id)}>
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <span
                    className="flex-1 text-sm cursor-pointer"
                    onClick={() => { setEditingId(item.id); setEditTitle(item.title); }}
                  >
                    {item.title}
                    {item.is_required && (
                      <Badge variant="secondary" className="ml-2 text-[10px] py-0">obrigatório</Badge>
                    )}
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive transition-opacity"
                  onClick={() => deleteItem(item.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            {items.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum documento configurado.</p>
            )}
          </div>
        )}

        <div className="flex gap-2 pt-2 border-t">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Novo documento..."
            className="text-sm"
            onKeyDown={(e) => { if (e.key === "Enter") addMutation.mutate(); }}
          />
          <Button size="sm" onClick={() => addMutation.mutate()} disabled={addMutation.isPending || !newTitle.trim()}>
            <Plus className="h-4 w-4 mr-1" />
            Adicionar
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Marque o checkbox para definir como obrigatório. Clique no título para editar.
        </p>
      </CardContent>
    </Card>
  );
}

// ── Notifications Panel ──
import { Link } from "react-router-dom";
import { CheckCircle, MessageCircle, Clock, AlertCircle } from "lucide-react";

function formatTimeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function NotificationsPanel() {
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["config-notifications"],
    queryFn: async () => {
      const { data } = await supabase
        .from("case_timeline")
        .select("*, irpf_cases!inner(id, clients(full_name))")
        .in("event_type", ["Documentação completa", "Ajustes solicitados", "Prévia aprovada"])
        .eq("created_by", "Cliente")
        .order("created_at", { ascending: false })
        .limit(15);
      return (data as any[]) ?? [];
    },
  });

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />;

  if (notifications.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-4">Nenhuma notificação recente.</p>;
  }

  const iconMap: Record<string, React.ReactNode> = {
    "Documentação completa": <CheckCircle className="h-3.5 w-3.5 text-success" />,
    "Ajustes solicitados": <AlertCircle className="h-3.5 w-3.5 text-warning" />,
    "Prévia aprovada": <CheckCircle className="h-3.5 w-3.5 text-primary" />,
    "Documento enviado": <FileText className="h-3.5 w-3.5 text-primary" />,
    "Documento marcado como não possui": <Clock className="h-3.5 w-3.5 text-warning" />,
    "Resposta enviada": <MessageCircle className="h-3.5 w-3.5 text-info" />,
  };

  return (
    <div className="space-y-2 max-h-80 overflow-y-auto">
      {notifications.map((item: any) => {
        const clientName = item.irpf_cases?.clients?.full_name ?? "Cliente";
        const caseId = item.irpf_cases?.id ?? item.case_id;
        const icon = iconMap[item.event_type] || <Bell className="h-3.5 w-3.5 text-muted-foreground" />;

        return (
          <Link
            key={item.id}
            to={`/demandas/${caseId}`}
            className="flex items-start gap-3 p-2.5 rounded-lg border hover:bg-muted/50 transition-colors"
          >
            <div className="mt-0.5 shrink-0">{icon}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{clientName}</p>
              <p className="text-xs text-muted-foreground truncate">{item.description ?? item.event_type}</p>
            </div>
            <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">{formatTimeAgo(item.created_at)}</span>
          </Link>
        );
      })}
    </div>
  );
}
