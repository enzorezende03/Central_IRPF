import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BILLING_LABELS } from "@/lib/types";
import { Upload, FileText, X, Loader2 } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type BillingRow = Database["public"]["Tables"]["billing"]["Row"];
type BillingStatus = Database["public"]["Enums"]["billing_status"];

interface EditBillingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  billing: BillingRow | null;
  clientName?: string;
}

const PAYMENT_METHODS = ["PIX", "Boleto", "Cartão de Crédito", "Cartão de Débito", "Transferência", "Dinheiro"];

export function EditBillingDialog({ open, onOpenChange, billing, clientName }: EditBillingDialogProps) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<BillingStatus>("nao_cobrado");
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [notes, setNotes] = useState("");
  const [boletoUrl, setBoletoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (billing) {
      setAmount(billing.amount.toFixed(2).replace(".", ","));
      setStatus(billing.billing_status);
      setPaymentDate(billing.payment_date ?? "");
      setPaymentMethod(billing.payment_method ?? "");
      setNotes(billing.notes ?? "");
      setBoletoUrl((billing as any).boleto_url ?? null);
    }
  }, [billing]);

  const handleBoletoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !billing) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Limite: 10 MB.");
      return;
    }

    setUploading(true);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `boletos/${billing.case_id}/${Date.now()}_${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("documentos_clientes")
      .upload(path, file, { upsert: false });

    if (uploadError) {
      toast.error("Erro ao fazer upload do boleto.");
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from("documentos_clientes").getPublicUrl(path);
    setBoletoUrl(data.publicUrl);
    setUploading(false);
    toast.success("Boleto anexado!");

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemoveBoleto = () => {
    setBoletoUrl(null);
  };

  const handleSave = async () => {
    if (!billing) return;
    setSaving(true);

    const parsedAmount = parseFloat(amount.replace(/\./g, "").replace(",", "."));

    let finalPaymentDate = paymentDate || null;
    if (status === "pago" && !paymentDate) {
      finalPaymentDate = new Date().toISOString().split("T")[0];
      setPaymentDate(finalPaymentDate);
    }

    const updates: Record<string, any> = {
      amount: isNaN(parsedAmount) ? billing.amount : parsedAmount,
      billing_status: status,
      payment_date: finalPaymentDate,
      payment_method: paymentMethod || null,
      notes: notes || null,
      boleto_url: boletoUrl,
    };

    const { error } = await supabase.from("billing").update(updates).eq("id", billing.id);
    setSaving(false);

    if (error) {
      toast.error("Erro ao salvar cobrança.");
    } else {
      toast.success("Cobrança atualizada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["irpf-cases"] });
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Cobrança</DialogTitle>
          {clientName && <p className="text-sm text-muted-foreground">{clientName}</p>}
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Valor (R$)</Label>
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              inputMode="decimal"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as BillingStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(BILLING_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Data de Pagamento</Label>
            <Input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Forma de Pagamento</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Boleto Upload */}
          <div className="space-y-1.5">
            <Label>Boleto</Label>
            {boletoUrl ? (
              <div className="flex items-center gap-2 p-2 border rounded-lg bg-muted/50">
                <FileText className="h-4 w-4 text-primary shrink-0" />
                <a
                  href={boletoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline truncate flex-1"
                >
                  Boleto anexado
                </a>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={handleRemoveBoleto}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  className="hidden"
                  onChange={handleBoletoUpload}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...</>
                  ) : (
                    <><Upload className="h-4 w-4 mr-2" /> Anexar boleto</>
                  )}
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observações sobre a cobrança..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || uploading}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
