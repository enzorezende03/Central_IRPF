import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { maskCPF, maskPhone } from "@/lib/format-utils";

const AVAILABLE_TAGS = ["2M Saúde", "2M Contabilidade"] as const;

interface ClientData {
  id: string;
  full_name: string;
  cpf: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  billing_type: string;
  tags: string[];
}

interface EditClientDialogProps {
  client: ClientData;
  trigger?: React.ReactNode;
}

export function EditClientDialog({ client, trigger }: EditClientDialogProps) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const [tags, setTags] = useState<string[]>(client.tags || []);

  const [form, setForm] = useState({
    full_name: client.full_name,
    cpf: client.cpf,
    email: client.email || "",
    phone: client.phone || "",
    notes: client.notes || "",
    billing_type: client.billing_type || "cobranca_extra",
  });

  useEffect(() => {
    if (open) {
      setForm({
        full_name: client.full_name,
        cpf: client.cpf,
        email: client.email || "",
        phone: client.phone || "",
        notes: client.notes || "",
        billing_type: client.billing_type || "cobranca_extra",
      });
      setTags(client.tags || []);
    }
  }, [open, client]);

  const toggleTag = (tag: string) => {
    setTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!form.full_name.trim() || !form.cpf.trim()) {
        throw new Error("Nome e CPF são obrigatórios.");
      }
      const { error } = await supabase
        .from("clients")
        .update({
          full_name: form.full_name.trim(),
          cpf: form.cpf.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          notes: form.notes.trim() || null,
          billing_type: form.billing_type,
          tags,
        })
        .eq("id", client.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cliente atualizado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["all-clients"] });
      queryClient.invalidateQueries({ queryKey: ["irpf-cases"] });
      setOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao atualizar cliente.");
    },
  });

  const set = (field: string, value: string) => setForm((p) => ({ ...p, [field]: value }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Cliente</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="ec-name">Nome Completo *</Label>
            <Input id="ec-name" value={form.full_name} onChange={(e) => set("full_name", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ec-cpf">CPF *</Label>
            <Input id="ec-cpf" value={form.cpf} onChange={(e) => set("cpf", maskCPF(e.target.value))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ec-email">E-mail</Label>
              <Input id="ec-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ec-phone">Telefone</Label>
              <Input id="ec-phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Empresa</Label>
            <div className="flex gap-4">
              {AVAILABLE_TAGS.map((tag) => (
                <label key={tag} className="flex items-center gap-2 cursor-pointer text-sm">
                  <Checkbox checked={tags.includes(tag)} onCheckedChange={() => toggleTag(tag)} />
                  {tag}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Tipo de Cobrança</Label>
            <Select value={form.billing_type} onValueChange={(v) => set("billing_type", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="incluso_mensalidade">Incluso na mensalidade</SelectItem>
                <SelectItem value="cobranca_extra">Cobrança extra</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ec-notes">Observações</Label>
            <Textarea id="ec-notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} />
          </div>
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
