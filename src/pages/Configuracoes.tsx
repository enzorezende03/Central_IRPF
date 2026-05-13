import { useState, useRef, useEffect, useMemo } from "react";
import { useCapacities, useUpsertCapacity, DEFAULT_WEEKLY_CAPACITY } from "@/hooks/use-weekly-capacity";
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
import { Shield, Building2, CreditCard, UserPlus, Trash2, Pencil, Loader2, Upload, ImageIcon, FileText, Plus, GripVertical, Check, ListChecks, MessageSquare, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Checkbox } from "@/components/ui/checkbox";

// Permissões agrupadas por área (Visualizar / Editar)
const PERMISSION_GROUPS: { area: string; perms: { key: string; label: string }[] }[] = [
  {
    area: "Demandas, Kanban e Mensagens",
    perms: [
      { key: "acesso_demandas", label: "Visualizar" },
      { key: "criar_demandas", label: "Criar" },
      { key: "editar_demandas", label: "Editar" },
      { key: "excluir_demandas", label: "Excluir" },
    ],
  },
  {
    area: "Clientes",
    perms: [
      { key: "criar_clientes", label: "Criar / Importar" },
      { key: "editar_clientes", label: "Editar" },
      { key: "excluir_clientes", label: "Excluir" },
    ],
  },
  {
    area: "Cobrança",
    perms: [
      { key: "acesso_cobranca", label: "Visualizar" },
      { key: "criar_cobranca", label: "Criar" },
      { key: "editar_cobranca", label: "Editar" },
      { key: "excluir_cobranca", label: "Excluir" },
    ],
  },
  {
    area: "Metas IRPF e Planejamento Semanal",
    perms: [
      { key: "acesso_metas", label: "Visualizar" },
      { key: "editar_metas", label: "Configurar metas e planejamento" },
    ],
  },
  {
    area: "Configurações do Sistema",
    perms: [
      { key: "acesso_configuracao", label: "Acessar Configurações" },
    ],
  },
];

const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap((g) => g.perms);

interface AccessProfile {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
}

interface UserRow {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
  role: string;
  access_profile_id: string | null;
  access_profile_name: string | null;
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
        .select("user_id, role, access_profile_id");

      const { data: profilesList } = await supabase
        .from("access_profiles" as any)
        .select("id, name");

      const profMap = new Map<string, string>();
      (profilesList ?? []).forEach((p: any) => profMap.set(p.id, p.name));

      const roleMap = new Map<string, { role: string; access_profile_id: string | null }>();
      (roles ?? []).forEach((r: any) => roleMap.set(r.user_id, { role: r.role, access_profile_id: r.access_profile_id }));

      return (profiles as any[]).map((p) => {
        const r = roleMap.get(p.id);
        return {
          ...p,
          role: r?.role ?? "sem_perfil",
          access_profile_id: r?.access_profile_id ?? null,
          access_profile_name: r?.access_profile_id ? profMap.get(r.access_profile_id) ?? null : null,
        };
      });
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
      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-4xl">
        <div>
          <p className="text-sm text-muted-foreground">Gerencie as configurações do sistema</p>
        </div>

        {isAdmin && (
          <Card>
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
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
                <div className="overflow-x-auto"><Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[100px]">Nome</TableHead>
                      <TableHead className="hidden sm:table-cell">E-mail</TableHead>
                      <TableHead>Perfil</TableHead>
                      <TableHead className="hidden md:table-cell">Cadastro</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                        <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{u.email}</TableCell>
                        <TableCell>
                          <Badge variant={u.role === "admin" ? "default" : "secondary"} className="text-xs">
                            {u.role === "admin" ? "Administrador" : (u.access_profile_name || "Sem perfil")}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                          {new Date(u.created_at).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <EditUserDialog user={u} />
                            <ResetPasswordButton email={u.email} name={u.full_name} />
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
                </Table></div>
              )}
            </CardContent>
          </Card>
        )}

        {isAdmin && <AccessProfilesCard />}

        {isAdmin && <WeeklyCapacityCard />}

        <OfficeSettingsCard />

        <DocumentChecklistCard />

        <FormQuestionsCard />

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

function useAccessProfiles() {
  return useQuery<AccessProfile[]>({
    queryKey: ["access-profiles"],
    queryFn: async () => {
      const { data } = await supabase
        .from("access_profiles" as any)
        .select("id, name, description, permissions")
        .order("name");
      return ((data as any) ?? []) as AccessProfile[];
    },
  });
}

