import { useParams, Link } from "react-router-dom";
import { formatCPF, formatPhone } from "@/lib/format-utils";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useState, useRef, useCallback } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import {
  ArrowLeft, Copy, MessageCircle, CheckCircle, Circle, FileText, Clock,
  User, Mail, Phone, DollarSign, ExternalLink, Upload, Send, Eye,
  AlertCircle, Calendar, CreditCard, Save, RefreshCw, Download, Loader2, Trash2,
  Plus, X, ListChecks,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { InternalLayout } from "@/components/InternalLayout";
import { StatusBadge, BillingBadge, PriorityBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { STATUS_LABELS, BILLING_LABELS, PRIORITY_LABELS, BILLING_TYPE_LABELS } from "@/lib/types";
import type { BillingType } from "@/lib/types";
import type { Tables } from "@/integrations/supabase/types";
import type { Database } from "@/integrations/supabase/types";

type CaseStatus = Database["public"]["Enums"]["case_status"];
type CasePriority = Database["public"]["Enums"]["case_priority"];
type BillingStatusType = Database["public"]["Enums"]["billing_status"];
type DocumentStatus = Database["public"]["Enums"]["document_status"];

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(d: string) {
  return format(new Date(d), "dd/MM/yyyy HH:mm", { locale: ptBR });
}

import { getPortalUrl, getWhatsAppMessage, logTimelineEvent } from "@/lib/portal-utils";
import { validateFile, getAcceptString, uploadFileToBucket, buildStoragePath, MAX_FILE_SIZE_LABEL, ALLOWED_EXTENSIONS_LABEL } from "@/lib/upload-utils";

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  // ── Fetch case with client ──
  const { data: caseData, isLoading } = useQuery({
    queryKey: ["case-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("irpf_cases")
        .select("*, clients(*)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // ── Fetch profiles for owner select ──
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-list"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name").order("full_name");
      return data ?? [];
    },
  });

  // ── Fetch related data ──
  const { data: docRequests = [] } = useQuery({
    queryKey: ["doc-requests", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("document_requests")
        .select("*")
        .eq("case_id", id!)
        .order("created_at");
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: uploadedDocs = [] } = useQuery({
    queryKey: ["uploaded-docs", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("uploaded_documents")
        .select("*")
        .eq("case_id", id!)
        .order("uploaded_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!id,
  });


  const { data: billing } = useQuery({
    queryKey: ["case-billing", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("billing")
        .select("*")
        .eq("case_id", id!)
        .maybeSingle();
      return data;
    },
    enabled: !!id,
  });

  const { data: timeline = [] } = useQuery({
    queryKey: ["case-timeline", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("case_timeline")
        .select("*")
        .eq("case_id", id!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: deliverable } = useQuery({
    queryKey: ["case-deliverable", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("final_deliverables")
        .select("*")
        .eq("case_id", id!)
        .maybeSingle();
      return data;
    },
    enabled: !!id,
  });

  const { data: caseMessages = [] } = useQuery({
    queryKey: ["case-messages", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("case_messages")
        .select("*")
        .eq("case_id", id!)
        .order("created_at", { ascending: true });
      return (data as any[]) ?? [];
    },
    enabled: !!id,
  });

  // ── Fetch questions + answers ──
  const { data: caseQuestions = [] } = useQuery({
    queryKey: ["case-questions", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("case_questions")
        .select("*")
        .eq("case_id", id!)
        .order("sort_order");
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: caseAnswers = [] } = useQuery({
    queryKey: ["case-answers", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("case_answers")
        .select("*")
        .eq("case_id", id!);
      return data ?? [];
    },
    enabled: !!id,
  });
  // ── Fetch internal checklist for procuração badge ──
  const { data: checklistItems = [] } = useQuery({
    queryKey: ["internal-checklist", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("internal_checklist")
        .select("*")
        .eq("case_id", id!);
      return data ?? [];
    },
    enabled: !!id,
  });

  const procItem = checklistItems.find((item) =>
    item.label.toLowerCase().includes("procura")
  );

  // ── Local state ──
  const [internalNotes, setInternalNotes] = useState<string | null>(null);
  const [showImpedirDialog, setShowImpedirDialog] = useState(false);
  const [impedirJustificativa, setImpedirJustificativa] = useState("");
  const [showDispensarDialog, setShowDispensarDialog] = useState(false);
  const [dispensarJustificativa, setDispensarJustificativa] = useState("");

  const notesValue = internalNotes ?? caseData?.internal_notes ?? "";

  // ── Mutations ──
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["case-detail", id] });
    queryClient.invalidateQueries({ queryKey: ["doc-requests", id] });
    queryClient.invalidateQueries({ queryKey: ["case-billing", id] });
    queryClient.invalidateQueries({ queryKey: ["case-timeline", id] });
    queryClient.invalidateQueries({ queryKey: ["case-deliverable", id] });
    queryClient.invalidateQueries({ queryKey: ["case-messages", id] });
    queryClient.invalidateQueries({ queryKey: ["irpf-cases"] });
  };

  const saveNotes = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("irpf_cases")
        .update({ internal_notes: notesValue })
        .eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Notas salvas!");
      invalidateAll();
    },
    onError: () => toast.error("Erro ao salvar notas"),
  });

  const updateStatus = useMutation({
    mutationFn: async (status: CaseStatus) => {
      const { error } = await supabase
        .from("irpf_cases")
        .update({ internal_status: status })
        .eq("id", id!);
      if (error) throw error;
    },
    onSuccess: async (_, status) => {
      toast.success("Status interno atualizado!");
      await logTimelineEvent(id!, "Status interno alterado", `Status interno alterado para ${STATUS_LABELS[status]}`, false);
      invalidateAll();
    },
  });

  const updatePriority = useMutation({
    mutationFn: async (priority: CasePriority) => {
      const { error } = await supabase
        .from("irpf_cases")
        .update({ priority })
        .eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Prioridade atualizada!");
      invalidateAll();
    },
  });

  const updateDocStatus = useMutation({
    mutationFn: async ({ docId, status }: { docId: string; status: DocumentStatus }) => {
      const { error } = await supabase
        .from("document_requests")
        .update({ status })
        .eq("id", docId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status do documento atualizado!");
      invalidateAll();
      queryClient.invalidateQueries({ queryKey: ["uploaded-docs", id] });
    },
  });

  const updateBilling = useMutation({
    mutationFn: async (updates: Partial<Tables<"billing">>) => {
      if (billing) {
        const { error } = await supabase.from("billing").update(updates).eq("id", billing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("billing").insert({ case_id: id!, ...updates });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Cobrança atualizada!");
      queryClient.invalidateQueries({ queryKey: ["case-billing", id] });
      invalidateAll();
    },
  });

  // ── Loading / Not found ──
  if (isLoading) {
    return (
      <InternalLayout>
        <div className="p-6 space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </InternalLayout>
    );
  }

  if (!caseData) {
    return (
      <InternalLayout>
        <div className="p-6 text-center text-muted-foreground">Demanda não encontrada.</div>
      </InternalLayout>
    );
  }

  const client = caseData.clients as Tables<"clients"> | null;
  const clientName = client?.full_name ?? "Cliente";
  const firstName = clientName.split(" ")[0];
  const linkId = caseData.portal_slug || caseData.portal_token;
  const portalUrl = getPortalUrl(linkId);
  const whatsappMsg = getWhatsAppMessage(clientName, linkId, caseData.client_message);

  const unansweredCount = 0;
  const approvedDocs = docRequests.filter((d) => d.status === "aprovado").length;
  const pendingDocs = docRequests.filter((d) => d.status === "pendente" || d.status === "rejeitado").length;

  const copyToClipboard = async (text: string, label: string, eventType: string, description: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
    await logTimelineEvent(id!, eventType, description);
    queryClient.invalidateQueries({ queryKey: ["case-timeline", id] });
  };

  const handleOpenPortal = async () => {
    window.open(portalUrl, "_blank");
    await logTimelineEvent(id!, "Portal aberto", "Portal aberto pelo escritório");
    queryClient.invalidateQueries({ queryKey: ["case-timeline", id] });
  };

  return (
    <>
    <InternalLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* ── 1. Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <Link to="/demandas">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold truncate">{client?.full_name ?? "Cliente"}</h1>
            <p className="text-sm text-muted-foreground">
              CPF: {formatCPF(client?.cpf)} · Ano-base {caseData.base_year} · Exercício {caseData.tax_year}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Interno:</span>
              <Select value={(caseData as any).internal_status ?? caseData.status} onValueChange={(v) => updateStatus.mutate(v as CaseStatus)}>
                <SelectTrigger className="w-auto gap-1 border-0 p-0 h-auto shadow-none">
                  <StatusBadge status={((caseData as any).internal_status ?? caseData.status) as any} />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Separator orientation="vertical" className="h-5 hidden sm:block" />
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Cliente:</span>
              <StatusBadge status={caseData.status} />
            </div>
            <Select value={caseData.priority} onValueChange={(v) => updatePriority.mutate(v as CasePriority)}>
              <SelectTrigger className="w-auto gap-1 border-0 p-0 h-auto shadow-none">
                <PriorityBadge priority={caseData.priority} />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {billing && <BillingBadge status={billing.billing_status} billingType={billing.billing_type} />}
            {procItem?.checked ? (
              <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 border">
                <CheckCircle className="h-3 w-3 mr-1" />
                Procuração OK
              </Badge>
            ) : (
              <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 border">
                <AlertCircle className="h-3 w-3 mr-1" />
                Sem Procuração
              </Badge>
            )}
            {(caseData as any).internal_status !== "impedida" ? (
              <Button
                variant="outline"
                size="sm"
                className="text-rose-600 border-rose-300 hover:bg-rose-50 hover:text-rose-700"
                onClick={() => setShowImpedirDialog(true)}
              >
                <AlertCircle className="h-3.5 w-3.5 mr-1" />
                Impedir
              </Button>
            ) : (
              <>
                <Badge className="bg-rose-500/15 text-rose-600 border-rose-500/30 border">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Impedida
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-teal-600 border-teal-300 hover:bg-teal-50 hover:text-teal-700"
                  onClick={async () => {
                    const { error } = await supabase
                      .from("irpf_cases")
                      .update({ internal_status: "aguardando_cliente" })
                      .eq("id", id!);
                    if (error) {
                      toast.error("Erro ao reabrir demanda");
                      return;
                    }
                    await logTimelineEvent(id!, "Impedimento resolvido", "Demanda reaberta manualmente pelo escritório", false);
                    toast.success("Demanda reaberta com sucesso");
                    invalidateAll();
                  }}
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                  Reabrir
                </Button>
              </>
            )}
            {(caseData as any).internal_status !== "dispensada" ? (
              <Button
                variant="outline"
                size="sm"
                className="text-slate-600 border-slate-300 hover:bg-slate-50 hover:text-slate-700"
                onClick={() => setShowDispensarDialog(true)}
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Dispensar
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Badge className="bg-slate-500/15 text-slate-600 border-slate-500/30 border">
                  <X className="h-3 w-3 mr-1" />
                  Dispensada
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-teal-600 border-teal-300 hover:bg-teal-50 hover:text-teal-700"
                  onClick={async () => {
                    const { error } = await supabase
                      .from("irpf_cases")
                      .update({ internal_status: "aguardando_cliente" })
                      .eq("id", id!);
                    if (error) {
                      toast.error("Erro ao reverter dispensa");
                      return;
                    }
                    await logTimelineEvent(id!, "Dispensa revertida", "Demanda reativada pelo escritório", false);
                    toast.success("Demanda reativada!");
                    queryClient.invalidateQueries({ queryKey: ["case-detail", id] });
                    queryClient.invalidateQueries({ queryKey: ["irpf-cases"] });
                  }}
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                  Reverter Dispensa
                </Button>
              </div>
            )}
          </div>
        </div>

        {(caseData as any).internal_status === "dispensada" && (
          <div className="rounded-lg border border-slate-300 bg-slate-100 p-4 text-center text-slate-500">
            <X className="h-5 w-5 mx-auto mb-1" />
            <p className="font-medium">Demanda dispensada</p>
            <p className="text-sm">Todas as ações estão desativadas. Use "Reverter Dispensa" para reativar.</p>
          </div>
        )}

        <div className={`${(caseData as any).internal_status === "dispensada" ? "opacity-50 pointer-events-none select-none" : ""}`}>

        {/* ── Info Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <OwnerCard
            currentOwner={caseData.internal_owner}
            profiles={profiles}
            onChangeOwner={(name) => {
              supabase.from("irpf_cases").update({ internal_owner: name }).eq("id", id!).then(() => {
                queryClient.invalidateQueries({ queryKey: ["case-detail", id] });
                queryClient.invalidateQueries({ queryKey: ["irpf-cases"] });
                toast.success("Responsável atualizado!");
              });
            }}
          />
          <InfoCard icon={Phone} label="Celular" value={formatPhone(client?.phone)} />
          <InfoCard icon={Mail} label="E-mail" value={client?.email ?? "—"} />
          <Card>
            <CardContent className="p-3.5 flex items-center gap-3">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Tipo Declaração</p>
                <Select
                  value={caseData.declaration_type ?? "simples"}
                  onValueChange={(v) => {
                    supabase.from("irpf_cases").update({ declaration_type: v }).eq("id", id!).then(() => {
                      queryClient.invalidateQueries({ queryKey: ["case-detail", id] });
                      toast.success("Tipo de declaração atualizado!");
                    });
                  }}
                >
                  <SelectTrigger className="h-auto p-0 border-0 shadow-none text-sm font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="simples">Simples</SelectItem>
                    <SelectItem value="completa">Completa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
          <InfoCard icon={Calendar} label="Criado em" value={fmtDate(caseData.created_at)} />
        </div>

        {/* Status do cliente calculado automaticamente */}

        {/* ── 3. Portal Link ── */}
        <Card>
          <CardContent className="p-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold mb-1 flex items-center gap-2">
                  <ExternalLink className="h-4 w-4 text-primary" />
                  Link do Portal do Cliente
                </p>
                <p className="text-xs text-muted-foreground break-all font-mono bg-muted px-2 py-1 rounded">
                  {portalUrl}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <Button variant="outline" size="sm" className="text-xs" onClick={() => copyToClipboard(portalUrl, "Link", "Link copiado", `Link do portal copiado para ${client?.full_name}`)}>
                  <Copy className="h-3.5 w-3.5 mr-1" /> Copiar Link
                </Button>
                <Button variant="outline" size="sm" className="text-xs" onClick={() => copyToClipboard(whatsappMsg, "Mensagem WhatsApp", "WhatsApp copiado", `Mensagem WhatsApp copiada para ${client?.full_name}`)}>
                  <MessageCircle className="h-3.5 w-3.5 mr-1" /> WhatsApp
                </Button>
                <Button variant="outline" size="sm" className="text-xs" onClick={handleOpenPortal}>
                  <Eye className="h-3.5 w-3.5 mr-1" /> Abrir
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Main content grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column (2/3) */}
          <div className="lg:col-span-2 space-y-6">
            {/* ── Internal Checklist ── */}
            <InternalChecklistCard caseId={id!} />

            {/* ── Formulário do Cliente ── */}
            <CaseQuestionsCard
              caseId={id!}
              questions={caseQuestions}
              answers={caseAnswers}
              onRefresh={() => {
                queryClient.invalidateQueries({ queryKey: ["case-questions", id] });
                queryClient.invalidateQueries({ queryKey: ["case-answers", id] });
              }}
            />
            {/* ── 9a. Prévia ── */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Eye className="h-4 w-4 text-primary" />
                      Prévia da Declaração
                    </CardTitle>
                    <CardDescription>Envie a prévia para aprovação do cliente</CardDescription>
                  </div>
                  <CopyStageMessageButton
                    message={`Olá!\n\nEnviamos a prévia do seu Imposto de Renda.\n\nPor favor, acesse a Central do IRPF, pelo link: ${portalUrl} e, se estiver tudo certo, realize a aprovação.\n\nQualquer dúvida, estamos à disposição!`}
                    label="Copiar msg"
                    toastLabel="Mensagem da prévia copiada!"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <PreviewCard caseId={id!} deliverable={deliverable} onRefresh={() => {
                  queryClient.invalidateQueries({ queryKey: ["case-deliverable", id] });
                  queryClient.invalidateQueries({ queryKey: ["case-timeline", id] });
                }} />
              </CardContent>
            </Card>

            {/* ── 9b. Declaração / Recibo ── */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Download className="h-4 w-4 text-primary" />
                      Declaração e Recibo
                    </CardTitle>
                    <CardDescription>Declaração IRPF final e recibo de entrega</CardDescription>
                  </div>
                  <CopyStageMessageButton
                    message={`Olá!\n\nSua declaração de Imposto de Renda foi finalizada.\nAcesse pelo link da Central do IR no aplicativo ou pelo link: ${portalUrl} para conferência.\n\nEstamos à disposição para qualquer dúvida!`}
                    label="Copiar msg"
                    toastLabel="Mensagem da declaração copiada!"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <DeclarationReceiptCard caseId={id!} deliverable={deliverable} onRefresh={() => {
                  queryClient.invalidateQueries({ queryKey: ["case-deliverable", id] });
                  queryClient.invalidateQueries({ queryKey: ["case-timeline", id] });
                }} />
              </CardContent>
            </Card>

            {/* ── 9c. Guia DARF ── */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-primary" />
                  Guia de Pagamento (DARF)
                </CardTitle>
                <CardDescription>Link da guia de pagamento para o cliente</CardDescription>
              </CardHeader>
              <CardContent>
                <GuideCard caseId={id!} deliverable={deliverable} onRefresh={() => {
                  queryClient.invalidateQueries({ queryKey: ["case-deliverable", id] });
                  queryClient.invalidateQueries({ queryKey: ["case-timeline", id] });
                }} />
              </CardContent>
            </Card>
          </div>

          {/* Right column (1/3) */}
          <div className="space-y-6">
            {/* ── Checklist Documental ── */}
            <Collapsible>
              <Card>
                <CardHeader className="pb-3">
                   <CollapsibleTrigger className="w-full text-left">
                     <div className="flex items-center justify-between">
                       <CardTitle className="text-base flex items-center gap-2">
                         <FileText className="h-4 w-4 text-primary" />
                         Checklist Documental
                       </CardTitle>
                       <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [&[data-state=open]]:rotate-180" />
                     </div>
                     <CardDescription className="mt-1">
                       {approvedDocs} aprovados · {pendingDocs} pendentes · {docRequests.length} total
                     </CardDescription>
                   </CollapsibleTrigger>
                   {uploadedDocs.length > 0 && (
                     <Button
                       variant="outline"
                       size="sm"
                       className="mt-2 w-full text-xs"
                       onClick={async (e) => {
                         e.stopPropagation();
                         toast.info("Iniciando download dos documentos...");
                         for (const doc of uploadedDocs) {
                           try {
                             const res = await fetch(doc.file_url);
                             const blob = await res.blob();
                             const a = document.createElement("a");
                             a.href = URL.createObjectURL(blob);
                             a.download = doc.file_name;
                             document.body.appendChild(a);
                             a.click();
                             document.body.removeChild(a);
                             URL.revokeObjectURL(a.href);
                             // Small delay between downloads to avoid browser blocking
                             await new Promise((r) => setTimeout(r, 500));
                           } catch {
                             toast.error(`Erro ao baixar: ${doc.file_name}`);
                           }
                         }
                         toast.success(`${uploadedDocs.length} documento(s) baixado(s)!`);
                       }}
                     >
                       <Download className="h-3.5 w-3.5 mr-1.5" />
                       Baixar Todos ({uploadedDocs.length})
                     </Button>
                   )}
                 </CardHeader>
                <CollapsibleContent>
                  <CardContent className="space-y-2">
                    {docRequests.map((doc) => {
                      const docUploads = uploadedDocs.filter((u) => u.document_request_id === doc.id);
                      return (
                        <InternalDocRow
                          key={doc.id}
                          doc={doc}
                          uploads={docUploads}
                          caseId={id!}
                          onStatusChange={(status) => updateDocStatus.mutate({ docId: doc.id, status })}
                          onRefresh={() => {
                            queryClient.invalidateQueries({ queryKey: ["doc-requests", id] });
                            queryClient.invalidateQueries({ queryKey: ["uploaded-docs", id] });
                            queryClient.invalidateQueries({ queryKey: ["case-timeline", id] });
                          }}
                        />
                      );
                    })}
                    <AddDocumentRow caseId={id!} onAdded={() => {
                      queryClient.invalidateQueries({ queryKey: ["doc-requests", id] });
                    }} />
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* ── Observações Internas ── */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Observações Internas</CardTitle>
                <CardDescription>Visível apenas para a equipe</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={notesValue}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  placeholder="Adicionar observações internas..."
                  rows={4}
                  className="text-sm"
                />
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => saveNotes.mutate()}
                  disabled={saveNotes.isPending}
                >
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  {saveNotes.isPending ? "Salvando..." : "Salvar Notas"}
                </Button>
              </CardContent>
            </Card>

            {/* ── Mensagens ── */}
            <MessagesSection
              caseId={id!}
              messages={caseMessages}
              copyMessage={`Olá!\n\nIdentificamos que você possui uma nova mensagem importante no seu atendimento de Imposto de Renda.\n\nPedimos, por gentileza, que acesse o aplicativo e verifique o quanto antes para dar continuidade ao seu processo.\n\n${portalUrl}`}
              onRefresh={() => {
                queryClient.invalidateQueries({ queryKey: ["case-messages", id] });
                queryClient.invalidateQueries({ queryKey: ["case-timeline", id] });
              }}
            />

            {/* ── Timeline (colapsável) ── */}
            <Collapsible>
              <Card>
                <CardHeader className="pb-3">
                  <CollapsibleTrigger className="w-full text-left">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Clock className="h-4 w-4 text-primary" />
                        Histórico / Timeline
                      </CardTitle>
                      <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [&[data-state=open]]:rotate-180" />
                    </div>
                    <CardDescription className="mt-1">
                      {timeline.length} evento(s) registrado(s)
                    </CardDescription>
                  </CollapsibleTrigger>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent>
                    {timeline.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">Nenhum evento registrado.</p>
                    ) : (
                      <div className="relative space-y-0">
                        {timeline.map((event, i) => (
                          <div key={event.id} className="flex gap-3 pb-4">
                            <div className="flex flex-col items-center">
                              <div className="h-2.5 w-2.5 rounded-full bg-primary mt-1.5 shrink-0" />
                              {i < timeline.length - 1 && <div className="flex-1 w-px bg-border" />}
                            </div>
                            <div className="flex-1 min-w-0 pb-1">
                              <p className="text-sm font-medium">{event.event_type}</p>
                              {event.description && (
                                <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
                              )}
                              <p className="text-[10px] text-muted-foreground mt-1">
                                {fmtDate(event.created_at)}
                                {event.created_by && ` · ${event.created_by}`}
                                {event.visible_to_client && (
                                  <span className="ml-2 text-info">Visível ao cliente</span>
                                )}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          </div>
        </div>
        </div>
      </div>
    </InternalLayout>

    {/* Dialog de Justificativa para Impedimento */}
    <Dialog open={showImpedirDialog} onOpenChange={(open) => { setShowImpedirDialog(open); if (!open) setImpedirJustificativa(""); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Impedir Demanda</DialogTitle>
          <DialogDescription>Informe o motivo do impedimento. Esta justificativa será registrada no histórico.</DialogDescription>
        </DialogHeader>
        <Textarea
          placeholder="Descreva o motivo do impedimento..."
          value={impedirJustificativa}
          onChange={(e) => setImpedirJustificativa(e.target.value)}
          className="min-h-[100px]"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => { setShowImpedirDialog(false); setImpedirJustificativa(""); }}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={!impedirJustificativa.trim()}
            onClick={async () => {
              const justificativa = impedirJustificativa.trim();
              if (!justificativa) return;
              const { error } = await supabase
                .from("irpf_cases")
                .update({ internal_status: "impedida" })
                .eq("id", id!);
              if (error) {
                toast.error("Erro ao impedir demanda");
                return;
              }
              await logTimelineEvent(id!, "Demanda impedida", `Motivo: ${justificativa}`, false);
              toast.success("Demanda marcada como impedida");
              setShowImpedirDialog(false);
              setImpedirJustificativa("");
              invalidateAll();
            }}
          >
            <AlertCircle className="h-3.5 w-3.5 mr-1" />
            Confirmar Impedimento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* ── Dispensar Dialog ── */}
    <Dialog open={showDispensarDialog} onOpenChange={setShowDispensarDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dispensar Demanda</DialogTitle>
          <DialogDescription>
            Informe o motivo pelo qual o cliente não irá fazer o IR conosco. Essa informação ficará registrada na timeline.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          placeholder="Descreva o motivo da dispensa..."
          value={dispensarJustificativa}
          onChange={(e) => setDispensarJustificativa(e.target.value)}
          className="min-h-[100px]"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => { setShowDispensarDialog(false); setDispensarJustificativa(""); }}>
            Cancelar
          </Button>
          <Button
            variant="secondary"
            disabled={!dispensarJustificativa.trim()}
            onClick={async () => {
              const justificativa = dispensarJustificativa.trim();
              if (!justificativa) return;
              const { error } = await supabase
                .from("irpf_cases")
                .update({ internal_status: "dispensada" })
                .eq("id", id!);
              if (error) {
                toast.error("Erro ao dispensar demanda");
                return;
              }
              await logTimelineEvent(id!, "Demanda dispensada", `Motivo: ${justificativa}`, false);
              toast.success("Demanda marcada como dispensada");
              setShowDispensarDialog(false);
              setDispensarJustificativa("");
              invalidateAll();
            }}
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Confirmar Dispensa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
  );
}

// ── Sub-components ──

function InfoCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-3.5 flex items-center gap-3">
        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="text-sm font-medium truncate">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function OwnerCard({
  currentOwner,
  profiles,
  onChangeOwner,
}: {
  currentOwner: string | null;
  profiles: { id: string; full_name: string | null }[];
  onChangeOwner: (name: string | null) => void;
}) {
  return (
    <Card>
      <CardContent className="p-3.5 flex items-center gap-3">
        <User className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Responsável</p>
          <Select
            value={currentOwner ?? "__none__"}
            onValueChange={(v) => onChangeOwner(v === "__none__" ? null : v)}
          >
            <SelectTrigger className="h-auto p-0 border-0 shadow-none text-sm font-medium">
              <SelectValue placeholder="Selecionar..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Não definido</SelectItem>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.full_name ?? p.id}>
                  {p.full_name || "Sem nome"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}

function BillingBlock({
  billing,
  onUpdate,
}: {
  billing: Tables<"billing"> | null | undefined;
  onUpdate: (updates: Partial<Tables<"billing">>) => void;
}) {
  const bil = billing as any;
  const [billingType, setBillingType] = useState<string>(bil?.billing_type ?? "cobranca_extra");
  const [status, setStatus] = useState<BillingStatusType | "">(billing?.billing_status ?? "");
  const [amount, setAmount] = useState(billing?.amount?.toString() ?? "");
  const [notes, setNotes] = useState(billing?.notes ?? "");
  const [paymentDate, setPaymentDate] = useState(billing?.payment_date ?? "");
  const [paymentMethod, setPaymentMethod] = useState(billing?.payment_method ?? "");

  const currentStatus = status || billing?.billing_status || "nao_cobrado";
  const currentAmount = amount || billing?.amount?.toString() || "0";
  const isIncluso = billingType === "incluso_mensalidade";

  const isPending = currentStatus !== "pago" && !isIncluso;

  return (
    <div className="space-y-3">
      {isIncluso && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-success/10 border border-success/30">
          <CheckCircle className="h-4 w-4 text-success shrink-0" />
          <p className="text-xs text-success font-medium">IRPF incluso na mensalidade</p>
        </div>
      )}
      {isPending && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-warning/10 border border-warning/30">
          <AlertCircle className="h-4 w-4 text-warning shrink-0" />
          <p className="text-xs text-warning font-medium">
            {currentStatus === "nao_cobrado" ? "Honorário ainda não cobrado" : "Aguardando pagamento"}
          </p>
        </div>
      )}
      <div>
        <label className="text-xs font-medium text-muted-foreground">Tipo de Cobrança</label>
        <Select
          value={billingType}
          onValueChange={(v) => {
            setBillingType(v);
            const updates: any = { billing_type: v };
            if (v === "incluso_mensalidade") {
              updates.billing_status = "pago";
              setStatus("pago");
            }
            onUpdate(updates);
          }}
        >
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(BILLING_TYPE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">Status</label>
        <Select
          value={currentStatus}
          onValueChange={(v) => {
            setStatus(v as BillingStatusType);
            const updates: Partial<Tables<"billing">> = { billing_status: v as BillingStatusType };
            if (v === "pago" && !paymentDate) {
              const today = new Date().toISOString().split("T")[0];
              setPaymentDate(today);
              updates.payment_date = today;
            }
            onUpdate(updates);
          }}
        >
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(BILLING_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">Valor (R$)</label>
        <Input
          type="number"
          value={currentAmount}
          onChange={(e) => setAmount(e.target.value)}
          onBlur={() => onUpdate({ amount: parseFloat(currentAmount) || 0 })}
          className="mt-1"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">Data de Pagamento</label>
        <Input
          type="date"
          value={paymentDate}
          onChange={(e) => setPaymentDate(e.target.value)}
          onBlur={() => onUpdate({ payment_date: paymentDate || null })}
          className="mt-1"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">Forma de Pagamento</label>
        <Select
          value={paymentMethod || "__none"}
          onValueChange={(v) => {
            const val = v === "__none" ? "" : v;
            setPaymentMethod(val);
            onUpdate({ payment_method: val || null });
          }}
        >
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Selecionar..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none">Não informado</SelectItem>
            <SelectItem value="PIX">PIX</SelectItem>
            <SelectItem value="Transferência">Transferência</SelectItem>
            <SelectItem value="Boleto">Boleto</SelectItem>
            <SelectItem value="Cartão de Crédito">Cartão de Crédito</SelectItem>
            <SelectItem value="Dinheiro">Dinheiro</SelectItem>
            <SelectItem value="Link de Pagamento">Link de Pagamento</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">Observações</label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => onUpdate({ notes })}
          placeholder="Observações da cobrança..."
          rows={2}
          className="mt-1 text-sm"
        />
      </div>
    </div>
  );
}

// ── Internal Document Row ──
function InternalDocRow({
  doc,
  uploads,
  caseId,
  onStatusChange,
  onRefresh,
}: {
  doc: Tables<"document_requests">;
  uploads: Tables<"uploaded_documents">[];
  caseId: string;
  onStatusChange: (status: DocumentStatus) => void;
  onRefresh: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const statusIcon = {
    pendente: <Circle className="h-5 w-5 text-muted-foreground shrink-0" />,
    enviado: <AlertCircle className="h-5 w-5 text-info shrink-0" />,
    aprovado: <CheckCircle className="h-5 w-5 text-success shrink-0" />,
    rejeitado: <AlertCircle className="h-5 w-5 text-destructive shrink-0" />,
  } satisfies Record<DocumentStatus, React.ReactNode>;

  const handleOfficeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      const err = validateFile(file);
      if (err) { toast.error(err); return; }
    }

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const path = buildStoragePath(caseId, file.name, doc.id);
        const url = await uploadFileToBucket("documentos_clientes", path, file);
        await supabase.from("uploaded_documents").insert({
          case_id: caseId,
          document_request_id: doc.id,
          file_name: file.name,
          file_url: url,
          file_type: file.type || null,
          uploaded_by: "office",
        });
      }
      await supabase.from("document_requests").update({ status: "enviado" as DocumentStatus }).eq("id", doc.id);
      await logTimelineEvent(caseId, "Documento enviado pelo escritório", `Escritório enviou "${doc.title}"`);
      toast.success("Arquivo enviado!");
      onRefresh();
    } catch {
      toast.error("Erro ao enviar arquivo.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="p-3 rounded-lg border hover:bg-muted/30 transition-colors space-y-2">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">{statusIcon[doc.status]}</div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm break-words ${doc.status === "aprovado" ? "text-muted-foreground line-through" : "font-medium"}`}>
            {doc.title}
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {doc.category === "nao_possui" && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-warning/15 text-warning border-warning/30">
                Cliente não possui
              </Badge>
            )}
            {doc.category && doc.category !== "nao_possui" && <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{doc.category}</span>}
            {doc.is_required && <Badge variant="outline" className="text-[10px] px-1 py-0">Obrigatório</Badge>}
          </div>
          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
            {(doc.status === "enviado" || (doc.status === "pendente" && uploads.length > 0)) && (
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => onStatusChange("aprovado")}>
                <CheckCircle className="h-3.5 w-3.5 mr-1" /> Aprovar
              </Button>
            )}
            {doc.status === "enviado" && (
              <Button variant="ghost" size="sm" className="text-xs h-7 text-destructive" onClick={() => onStatusChange("rejeitado")}>
                Rejeitar
              </Button>
            )}
            {doc.status === "rejeitado" && (
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => onStatusChange("pendente")}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" /> Solicitar novamente
              </Button>
            )}
            <input ref={fileInputRef} type="file" className="hidden" multiple accept={getAcceptString()} onChange={handleOfficeUpload} />
            <Button variant="ghost" size="sm" className="text-xs h-7" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </div>
      {uploads.length > 0 && (
        <div className="ml-8 space-y-1">
          {uploads.map((u) => (
            <div key={u.id} className="flex items-center gap-2 text-xs p-1.5 rounded bg-muted/50">
              <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="flex-1 truncate">{u.file_name}</span>
              <span className="text-muted-foreground shrink-0">{new Date(u.uploaded_at).toLocaleDateString("pt-BR")}</span>
              <span className="text-[10px] text-muted-foreground shrink-0">{u.uploaded_by === "client" ? "Cliente" : "Escritório"}</span>
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" asChild>
                <a href={u.file_url} target="_blank" rel="noopener noreferrer"><Eye className="h-3 w-3" /></a>
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Preview Card ──
function PreviewCard({ caseId, deliverable, onRefresh }: { caseId: string; deliverable: Tables<"final_deliverables"> | null | undefined; onRefresh: () => void }) {
  const previewRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const del = deliverable as any;

  const handleUpload = async (file: File) => {
    const err = validateFile(file);
    if (err) { toast.error(err); return; }
    setUploading(true);
    try {
      const url = await uploadFileToBucket("declaracoes_finais", buildStoragePath(caseId, file.name, "preview"), file);
      const updates: any = { preview_file_url: url, preview_status: "aguardando_revisao", preview_feedback: null };
      if (deliverable) {
        await supabase.from("final_deliverables").update(updates).eq("id", deliverable.id);
      } else {
        await supabase.from("final_deliverables").insert({ case_id: caseId, ...updates } as any);
      }
      await logTimelineEvent(caseId, "Prévia da Declaração enviada", `Arquivo: ${file.name}`, true);
      toast.success("Prévia enviada!");
      onRefresh();
    } catch { toast.error("Erro ao enviar."); } finally { setUploading(false); }
  };

  const previewStatusLabel: Record<string, { text: string; color: string }> = {
    aguardando_revisao: { text: "Aguardando revisão do cliente", color: "text-warning" },
    aprovado: { text: "Aprovado pelo cliente ✓", color: "text-success" },
    ajustes_solicitados: { text: "Ajustes solicitados", color: "text-destructive" },
  };
  const pStatus = del?.preview_status as string | null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <FileText className={`h-4 w-4 shrink-0 ${del?.preview_file_url ? "text-primary" : "text-muted-foreground"}`} />
        <span className="text-sm flex-1">{del?.preview_file_url ? "Prévia enviada" : "Enviar prévia para aprovação"}</span>
        {del?.preview_file_url && (
          <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
            <a href={del.preview_file_url} target="_blank" rel="noopener noreferrer"><Eye className="h-3.5 w-3.5" /></a>
          </Button>
        )}
        <input ref={previewRef} type="file" className="hidden" accept={getAcceptString()} onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
        <Button variant="outline" size="sm" className="h-7 text-xs" disabled={uploading} onClick={() => previewRef.current?.click()}>
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Upload className="h-3.5 w-3.5 mr-1" /> {del?.preview_file_url ? "Substituir" : "Upload"}</>}
        </Button>
      </div>
      {pStatus && del?.preview_file_url && (
        <div className="space-y-1">
          <p className={`text-xs font-medium ${previewStatusLabel[pStatus]?.color ?? "text-muted-foreground"}`}>
            {previewStatusLabel[pStatus]?.text ?? pStatus}
          </p>
          {pStatus === "ajustes_solicitados" && del?.preview_feedback && (
            <div className="p-2 rounded bg-destructive/10 border border-destructive/20">
              <p className="text-xs font-medium text-destructive mb-0.5">Feedback do cliente:</p>
              <p className="text-sm">{del.preview_feedback}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Declaration & Receipt Card ──
function DeclarationReceiptCard({ caseId, deliverable, onRefresh }: { caseId: string; deliverable: Tables<"final_deliverables"> | null | undefined; onRefresh: () => void }) {
  const irpfRef = useRef<HTMLInputElement>(null);
  const receiptRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<HTMLInputElement>(null);
  const decRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<"irpf" | "receipt" | "rec" | "dec" | null>(null);

  const UPLOAD_CONFIG = {
    irpf: { bucket: "declaracoes_finais", field: "irpf_file_url", label: "Declaração IRPF" },
    receipt: { bucket: "recibos_entrega", field: "receipt_file_url", label: "Recibo de Entrega" },
    rec: { bucket: "recibos_entrega", field: "rec_file_url", label: "Arquivo REC" },
    dec: { bucket: "declaracoes_finais", field: "dec_file_url", label: "Arquivo DEC" },
  } as const;

  const handleUpload = async (type: keyof typeof UPLOAD_CONFIG, file: File) => {
    // REC and DEC have specific extension requirements – skip generic validation
    if (type === "rec") {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext !== "rec") { toast.error("Apenas arquivos .REC são aceitos."); return; }
    } else if (type === "dec") {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext !== "dec") { toast.error("Apenas arquivos .DEC são aceitos."); return; }
    } else {
      const err = validateFile(file);
      if (err) { toast.error(err); return; }
    }
    if (file.size > 10 * 1024 * 1024) { toast.error(`Arquivo "${file.name}" excede o limite de 10 MB.`); return; }
    setUploading(type);
    const cfg = UPLOAD_CONFIG[type];
    try {
      const url = await uploadFileToBucket(cfg.bucket, buildStoragePath(caseId, file.name), file);
      if (deliverable) {
        await supabase.from("final_deliverables").update({ [cfg.field]: url } as any).eq("id", deliverable.id);
      } else {
        await supabase.from("final_deliverables").insert({ case_id: caseId, [cfg.field]: url } as any);
      }
      await logTimelineEvent(caseId, `${cfg.label} enviado(a)`, `Arquivo: ${file.name}`, true);
      toast.success(`${cfg.label} enviado(a)!`);
      onRefresh();
    } catch { toast.error("Erro ao enviar."); } finally { setUploading(null); }
  };

  const toggleRelease = async () => {
    if (!deliverable) return;
    const newVal = !deliverable.sent_to_client;
    await supabase.from("final_deliverables").update({ sent_to_client: newVal }).eq("id", deliverable.id);
    await logTimelineEvent(caseId, newVal ? "Entrega liberada" : "Entrega bloqueada", newVal ? "Arquivos finais liberados para o cliente" : "Arquivos finais bloqueados", true);
    toast.success(newVal ? "Arquivos liberados!" : "Liberação revogada.");
    onRefresh();
  };

  const fileUrl = (field: string) => (deliverable as any)?.[field] as string | null | undefined;

  const renderRow = (type: keyof typeof UPLOAD_CONFIG, ref: React.RefObject<HTMLInputElement>) => {
    const cfg = UPLOAD_CONFIG[type];
    const url = fileUrl(cfg.field);
    return (
      <div className="flex items-center gap-2 p-2.5 rounded-lg border">
        <FileText className={`h-4 w-4 shrink-0 ${url ? "text-success" : "text-muted-foreground"}`} />
        <span className="text-sm flex-1">{url ? cfg.label : `Enviar ${cfg.label}`}</span>
        {url && (
          <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
            <a href={url} target="_blank" rel="noopener noreferrer"><Eye className="h-3.5 w-3.5" /></a>
          </Button>
        )}
        <input ref={ref} type="file" className="hidden" accept={type === "rec" ? ".rec" : type === "dec" ? ".dec" : getAcceptString()} onChange={(e) => e.target.files?.[0] && handleUpload(type, e.target.files[0])} />
        <Button variant="outline" size="sm" className="h-7 text-xs" disabled={uploading === type} onClick={() => ref.current?.click()}>
          {uploading === type ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Upload className="h-3.5 w-3.5 mr-1" /> {url ? "Substituir" : "Upload"}</>}
        </Button>
      </div>
    );
  };

  const hasAnyFile = deliverable?.irpf_file_url || deliverable?.receipt_file_url || fileUrl("rec_file_url") || fileUrl("dec_file_url");

  return (
    <div className="space-y-3">
      {renderRow("irpf", irpfRef)}
      {renderRow("receipt", receiptRef)}
      {renderRow("rec", recRef)}
      {renderRow("dec", decRef)}
      {deliverable && hasAnyFile && (
        <Button
          variant={deliverable.sent_to_client ? "destructive" : "default"}
          size="sm"
          className="w-full"
          onClick={toggleRelease}
        >
          {deliverable.sent_to_client ? (
            <><CheckCircle className="h-3.5 w-3.5 mr-1.5" /> Liberado — Clique para revogar</>
          ) : (
            <><Send className="h-3.5 w-3.5 mr-1.5" /> Liberar para o Cliente</>
          )}
        </Button>
      )}
    </div>
  );
}

// ── Guide (DARF) Card ──
import { Link2, ExternalLink as ExternalLinkIcon } from "lucide-react";
import { Switch } from "@/components/ui/switch";

function GuideCard({ caseId, deliverable, onRefresh }: { caseId: string; deliverable: Tables<"final_deliverables"> | null | undefined; onRefresh: () => void }) {
  const del = deliverable as any;
  const [hasGuide, setHasGuide] = useState<boolean>(del?.has_guide ?? false);
  const [guideUrl, setGuideUrl] = useState<string>(del?.guide_url ?? "");
  const [saving, setSaving] = useState(false);

  const toggleGuide = async (checked: boolean) => {
    setHasGuide(checked);
    if (deliverable) {
      await supabase.from("final_deliverables").update({ has_guide: checked } as any).eq("id", deliverable.id);
    } else {
      await supabase.from("final_deliverables").insert({ case_id: caseId, has_guide: checked } as any);
    }
    if (!checked) {
      setGuideUrl("");
      if (deliverable) {
        await supabase.from("final_deliverables").update({ guide_url: null } as any).eq("id", deliverable.id);
      }
    }
    onRefresh();
  };

  const saveGuideUrl = async () => {
    if (!guideUrl.trim()) { toast.error("Informe o link da guia."); return; }
    setSaving(true);
    try {
      if (deliverable) {
        await supabase.from("final_deliverables").update({ guide_url: guideUrl.trim() } as any).eq("id", deliverable.id);
      } else {
        await supabase.from("final_deliverables").insert({ case_id: caseId, has_guide: true, guide_url: guideUrl.trim() } as any);
      }
      await logTimelineEvent(caseId, "Guia DARF enviada", "Link da guia de pagamento adicionado", true);
      toast.success("Link da guia salvo!");
      onRefresh();
    } catch { toast.error("Erro ao salvar."); } finally { setSaving(false); }
  };

  const [gclickChecked, setGclickChecked] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Possui guia de pagamento?</label>
        <Switch checked={hasGuide} onCheckedChange={toggleGuide} />
      </div>
      {hasGuide && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              value={guideUrl}
              onChange={(e) => setGuideUrl(e.target.value)}
              placeholder="Cole o link da guia DARF..."
              className="text-sm"
            />
            <Button size="sm" disabled={saving || !guideUrl.trim()} onClick={saveGuideUrl}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Save className="h-3.5 w-3.5 mr-1" /> Salvar</>}
            </Button>
          </div>
          {del?.guide_url && (
            <a
              href={del.guide_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <ExternalLinkIcon className="h-3 w-3" />
              Abrir guia de pagamento
            </a>
          )}
        </div>
      )}
      <Separator className="my-2" />
      <label className="flex items-center gap-2.5 py-1 cursor-pointer text-sm">
        <Checkbox checked={gclickChecked} onCheckedChange={(v) => setGclickChecked(!!v)} />
        <span>Criar tarefa no G-Click em caso de pagamento do imposto por quotas</span>
      </label>
    </div>
  );
}

// ── Copy Stage Message Button ──
function CopyStageMessageButton({ message, label, toastLabel }: { message: string; label: string; toastLabel: string }) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="text-xs shrink-0"
      onClick={() => {
        navigator.clipboard.writeText(message);
        toast.success(toastLabel);
      }}
    >
      <MessageCircle className="h-3.5 w-3.5 mr-1" />
      {label}
    </Button>
  );
}

// ── Messages Section (Chat) ──
function MessagesSection({
  caseId,
  messages,
  copyMessage,
  onRefresh,
}: {
  caseId: string;
  messages: any[];
  copyMessage: string;
  onRefresh: () => void;
}) {
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const sendMessage = async () => {
    if (!newMsg.trim()) return;
    setSending(true);
    try {
      await supabase.from("case_messages").insert({
        case_id: caseId,
        sender: "office",
        message: newMsg.trim(),
        visible_to_client: true,
      } as any);
      await logTimelineEvent(caseId, "Mensagem enviada", "Escritório enviou mensagem ao cliente", true);
      setNewMsg("");
      toast.success("Mensagem enviada!");
      onRefresh();
    } catch {
      toast.error("Erro ao enviar mensagem.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Send className="h-4 w-4 text-primary" />
              Mensagens ao Cliente
            </CardTitle>
            <CardDescription>Visíveis no portal do cliente</CardDescription>
          </div>
          <CopyStageMessageButton
            message={copyMessage}
            label="Copiar msg"
            toastLabel="Mensagem copiada!"
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div ref={scrollRef} className="max-h-64 overflow-y-auto space-y-2">
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma mensagem ainda.</p>
          ) : (
            messages.map((msg: any) => (
              <div
                key={msg.id}
                className={`p-2.5 rounded-lg text-sm max-w-[85%] ${
                  msg.sender === "office"
                    ? "bg-primary/10 ml-auto"
                    : "bg-muted mr-auto"
                }`}
              >
                <p className="text-[10px] font-medium text-muted-foreground mb-0.5">
                  {msg.sender === "office" ? "Escritório" : "Cliente"}
                </p>
                <p className="leading-relaxed">{msg.message}</p>
                <p className="text-[9px] text-muted-foreground mt-1">
                  {fmtDate(msg.created_at)}
                </p>
              </div>
            ))
          )}
        </div>
        <div className="flex gap-2">
          <Textarea
            value={newMsg}
            onChange={(e) => setNewMsg(e.target.value)}
            placeholder="Escreva uma mensagem para o cliente..."
            rows={2}
            className="text-sm flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
          />
          <Button
            size="icon"
            className="h-auto shrink-0"
            disabled={sending || !newMsg.trim()}
            onClick={sendMessage}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Add Document Row ── */
function AddDocumentRow({ caseId, onAdded }: { caseId: string; onAdded: () => void }) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");

  const handleAdd = async () => {
    const t = title.trim();
    if (!t) return;
    await supabase.from("document_requests").insert({
      case_id: caseId,
      title: t,
      is_required: false,
      status: "pendente" as const,
    });
    setTitle("");
    setAdding(false);
    onAdded();
  };

  if (!adding) {
    return (
      <Button variant="ghost" size="sm" className="w-full mt-2 text-muted-foreground" onClick={() => setAdding(true)}>
        <Plus className="h-4 w-4 mr-1.5" /> Adicionar documento
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2 mt-2">
      <Input
        placeholder="Nome do documento..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        autoFocus
        className="flex-1"
      />
      <Button size="sm" onClick={handleAdd} disabled={!title.trim()}>Adicionar</Button>
      <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setTitle(""); }}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

/* ── Internal Checklist Card ── */
function InternalChecklistCard({ caseId }: { caseId: string }) {
  const queryClient = useQueryClient();
  const [newItem, setNewItem] = useState("");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["internal-checklist", caseId],
    queryFn: async () => {
      const { data } = await supabase
        .from("internal_checklist")
        .select("*")
        .eq("case_id", caseId)
        .order("sort_order")
        .order("created_at");
      return (data as any[]) ?? [];
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["internal-checklist", caseId] });

  const addItem = async () => {
    const label = newItem.trim();
    if (!label) return;
    await supabase.from("internal_checklist").insert({
      case_id: caseId,
      label,
      sort_order: items.length,
    });
    setNewItem("");
    refresh();
  };

  const toggleItem = async (itemId: string, checked: boolean) => {
    await supabase.from("internal_checklist").update({ checked: !checked }).eq("id", itemId);
    refresh();
  };

  const deleteItem = async (itemId: string) => {
    await supabase.from("internal_checklist").delete().eq("id", itemId);
    refresh();
  };

  const completed = items.filter((i: any) => i.checked).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-primary" />
          Checklist Interno
        </CardTitle>
        <CardDescription>
          {items.length > 0 ? `${completed} de ${items.length} concluídos` : "Visível apenas para a equipe"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : (
          <>
            {items.map((item: any) => (
              <div key={item.id} className="flex items-center gap-2 group">
                <button
                  onClick={() => toggleItem(item.id, item.checked)}
                  className="shrink-0 transition-colors"
                >
                  {item.checked ? (
                    <CheckCircle className="h-4 w-4 text-primary" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
                <span className={`text-sm flex-1 ${item.checked ? "line-through text-muted-foreground" : ""}`}>
                  {item.label}
                </span>
                <button
                  onClick={() => deleteItem(item.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <Input
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                placeholder="Novo item..."
                className="text-sm h-8"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addItem();
                  }
                }}
              />
              <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={addItem} disabled={!newItem.trim()}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Case Questions Card (Formulário) ──
function CaseQuestionsCard({
  caseId,
  questions,
  answers,
  onRefresh,
}: {
  caseId: string;
  questions: Tables<"case_questions">[];
  answers: Tables<"case_answers">[];
  onRefresh: () => void;
}) {
  const answeredIds = new Set(answers.map((a) => a.question_id));
  const answeredCount = questions.filter((q) => answeredIds.has(q.id)).length;

  if (questions.length === 0) return null;

  return (
    <Collapsible defaultOpen>
      <Card>
        <CardHeader className="pb-3">
          <CollapsibleTrigger className="w-full text-left">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-primary" />
                Formulário do Cliente
              </CardTitle>
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [&[data-state=open]]:rotate-180" />
            </div>
            <CardDescription className="mt-1">
              {answeredCount} de {questions.length} pergunta(s) respondida(s)
            </CardDescription>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-3">
            {questions.map((q) => {
              const answer = answers.find((a) => a.question_id === q.id);
              return (
                <div key={q.id} className="flex items-start gap-3 p-3 rounded-lg border">
                  {answer ? (
                    <CheckCircle className="h-4 w-4 text-success mt-0.5 shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{q.question}</p>
                    {answer ? (
                      <div className="mt-1.5 bg-success/10 p-2.5 rounded-md">
                        <p className="text-sm">{answer.answer_text}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Respondido em {new Date(answer.answered_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-1">Aguardando resposta do cliente</p>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
