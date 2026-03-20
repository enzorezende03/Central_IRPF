import { useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useState, useRef } from "react";
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
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
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

  const { data: questions = [] } = useQuery({
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

  const { data: answers = [] } = useQuery({
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

  // ── Local state ──
  const [internalNotes, setInternalNotes] = useState<string | null>(null);

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
        .update({ status })
        .eq("id", id!);
      if (error) throw error;
    },
    onSuccess: async (_, status) => {
      toast.success("Status atualizado!");
      await logTimelineEvent(id!, "Status alterado", `Status alterado para ${STATUS_LABELS[status]}`, true);
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
  const linkId = caseData.portal_slug || caseData.portal_token;
  const portalUrl = getPortalUrl(linkId);
  const whatsappMsg = getWhatsAppMessage(client?.full_name ?? "Cliente", linkId, caseData.client_message);

  const answeredIds = new Set(answers.map((a) => a.question_id));
  const unansweredCount = questions.filter((q) => q.is_required && !answeredIds.has(q.id)).length;
  const approvedDocs = docRequests.filter((d) => d.is_required && d.status === "aprovado").length;
  const pendingDocs = docRequests.filter((d) => d.is_required && (d.status === "pendente" || d.status === "rejeitado")).length;

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
              CPF: {client?.cpf} · Ano-base {caseData.base_year} · Exercício {caseData.tax_year}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Select value={caseData.status} onValueChange={(v) => updateStatus.mutate(v as CaseStatus)}>
              <SelectTrigger className="w-auto gap-1 border-0 p-0 h-auto shadow-none">
                <StatusBadge status={caseData.status} />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            {billing && <BillingBadge status={billing.billing_status} />}
          </div>
        </div>

        {/* ── Info Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <InfoCard icon={User} label="Responsável" value={caseData.internal_owner ?? "Não definido"} />
          <InfoCard icon={Phone} label="Celular" value={client?.phone ?? "—"} />
          <InfoCard icon={Mail} label="E-mail" value={client?.email ?? "—"} />
          <InfoCard icon={DollarSign} label="Honorário" value={billing ? fmt(billing.amount) : "—"} />
          <InfoCard icon={Calendar} label="Criado em" value={fmtDate(caseData.created_at)} />
        </div>

        {/* ── 2. Progress (auto-calculated) ── */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm font-semibold">Progresso Geral <span className="text-[10px] font-normal text-muted-foreground ml-1">(calculado automaticamente)</span></p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {approvedDocs} de {docRequests.filter(d => d.is_required).length} docs obrigatórios aprovados
                  {unansweredCount > 0 && ` · ${unansweredCount} pergunta(s) sem resposta`}
                  {pendingDocs > 0 && ` · ${pendingDocs} documento(s) pendente(s)`}
                  {deliverable?.irpf_file_url && deliverable?.receipt_file_url && deliverable?.sent_to_client
                    ? " · ✅ Entrega finalizada"
                    : !deliverable?.irpf_file_url ? " · Declaração pendente" : !deliverable?.sent_to_client ? " · Entrega não liberada" : ""}
                </p>
              </div>
              <span className="text-2xl font-bold text-primary">{caseData.progress_percent}%</span>
            </div>
            <Progress value={caseData.progress_percent} className="h-2.5" />
          </CardContent>
        </Card>

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
              <div className="flex gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={() => copyToClipboard(portalUrl, "Link", "Link copiado", `Link do portal copiado para ${client?.full_name}`)}>
                  <Copy className="h-3.5 w-3.5 mr-1.5" /> Copiar Link
                </Button>
                <Button variant="outline" size="sm" onClick={() => copyToClipboard(whatsappMsg, "Mensagem WhatsApp", "WhatsApp copiado", `Mensagem WhatsApp copiada para ${client?.full_name}`)}>
                  <MessageCircle className="h-3.5 w-3.5 mr-1.5" /> WhatsApp
                </Button>
                <Button variant="outline" size="sm" onClick={handleOpenPortal}>
                  <Eye className="h-3.5 w-3.5 mr-1.5" /> Abrir
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Main content grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column (2/3) */}
          <div className="lg:col-span-2 space-y-6">
            {/* ── 4. Document Checklist ── */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Checklist Documental
                </CardTitle>
                <CardDescription>
                  {approvedDocs} aprovados · {pendingDocs} pendentes · {docRequests.length} total
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {docRequests.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Nenhum documento solicitado.</p>
                ) : (
                  docRequests.map((doc) => {
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
                  })
                )}
              </CardContent>
            </Card>

            {/* ── 5. Questions ── */}
            <QuestionsSection
              questions={questions}
              answers={answers}
              caseId={id!}
              onRefresh={() => {
                queryClient.invalidateQueries({ queryKey: ["case-questions", id] });
                queryClient.invalidateQueries({ queryKey: ["case-answers", id] });
                queryClient.invalidateQueries({ queryKey: ["case-timeline", id] });
              }}
            />

            {/* ── 8. Timeline ── */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  Histórico / Timeline
                </CardTitle>
              </CardHeader>
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
            </Card>
          </div>

          {/* Right column (1/3) */}
          <div className="space-y-6">
            {/* ── 6. Internal Notes ── */}
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

            {/* ── Internal Checklist ── */}
            <InternalChecklistCard caseId={id!} />

            {/* ── 7. Messages to Client ── */}
            <MessagesSection
              caseId={id!}
              messages={caseMessages}
              onRefresh={() => {
                queryClient.invalidateQueries({ queryKey: ["case-messages", id] });
                queryClient.invalidateQueries({ queryKey: ["case-timeline", id] });
              }}
            />

            {/* ── 10. Billing ── */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-primary" />
                  Cobrança
                </CardTitle>
              </CardHeader>
              <CardContent>
                <BillingBlock billing={billing} onUpdate={(updates) => updateBilling.mutate(updates)} />
              </CardContent>
            </Card>

            {/* ── 9a. Prévia ── */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Eye className="h-4 w-4 text-primary" />
                  Prévia da Declaração
                </CardTitle>
                <CardDescription>Envie a prévia para aprovação do cliente</CardDescription>
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
                <CardTitle className="text-base flex items-center gap-2">
                  <Download className="h-4 w-4 text-primary" />
                  Declaração e Recibo
                </CardTitle>
                <CardDescription>Declaração IRPF final e recibo de entrega</CardDescription>
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
        </div>
      </div>
    </InternalLayout>
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
      <div className="flex items-center gap-3">
        {statusIcon[doc.status]}
        <div className="flex-1 min-w-0">
          <p className={`text-sm ${doc.status === "aprovado" ? "text-muted-foreground line-through" : "font-medium"}`}>
            {doc.title}
          </p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {doc.category === "nao_possui" && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-warning/15 text-warning border-warning/30">
                Cliente não possui
              </Badge>
            )}
            {doc.category && doc.category !== "nao_possui" && <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{doc.category}</span>}
            {doc.is_required && <Badge variant="outline" className="text-[10px] px-1 py-0">Obrigatório</Badge>}
          </div>
        </div>
        <div className="flex gap-1 shrink-0 flex-wrap justify-end">
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
  const [uploading, setUploading] = useState<"irpf" | "receipt" | null>(null);

  const handleUpload = async (type: "irpf" | "receipt", file: File) => {
    const err = validateFile(file);
    if (err) { toast.error(err); return; }
    setUploading(type);
    const bucket = type === "irpf" ? "declaracoes_finais" : "recibos_entrega";
    try {
      const url = await uploadFileToBucket(bucket, buildStoragePath(caseId, file.name), file);
      const field = type === "irpf" ? "irpf_file_url" : "receipt_file_url";
      if (deliverable) {
        await supabase.from("final_deliverables").update({ [field]: url }).eq("id", deliverable.id);
      } else {
        await supabase.from("final_deliverables").insert({ case_id: caseId, [field]: url } as any);
      }
      const label = type === "irpf" ? "Declaração IRPF" : "Recibo de Entrega";
      await logTimelineEvent(caseId, `${label} enviada`, `Arquivo: ${file.name}`, true);
      toast.success(`${label} enviada!`);
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

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 p-2.5 rounded-lg border">
        <FileText className={`h-4 w-4 shrink-0 ${deliverable?.irpf_file_url ? "text-success" : "text-muted-foreground"}`} />
        <span className="text-sm flex-1">{deliverable?.irpf_file_url ? "Declaração IRPF Final" : "Enviar Declaração IRPF"}</span>
        {deliverable?.irpf_file_url && (
          <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
            <a href={deliverable.irpf_file_url} target="_blank" rel="noopener noreferrer"><Eye className="h-3.5 w-3.5" /></a>
          </Button>
        )}
        <input ref={irpfRef} type="file" className="hidden" accept={getAcceptString()} onChange={(e) => e.target.files?.[0] && handleUpload("irpf", e.target.files[0])} />
        <Button variant="outline" size="sm" className="h-7 text-xs" disabled={uploading === "irpf"} onClick={() => irpfRef.current?.click()}>
          {uploading === "irpf" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Upload className="h-3.5 w-3.5 mr-1" /> {deliverable?.irpf_file_url ? "Substituir" : "Upload"}</>}
        </Button>
      </div>
      <div className="flex items-center gap-2 p-2.5 rounded-lg border">
        <FileText className={`h-4 w-4 shrink-0 ${deliverable?.receipt_file_url ? "text-success" : "text-muted-foreground"}`} />
        <span className="text-sm flex-1">{deliverable?.receipt_file_url ? "Recibo de Entrega" : "Enviar Recibo de Entrega"}</span>
        {deliverable?.receipt_file_url && (
          <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
            <a href={deliverable.receipt_file_url} target="_blank" rel="noopener noreferrer"><Eye className="h-3.5 w-3.5" /></a>
          </Button>
        )}
        <input ref={receiptRef} type="file" className="hidden" accept={getAcceptString()} onChange={(e) => e.target.files?.[0] && handleUpload("receipt", e.target.files[0])} />
        <Button variant="outline" size="sm" className="h-7 text-xs" disabled={uploading === "receipt"} onClick={() => receiptRef.current?.click()}>
          {uploading === "receipt" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Upload className="h-3.5 w-3.5 mr-1" /> {deliverable?.receipt_file_url ? "Substituir" : "Upload"}</>}
        </Button>
      </div>
      {deliverable && (deliverable.irpf_file_url || deliverable.receipt_file_url) && (
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
    </div>
  );
}

// ── Questions Section with CRUD ──
import { Plus as PlusIcon } from "lucide-react";

function QuestionsSection({
  questions,
  answers,
  caseId,
  onRefresh,
}: {
  questions: Tables<"case_questions">[];
  answers: Tables<"case_answers">[];
  caseId: string;
  onRefresh: () => void;
}) {
  const [newQuestion, setNewQuestion] = useState("");
  const [newRequired, setNewRequired] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const answeredIds = new Set(answers.map((a) => a.question_id));
  const unanswered = questions.filter((q) => q.is_required && !answeredIds.has(q.id)).length;

  const addQuestion = async () => {
    if (!newQuestion.trim()) return;
    setAdding(true);
    try {
      await supabase.from("case_questions").insert({
        case_id: caseId,
        question: newQuestion.trim(),
        is_required: newRequired,
        sort_order: questions.length,
      });
      await logTimelineEvent(caseId, "Pergunta adicionada", `Pergunta: "${newQuestion.trim()}"`, true);
      setNewQuestion("");
      setNewRequired(false);
      toast.success("Pergunta adicionada!");
      onRefresh();
    } catch {
      toast.error("Erro ao adicionar pergunta.");
    } finally {
      setAdding(false);
    }
  };

  const updateQuestion = async (qId: string) => {
    if (!editText.trim()) return;
    await supabase.from("case_questions").update({ question: editText.trim() }).eq("id", qId);
    setEditingId(null);
    toast.success("Pergunta atualizada!");
    onRefresh();
  };

  const deleteQuestion = async (qId: string) => {
    await supabase.from("case_answers").delete().eq("question_id", qId);
    await supabase.from("case_questions").delete().eq("id", qId);
    toast.success("Pergunta removida!");
    onRefresh();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-primary" />
          Questionário Complementar
        </CardTitle>
        <CardDescription>
          {questions.length - unanswered} respondidas · {unanswered} pendentes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {questions.map((q) => {
          const answer = answers.find((a) => a.question_id === q.id);
          const isEditing = editingId === q.id;
          return (
            <div key={q.id} className="p-3 rounded-lg border space-y-2">
              <div className="flex items-start gap-2">
                {answer ? (
                  <CheckCircle className="h-4 w-4 text-success mt-0.5 shrink-0" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <div className="flex gap-2">
                      <Input
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="text-sm h-8"
                        onKeyDown={(e) => e.key === "Enter" && updateQuestion(q.id)}
                      />
                      <Button size="sm" className="h-8 text-xs" onClick={() => updateQuestion(q.id)}>Salvar</Button>
                      <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setEditingId(null)}>Cancelar</Button>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm font-medium">{q.question}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground uppercase">{q.answer_type}</span>
                        {q.is_required && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0">Obrigatória</Badge>
                        )}
                      </div>
                    </>
                  )}
                </div>
                {!isEditing && (
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => { setEditingId(q.id); setEditText(q.question); }}
                    >
                      <FileText className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => deleteQuestion(q.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
              {answer ? (
                <div className="ml-6 bg-success/10 p-2 rounded-md">
                  <p className="text-sm">{answer.answer_text ?? "Respondida"}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Respondido em {fmtDate(answer.answered_at)}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic ml-6">Aguardando resposta do cliente</p>
              )}
            </div>
          );
        })}

        {/* Add new question */}
        <div className="p-3 rounded-lg border border-dashed space-y-2">
          <Input
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            placeholder="Digite uma nova pergunta..."
            className="text-sm"
            onKeyDown={(e) => e.key === "Enter" && addQuestion()}
          />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={newRequired}
                onChange={(e) => setNewRequired(e.target.checked)}
                className="rounded"
              />
              Obrigatória
            </label>
            <Button size="sm" className="h-7 text-xs" disabled={adding || !newQuestion.trim()} onClick={addQuestion}>
              <PlusIcon className="h-3 w-3 mr-1" />
              {adding ? "Adicionando..." : "Adicionar Pergunta"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Messages Section (Chat) ──
function MessagesSection({
  caseId,
  messages,
  onRefresh,
}: {
  caseId: string;
  messages: any[];
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
        <CardTitle className="text-base flex items-center gap-2">
          <Send className="h-4 w-4 text-primary" />
          Mensagens ao Cliente
        </CardTitle>
        <CardDescription>Visíveis no portal do cliente</CardDescription>
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
