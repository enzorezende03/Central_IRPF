import { useState } from "react";
import { titleCaseName } from "@/lib/format-utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
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

interface NewClientDialogProps {
  trigger?: React.ReactNode;
  onCreated?: (clientId: string, billingType?: string) => void;
}

export function NewClientDialog({ trigger, onCreated }: NewClientDialogProps) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const [tags, setTags] = useState<string[]>([]);

  const [form, setForm] = useState({
    full_name: "",
    cpf: "",
    email: "",
    phone: "",
    notes: "",
    billing_type: "cobranca_extra",
  });

  const toggleTag = (tag: string) => {
    setTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!form.full_name.trim() || !form.cpf.trim()) {
        throw new Error("Nome e CPF são obrigatórios.");
      }
      const { data, error } = await supabase
        .from("clients")
        .insert({
          full_name: titleCaseName(form.full_name),
          cpf: form.cpf.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          notes: form.notes.trim() || null,
          billing_type: form.billing_type,
          tags,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: (clientId) => {
      toast.success("Cliente cadastrado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["irpf-cases"] });
      queryClient.invalidateQueries({ queryKey: ["all-clients"] });
      const billingType = form.billing_type;
      setForm({ full_name: "", cpf: "", email: "", phone: "", notes: "", billing_type: "cobranca_extra" });
      setTags([]);
      setOpen(false);
      onCreated?.(clientId, billingType);
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao cadastrar cliente.");
    },
  });

  const set = (field: string, value: string) => setForm((p) => ({ ...p, [field]: value }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1.5" />
            Novo Cliente
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cadastrar Novo Cliente</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="nc-name">Nome Completo *</Label>
            <Input id="nc-name" value={form.full_name} onChange={(e) => set("full_name", e.target.value)} placeholder="Maria da Silva" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nc-cpf">CPF *</Label>
            <Input id="nc-cpf" value={form.cpf} onChange={(e) => set("cpf", maskCPF(e.target.value))} placeholder="000.000.000-00" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="nc-email">E-mail</Label>
              <Input id="nc-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="email@exemplo.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nc-phone">Telefone</Label>
              <Input id="nc-phone" value={form.phone} onChange={(e) => set("phone", maskPhone(e.target.value))} placeholder="(11) 99999-0000" />
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
            <Label htmlFor="nc-notes">Observações</Label>
            <Textarea id="nc-notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} placeholder="Anotações internas sobre o cliente..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Salvando..." : "Cadastrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
