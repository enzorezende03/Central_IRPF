import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { NewClientDialog } from "./NewClientDialog";
import { REQUIRED_DOCUMENTS } from "@/lib/types";
import { logTimelineEvent } from "@/lib/portal-utils";

function generateToken() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function NewCaseDialog() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [clientId, setClientId] = useState("");
  const [baseYear, setBaseYear] = useState(String(new Date().getFullYear() - 1));
  const [owner, setOwner] = useState("");
  const [priority, setPriority] = useState("media");
  const [feeAmount, setFeeAmount] = useState("");
  const [billingType, setBillingType] = useState("cobranca_extra");
  const [clientMessage, setClientMessage] = useState("");

  const { data: clients = [] } = useQuery({
    queryKey: ["all-clients"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, full_name, cpf, billing_type").order("full_name");
      return data ?? [];
    },
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!clientId) throw new Error("Selecione um cliente.");
      const token = generateToken();
      // Create case
      const { data: newCase, error } = await supabase
        .from("irpf_cases")
        .insert({
          client_id: clientId,
          base_year: Number(baseYear),
          tax_year: Number(baseYear) + 1,
          internal_owner: owner.trim() || null,
          priority: priority as any,
          portal_token: token,
          client_message: clientMessage.trim() || null,
          status: "aguardando_cliente" as any,
          progress_percent: 0,
        })
        .select("id")
        .single();
      if (error) throw error;

      // Create default document requests
      const docInserts = REQUIRED_DOCUMENTS.map((title, i) => ({
        case_id: newCase.id,
        title,
        is_required: i < 3, // first 3 are required by default
        status: "pendente" as const,
      }));
      await supabase.from("document_requests").insert(docInserts);

      // Create billing record
      await supabase.from("billing").insert({
        case_id: newCase.id,
        amount: feeAmount ? Number(feeAmount.replace(",", ".")) || 0 : 0,
        billing_status: billingType === "incluso_mensalidade" ? "pago" as any : "nao_cobrado" as any,
        billing_type: billingType,
      } as any);

      // Log timeline
      await logTimelineEvent(newCase.id, "criacao", "Demanda criada no sistema.");

      return newCase.id;
    },
    onSuccess: (caseId) => {
      toast.success("Demanda criada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["irpf-cases"] });
      queryClient.invalidateQueries({ queryKey: ["all-clients"] });
      setOpen(false);
      resetForm();
      navigate(`/demandas/${caseId}`);
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao criar demanda.");
    },
  });

  function resetForm() {
    setClientId("");
    setBaseYear(String(new Date().getFullYear() - 1));
    setOwner("");
    setPriority("media");
    setFeeAmount("");
    setBillingType("cobranca_extra");
    setClientMessage("");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-1.5" />
          Nova Demanda
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova Demanda IRPF</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Client selection */}
          <div className="space-y-1.5">
            <Label>Cliente *</Label>
            <div className="flex gap-2">
              <Select value={clientId} onValueChange={(id) => {
                setClientId(id);
                const selected = clients.find((c) => c.id === id);
                if (selected?.billing_type) {
                  setBillingType(selected.billing_type);
                  if (selected.billing_type === "incluso_mensalidade") setFeeAmount("");
                }
              }}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.full_name} — {c.cpf}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <NewClientDialog
                trigger={<Button variant="outline" size="icon" title="Cadastrar novo cliente"><Plus className="h-4 w-4" /></Button>}
                onCreated={(id, bt) => {
                  queryClient.invalidateQueries({ queryKey: ["all-clients"] });
                  setClientId(id);
                  if (bt) {
                    setBillingType(bt);
                    if (bt === "incluso_mensalidade") setFeeAmount("");
                  }
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="nd-year">Ano-base</Label>
              <Input id="nd-year" type="number" value={baseYear} onChange={(e) => setBaseYear(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nd-owner">Responsável</Label>
              <Input id="nd-owner" value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Nome do responsável" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de Cobrança</Label>
              <Select value={billingType} onValueChange={setBillingType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="incluso_mensalidade">Incluso na mensalidade</SelectItem>
                  <SelectItem value="cobranca_extra">Cobrança extra</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {billingType === "cobranca_extra" && (
            <div className="space-y-1.5">
              <Label htmlFor="nd-fee">Valor do Honorário (R$)</Label>
              <Input id="nd-fee" value={feeAmount} onChange={(e) => setFeeAmount(e.target.value)} placeholder="1.500,00" />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="nd-msg">Mensagem para o cliente</Label>
            <Textarea
              id="nd-msg"
              value={clientMessage}
              onChange={(e) => setClientMessage(e.target.value)}
              rows={2}
              placeholder="Mensagem que aparecerá no portal do cliente..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Criando..." : "Criar Demanda"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
