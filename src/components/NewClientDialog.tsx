import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface NewClientDialogProps {
  trigger?: React.ReactNode;
  onCreated?: (clientId: string) => void;
}

export function NewClientDialog({ trigger, onCreated }: NewClientDialogProps) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    full_name: "",
    cpf: "",
    email: "",
    phone: "",
    notes: "",
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!form.full_name.trim() || !form.cpf.trim()) {
        throw new Error("Nome e CPF são obrigatórios.");
      }
      const { data, error } = await supabase
        .from("clients")
        .insert({
          full_name: form.full_name.trim(),
          cpf: form.cpf.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          notes: form.notes.trim() || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: (clientId) => {
      toast.success("Cliente cadastrado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["irpf-cases"] });
      setForm({ full_name: "", cpf: "", email: "", phone: "", notes: "" });
      setOpen(false);
      onCreated?.(clientId);
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
            <Input id="nc-cpf" value={form.cpf} onChange={(e) => set("cpf", e.target.value)} placeholder="000.000.000-00" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="nc-email">E-mail</Label>
              <Input id="nc-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="email@exemplo.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nc-phone">Telefone</Label>
              <Input id="nc-phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="(11) 99999-0000" />
            </div>
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