function EditUserDialog({ user: u }: { user: UserRow }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState(u.full_name || "");
  const [role, setRole] = useState(u.role === "sem_perfil" ? "operacional" : u.role);
  const [accessProfileId, setAccessProfileId] = useState<string | null>(u.access_profile_id);
  const { data: profiles = [] } = useAccessProfiles();

  const isAdminRole = role === "admin";

  const mutation = useMutation({
    mutationFn: async () => {
      if (!isAdminRole && !accessProfileId) throw new Error("Selecione um perfil de acesso.");
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: {
          action: "update",
          user_id: u.id,
          full_name: fullName.trim(),
          role,
          access_profile_id: isAdminRole ? null : accessProfileId,
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
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) { setFullName(u.full_name || ""); setRole(u.role === "sem_perfil" ? "operacional" : u.role); setAccessProfileId(u.access_profile_id); } }}>
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
            <Label>Tipo</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Administrador — Acesso total</SelectItem>
                <SelectItem value="operacional">Usuário com perfil de acesso</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {!isAdminRole && (
            <div className="space-y-1.5">
              <Label>Perfil de Acesso *</Label>
              <Select value={accessProfileId ?? ""} onValueChange={(v) => setAccessProfileId(v || null)}>
                <SelectTrigger><SelectValue placeholder="Selecione um perfil" /></SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">As permissões são herdadas do perfil selecionado.</p>
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
  const [accessProfileId, setAccessProfileId] = useState<string | null>(null);
  const { data: profiles = [] } = useAccessProfiles();

  const isAdminRole = role === "admin";

  const mutation = useMutation({
    mutationFn: async () => {
      if (!email.trim() || !password.trim()) throw new Error("E-mail e senha são obrigatórios.");
      if (password.length < 6) throw new Error("A senha deve ter pelo menos 6 caracteres.");
      if (!isAdminRole && !accessProfileId) throw new Error("Selecione um perfil de acesso.");

      const { data, error } = await supabase.functions.invoke("create-user", {
        body: {
          action: "create",
          email: email.trim(),
          password,
          full_name: fullName.trim(),
          role,
          access_profile_id: isAdminRole ? null : accessProfileId,
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
      setEmail(""); setPassword(""); setFullName(""); setRole("admin"); setAccessProfileId(null);
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
            <Label>Tipo</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Administrador — Acesso total</SelectItem>
                <SelectItem value="operacional">Usuário com perfil de acesso</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {!isAdminRole && (
            <div className="space-y-1.5">
              <Label>Perfil de Acesso *</Label>
              <Select value={accessProfileId ?? ""} onValueChange={(v) => setAccessProfileId(v || null)}>
                <SelectTrigger><SelectValue placeholder="Selecione um perfil" /></SelectTrigger>
                <SelectContent>
                  {profiles.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">Crie um perfil primeiro em "Perfis de Acesso".</div>
                  ) : profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">As permissões serão herdadas do perfil selecionado.</p>
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

function AccessProfilesCard() {
  const queryClient = useQueryClient();
  const { data: profiles = [], isLoading } = useAccessProfiles();
  const [editing, setEditing] = useState<AccessProfile | null>(null);
  const [open, setOpen] = useState(false);

  const deleteProfile = async (id: string) => {
    const { error } = await supabase.from("access_profiles" as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Perfil excluído.");
    queryClient.invalidateQueries({ queryKey: ["access-profiles"] });
    queryClient.invalidateQueries({ queryKey: ["admin-users"] });
  };

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            Perfis de Acesso
          </CardTitle>
          <CardDescription>Defina perfis com permissões e atribua aos usuários</CardDescription>
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1.5" />
          Novo Perfil
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : profiles.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhum perfil cadastrado. Crie o primeiro perfil para atribuí-lo aos usuários.</p>
        ) : (
          <div className="space-y-2">
            {profiles.map((p) => (
              <div key={p.id} className="flex items-start justify-between gap-3 p-3 rounded-lg border hover:bg-muted/30">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{p.name}</p>
                  {p.description && <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>}
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {p.permissions.length === 0 ? (
                      <Badge variant="outline" className="text-[10px]">Sem permissões</Badge>
                    ) : PERMISSION_GROUPS.flatMap((g) => g.perms.filter((perm) => p.permissions.includes(perm.key)).map((perm) => ({ ...perm, area: g.area }))).map((perm) => (
                      <Badge key={perm.key} variant="secondary" className="text-[10px]" title={perm.area}>{perm.area.split(/[ ,]/)[0]}: {perm.label}</Badge>
                    ))}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(p); setOpen(true); }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir perfil</AlertDialogTitle>
                        <AlertDialogDescription>
                          Tem certeza que deseja excluir o perfil <strong>{p.name}</strong>? Os usuários vinculados ficarão sem perfil até serem reatribuídos.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteProfile(p.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <AccessProfileDialog open={open} onOpenChange={setOpen} editing={editing} />
    </Card>
  );
}

function AccessProfileDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (v: boolean) => void; editing: AccessProfile | null }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [perms, setPerms] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setName(editing?.name ?? "");
      setDescription(editing?.description ?? "");
      setPerms(editing?.permissions ?? []);
    }
  }, [open, editing]);

  const togglePerm = (key: string) => {
    setPerms((prev) => prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Nome obrigatório");
      const payload = { name: name.trim(), description: description.trim() || null, permissions: perms };
      if (editing) {
        const { error } = await supabase.from("access_profiles" as any).update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("access_profiles" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Perfil atualizado!" : "Perfil criado!");
      queryClient.invalidateQueries({ queryKey: ["access-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      onOpenChange(false);
    },
    onError: (err: any) => toast.error(err.message || "Erro ao salvar perfil."),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar Perfil" : "Novo Perfil de Acesso"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Nome *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Operacional Pleno" />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Opcional" />
          </div>
          <div className="space-y-3">
            <Label>Permissões</Label>
            <div className="space-y-3 rounded-lg border p-3">
              {PERMISSION_GROUPS.map((group) => (
                <div key={group.area} className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground">{group.area}</p>
                  <div className="space-y-1.5 pl-2">
                    {group.perms.map((p) => (
                      <div key={p.key} className="flex items-center gap-2">
                        <Checkbox
                          id={`prof-perm-${p.key}`}
                          checked={perms.includes(p.key)}
                          onCheckedChange={() => togglePerm(p.key)}
                        />
                        <label htmlFor={`prof-perm-${p.key}`} className="text-sm cursor-pointer">{p.label}</label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">"Visualizar" libera o acesso à página. "Criar / Editar / Excluir" libera os botões de ação.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Salvando..." : editing ? "Salvar" : "Criar"}
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

const ANSWER_TYPE_LABELS: Record<string, string> = {
  yes_no: "Sim/Não",
  select: "Seleção",
};

const CONDITIONAL_TYPE_LABELS: Record<string, string> = {
  text: "Campo de texto",
  address: "Formulário de endereço",
  file: "Upload de arquivo",
  bank_details: "Dados bancários",
};

interface FormQuestionTemplate {
  id: string;
  question: string;
  answer_type: string;
  options: { label: string; value: string }[];
  has_conditional: boolean;
  conditional_label: string | null;
  conditional_type: string;
  sort_order: number;
  is_active: boolean;
}

function FormQuestionsCard() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FormQuestionTemplate | null>(null);

  const { data: items = [], isLoading } = useQuery<FormQuestionTemplate[]>({
    queryKey: ["form-question-templates"],
    queryFn: async () => {
      const { data } = await supabase
        .from("form_question_templates" as any)
        .select("*")
        .order("sort_order");
      return (data as any) ?? [];
    },
  });

  const deleteItem = async (id: string) => {
    await supabase.from("form_question_templates" as any).delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["form-question-templates"] });
    toast.success("Pergunta removida.");
  };

  const toggleActive = async (item: FormQuestionTemplate) => {
    await supabase
      .from("form_question_templates" as any)
      .update({ is_active: !item.is_active })
      .eq("id", item.id);
    queryClient.invalidateQueries({ queryKey: ["form-question-templates"] });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              Formulário do Cliente
            </CardTitle>
            <CardDescription>
              Perguntas enviadas ao cliente ao criar uma nova demanda
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => { setEditingItem(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" />
            Adicionar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma pergunta configurada.</p>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className={`flex items-start gap-3 py-3 px-3 rounded-lg hover:bg-muted/50 group transition-colors ${!item.is_active ? "opacity-50" : ""}`}
            >
              <Checkbox
                checked={item.is_active}
                onCheckedChange={() => toggleActive(item)}
                title="Ativa"
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{item.question}</p>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  <Badge variant="outline" className="text-[10px]">
                    {ANSWER_TYPE_LABELS[item.answer_type] || item.answer_type}
                  </Badge>
                  {item.has_conditional && (
                    <Badge variant="secondary" className="text-[10px]">
                      Condicional: {CONDITIONAL_TYPE_LABELS[item.conditional_type] || item.conditional_type}
                    </Badge>
                  )}
                  {item.answer_type === "select" && item.options?.length > 0 && (
                    <Badge variant="secondary" className="text-[10px]">
                      {item.options.length} opções
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => { setEditingItem(item); setDialogOpen(true); }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => deleteItem(item.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))
        )}

        <p className="text-xs text-muted-foreground pt-2 border-t">
          Marque o checkbox para ativar/desativar. Perguntas desativadas não serão exibidas ao cliente.
        </p>
      </CardContent>

      <FormQuestionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingItem={editingItem}
        itemCount={items.length}
      />
    </Card>
  );
}

function FormQuestionDialog({
  open,
  onOpenChange,
  editingItem,
  itemCount,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editingItem: FormQuestionTemplate | null;
  itemCount: number;
}) {
  const queryClient = useQueryClient();
  const [question, setQuestion] = useState("");
  const [answerType, setAnswerType] = useState("yes_no");
  const [hasConditional, setHasConditional] = useState(false);
  const [conditionalLabel, setConditionalLabel] = useState("");
  const [conditionalType, setConditionalType] = useState("text");
  const [options, setOptions] = useState<{ label: string; value: string }[]>([]);
  const [newOption, setNewOption] = useState("");

  // Reset form when dialog opens
  const resetForm = () => {
    if (editingItem) {
      setQuestion(editingItem.question);
      setAnswerType(editingItem.answer_type);
      setHasConditional(editingItem.has_conditional);
      setConditionalLabel(editingItem.conditional_label || "");
      setConditionalType(editingItem.conditional_type);
      setOptions(editingItem.options || []);
    } else {
      setQuestion("");
      setAnswerType("yes_no");
      setHasConditional(false);
      setConditionalLabel("");
      setConditionalType("text");
      setOptions([]);
    }
    setNewOption("");
  };

  // Reset when open changes
  useState(() => { resetForm(); });

  const addOption = () => {
    if (!newOption.trim()) return;
    const value = newOption.trim().toLowerCase().replace(/\s+/g, "_");
    setOptions((prev) => [...prev, { label: newOption.trim(), value }]);
    setNewOption("");
  };

  const removeOption = (index: number) => {
    setOptions((prev) => prev.filter((_, i) => i !== index));
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!question.trim()) throw new Error("Pergunta obrigatória");
      const payload = {
        question: question.trim(),
        answer_type: answerType,
        has_conditional: hasConditional,
        conditional_label: hasConditional ? conditionalLabel.trim() || null : null,
        conditional_type: hasConditional ? conditionalType : "text",
        options: answerType === "select" ? options : [],
      };

      if (editingItem) {
        const { error } = await supabase
          .from("form_question_templates" as any)
          .update(payload)
          .eq("id", editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("form_question_templates" as any)
          .insert({ ...payload, sort_order: itemCount, is_active: true });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingItem ? "Pergunta atualizada!" : "Pergunta adicionada!");
      queryClient.invalidateQueries({ queryKey: ["form-question-templates"] });
      onOpenChange(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (v) resetForm(); }}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingItem ? "Editar Pergunta" : "Nova Pergunta"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Pergunta *</Label>
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ex: Houve alteração de endereço?"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Tipo de Resposta</Label>
            <Select value={answerType} onValueChange={setAnswerType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yes_no">Sim / Não</SelectItem>
                <SelectItem value="select">Seleção de opções</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {answerType === "select" && (
            <div className="space-y-2">
              <Label>Opções</Label>
              <div className="space-y-1.5">
                {options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm bg-muted/50 rounded px-2.5 py-1.5">
                    <span className="flex-1">{opt.label}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeOption(i)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newOption}
                  onChange={(e) => setNewOption(e.target.value)}
                  placeholder="Nova opção..."
                  className="text-sm"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOption(); } }}
                />
                <Button size="sm" variant="outline" onClick={addOption} disabled={!newOption.trim()}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 pt-2 border-t">
            <Checkbox
              id="has-conditional"
              checked={hasConditional}
              onCheckedChange={(v) => setHasConditional(!!v)}
            />
            <label htmlFor="has-conditional" className="text-sm cursor-pointer">
              Abrir campo condicional ao responder "Sim" ou selecionar uma opção
            </label>
          </div>

          {hasConditional && (
            <>
              <div className="space-y-1.5">
                <Label>Rótulo do campo condicional</Label>
                <Input
                  value={conditionalLabel}
                  onChange={(e) => setConditionalLabel(e.target.value)}
                  placeholder="Ex: Informe seu novo endereço"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo do campo condicional</Label>
                <Select value={conditionalType} onValueChange={setConditionalType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Campo de texto</SelectItem>
                    <SelectItem value="address">Formulário de endereço</SelectItem>
                    <SelectItem value="file">Upload de arquivo</SelectItem>
                    <SelectItem value="bank_details">Dados bancários</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !question.trim()}>
            {mutation.isPending ? "Salvando..." : editingItem ? "Salvar" : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordButton({ email, name }: { email: string; name: string }) {
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: { action: "reset_password", email },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`E-mail de redefinição de senha enviado para ${name || email}`);
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar e-mail de redefinição.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" title="Reenviar senha">
          <KeyRound className="h-3.5 w-3.5" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reenviar senha</AlertDialogTitle>
          <AlertDialogDescription>
            Será enviado um e-mail de redefinição de senha para <strong>{name || email}</strong> ({email}). Deseja continuar?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleReset} disabled={loading}>
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
            Enviar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function WeeklyCapacityCard() {
  const { data: caps = [], isLoading } = useCapacities();
  const upsert = useUpsertCapacity();

  // Build list of all known responsibles: from existing capacities + irpf_cases.internal_owner
  const { data: ownersFromCases = [] } = useQuery({
    queryKey: ["distinct-internal-owners"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("irpf_cases")
        .select("internal_owner")
        .not("internal_owner", "is", null)
        .limit(5000);
      if (error) throw error;
      const s = new Set<string>();
      (data ?? []).forEach((r: any) => r.internal_owner && s.add(r.internal_owner));
      return Array.from(s).sort();
    },
  });

  const allResponsibles = useMemo(() => {
    const s = new Set<string>(ownersFromCases);
    caps.forEach((c) => s.add(c.responsible));
    return Array.from(s).sort();
  }, [caps, ownersFromCases]);

  const [newResp, setNewResp] = useState("");
  const [newCap, setNewCap] = useState<string>("10");

  const capByResp = useMemo(() => {
    const m = new Map<string, number>();
    caps.forEach((c) => m.set(c.responsible, c.capacity));
    return m;
  }, [caps]);

  const [drafts, setDrafts] = useState<Record<string, string>>({});

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-primary" /> Capacidade Semanal
        </CardTitle>
        <CardDescription>
          Limite de demandas por responsável a cada semana no Planejamento. Padrão: {DEFAULT_WEEKLY_CAPACITY}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[480px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Responsável</TableHead>
                  <TableHead className="w-32">Capacidade</TableHead>
                  <TableHead className="w-28 text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allResponsibles.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-6">
                      Nenhum responsável cadastrado ainda.
                    </TableCell>
                  </TableRow>
                )}
                {allResponsibles.map((resp) => {
                  const current = capByResp.get(resp) ?? DEFAULT_WEEKLY_CAPACITY;
                  const draft = drafts[resp] ?? String(current);
                  const isDirty = draft !== String(current);
                  return (
                    <TableRow key={resp}>
                      <TableCell className="font-medium whitespace-nowrap">{resp}</TableCell>
                      <TableCell>
                        <Input
                          type="number" min={0}
                          value={draft}
                          onChange={(e) => setDrafts((p) => ({ ...p, [resp]: e.target.value }))}
                          className="h-8 w-24"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm" variant={isDirty ? "default" : "ghost"}
                          disabled={!isDirty || upsert.isPending}
                          onClick={async () => {
                            const v = parseInt(draft, 10);
                            if (!Number.isFinite(v) || v < 0) {
                              toast.error("Capacidade inválida");
                              return;
                            }
                            await upsert.mutateAsync({ responsible: resp, capacity: v });
                            setDrafts((p) => { const n = { ...p }; delete n[resp]; return n; });
                          }}
                        >
                          Salvar
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="border-t pt-4 flex items-end gap-2 flex-wrap">
          <div className="flex-1 min-w-[180px]">
            <Label className="text-xs">Adicionar responsável</Label>
            <Input
              placeholder="Nome do responsável"
              value={newResp}
              onChange={(e) => setNewResp(e.target.value)}
              className="h-9 mt-1"
            />
          </div>
          <div className="w-28">
            <Label className="text-xs">Capacidade</Label>
            <Input
              type="number" min={0}
              value={newCap}
              onChange={(e) => setNewCap(e.target.value)}
              className="h-9 mt-1"
            />
          </div>
          <Button
            size="sm"
            disabled={upsert.isPending || !newResp.trim()}
            onClick={async () => {
              const v = parseInt(newCap, 10);
              if (!newResp.trim() || !Number.isFinite(v) || v < 0) {
                toast.error("Preencha responsável e capacidade válida");
                return;
              }
              await upsert.mutateAsync({ responsible: newResp.trim(), capacity: v });
              setNewResp(""); setNewCap("10");
            }}
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
