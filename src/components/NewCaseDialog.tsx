import { useState, useEffect } from "react";
import { formatCPF } from "@/lib/format-utils";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { NewClientDialog } from "./NewClientDialog";
import { logTimelineEvent, generateSlug } from "@/lib/portal-utils";

function generateToken() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

interface DocTemplate {
  id: string;
  title: string;
  is_required: boolean;
  sort_order: number;
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
  const [declarationType, setDeclarationType] = useState("simples");
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());

  const { data: clients = [] } = useQuery({
    queryKey: ["all-clients"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, full_name, cpf, billing_type").order("full_name");
      return data ?? [];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-list"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name").order("full_name");
      return data ?? [];
    },
  });

  const { data: docTemplates = [] } = useQuery<DocTemplate[]>({
    queryKey: ["checklist-templates"],
    queryFn: async () => {
      const { data } = await supabase
        .from("document_checklist_templates" as any)
        .select("*")
        .order("sort_order");
      return (data as any) ?? [];
    },
  });

  // Auto-select all templates when they load or dialog opens
  useEffect(() => {
    if (docTemplates.length > 0 && open) {
      setSelectedDocs(new Set(docTemplates.map((d) => d.id)));
    }
  }, [docTemplates, open]);

  const toggleDoc = (id: string) => {
    setSelectedDocs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedDocs.size === docTemplates.length) {
      setSelectedDocs(new Set());
    } else {
      setSelectedDocs(new Set(docTemplates.map((d) => d.id)));
    }
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!clientId) throw new Error("Selecione um cliente.");
      const selectedClient = clients.find((c) => c.id === clientId);
      const token = generateToken();
      const slug = generateSlug(selectedClient?.full_name ?? "cliente");
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
          portal_slug: slug,
          client_message: clientMessage.trim() || null,
          declaration_type: declarationType,
          status: "aguardando_cliente" as any,
          progress_percent: 0,
        })
        .select("id")
        .single();
      if (error) throw error;

      // Insert only selected documents
      const selected = docTemplates.filter((t) => selectedDocs.has(t.id));
      if (selected.length > 0) {
        const docInserts = selected.map((t) => ({
          case_id: newCase.id,
          title: t.title,
          is_required: t.is_required,
          status: "pendente" as const,
        }));
        await supabase.from("document_requests").insert(docInserts);
      }

      // Create billing record
      await supabase.from("billing").insert({
        case_id: newCase.id,
        amount: feeAmount ? Number(feeAmount.replace(",", ".")) || 0 : 0,
        billing_status: billingType === "incluso_mensalidade" ? "pago" as any : "nao_cobrado" as any,
        billing_type: billingType,
      } as any);

      // Copy form question templates into case_questions
      const { data: formTemplates } = await supabase
        .from("form_question_templates")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (formTemplates && formTemplates.length > 0) {
        const validTypes = ["text", "yes_no", "number", "date", "file"];
        const questionInserts = formTemplates.map((t: any) => ({
          case_id: newCase.id,
          question: t.question,
          answer_type: validTypes.includes(t.answer_type) ? t.answer_type : "text",
          is_required: false,
          sort_order: t.sort_order,
        }));
        await supabase.from("case_questions").insert(questionInserts);
      }

      // Log timeline
      await logTimelineEvent(newCase.id, "criacao", "Demanda criada no sistema.");

      // Create default internal checklist items
      const defaultChecklist = [
        "Solicitar Documentação",
        "Fazer Procuração",
        "Verificar se a declaração está de acordo com a proposta, caso não esteja passar para o comercial",
        "Preencher declaração",
      ];
      await supabase.from("internal_checklist").insert(
        defaultChecklist.map((label, i) => ({
          case_id: newCase.id,
          label,
          sort_order: i,
          checked: false,
        }))
      );

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
    setDeclarationType("simples");
    setSelectedDocs(new Set());
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-1.5" />
          Nova Demanda
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Nova Demanda IRPF</DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 pr-3">
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
                        {c.full_name} — {formatCPF(c.cpf)}
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
                <Label>Responsável</Label>
                <Select value={owner} onValueChange={setOwner}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o responsável" />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map((p) => (
                      <SelectItem key={p.id} value={p.full_name ?? p.id}>
                        {p.full_name || "Sem nome"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                <Label>Tipo de Declaração</Label>
                <Select value={declarationType} onValueChange={setDeclarationType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="simples">Simples</SelectItem>
                    <SelectItem value="complexa">Complexa</SelectItem>
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


            {/* Document selection */}
            {docTemplates.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Documentos Solicitados</Label>
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={toggleAll}
                  >
                    {selectedDocs.size === docTemplates.length ? "Desmarcar todos" : "Selecionar todos"}
                  </button>
                </div>
                <div className="rounded-lg border bg-muted/20 p-3 space-y-1.5 max-h-44 overflow-y-auto">
                  {docTemplates.map((doc) => (
                    <label
                      key={doc.id}
                      className="flex items-center gap-2.5 py-1 px-1 rounded hover:bg-muted/50 cursor-pointer text-sm transition-colors"
                    >
                      <Checkbox
                        checked={selectedDocs.has(doc.id)}
                        onCheckedChange={() => toggleDoc(doc.id)}
                      />
                      <span className="flex-1">{doc.title}</span>
                      {doc.is_required && (
                        <Badge variant="secondary" className="text-[10px] py-0 shrink-0">obrigatório</Badge>
                      )}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {selectedDocs.size} de {docTemplates.length} selecionado(s)
                </p>
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
        </ScrollArea>
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
