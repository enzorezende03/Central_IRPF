import { useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowLeft, Copy, MessageCircle, CheckCircle, Circle, FileText, Clock,
  User, Mail, Phone, DollarSign, ExternalLink, Upload, Send, Eye,
  AlertCircle, Calendar, CreditCard, Save, RefreshCw, Download,
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
import { STATUS_LABELS, BILLING_LABELS, PRIORITY_LABELS } from "@/lib/types";
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

  // ── Local state ──
  const [internalNotes, setInternalNotes] = useState<string | null>(null);
  const [clientMessage, setClientMessage] = useState<string | null>(null);

  const notesValue = internalNotes ?? caseData?.internal_notes ?? "";
  const messageValue = clientMessage ?? caseData?.client_message ?? "";

  // ── Mutations ──
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["case-detail", id] });
    queryClient.invalidateQueries({ queryKey: ["doc-requests", id] });
    queryClient.invalidateQueries({ queryKey: ["case-billing", id] });
    queryClient.invalidateQueries({ queryKey: ["case-timeline", id] });
    queryClient.invalidateQueries({ queryKey: ["case-deliverable", id] });
    queryClient.invalidateQueries({ queryKey: ["irpf-cases"] });
  };

  const saveNotes = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("irpf_cases")
        .update({ internal_notes: notesValue, client_message: messageValue })
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
    onSuccess: () => {
      toast.success("Status atualizado!");
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
      queryClient.invalidateQueries({ queryKey: ["doc-requests", id] });
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
  const portalUrl = getPortalUrl(caseData.portal_token);
  const whatsappMsg = `Olá, ${client?.full_name ?? "Cliente"}. Para darmos andamento ao seu IRPF, envie seus documentos e responda as pendências neste link: ${portalUrl}`;

  const answeredIds = new Set(answers.map((a) => a.question_id));
  const unansweredCount = questions.filter((q) => !answeredIds.has(q.id)).length;
  const approvedDocs = docRequests.filter((d) => d.status === "aprovado").length;
  const pendingDocs = docRequests.filter((d) => d.status === "pendente").length;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  return (
    <InternalLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* ── 1. Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <Link to="/">
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

        {/* ── 2. Progress ── */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm font-semibold">Progresso Geral</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {approvedDocs} de {docRequests.length} documentos aprovados
                  {unansweredCount > 0 && ` · ${unansweredCount} pergunta(s) sem resposta`}
                  {pendingDocs > 0 && ` · ${pendingDocs} documento(s) pendente(s)`}
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
                <Button variant="outline" size="sm" onClick={() => copyToClipboard(portalUrl, "Link")}>
                  <Copy className="h-3.5 w-3.5 mr-1.5" /> Copiar Link
                </Button>
                <Button variant="outline" size="sm" onClick={() => copyToClipboard(whatsappMsg, "Mensagem WhatsApp")}>
                  <MessageCircle className="h-3.5 w-3.5 mr-1.5" /> WhatsApp
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href={portalUrl} target="_blank" rel="noopener noreferrer">
                    <Eye className="h-3.5 w-3.5 mr-1.5" /> Abrir
                  </a>
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
              <CardContent className="space-y-1">
                {docRequests.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Nenhum documento solicitado.</p>
                ) : (
                  docRequests.map((doc) => {
                    const uploaded = uploadedDocs.find((u) => u.document_request_id === doc.id);
                    return (
                      <div key={doc.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                        {doc.status === "aprovado" ? (
                          <CheckCircle className="h-5 w-5 text-success shrink-0" />
                        ) : doc.status === "enviado" ? (
                          <AlertCircle className="h-5 w-5 text-info shrink-0" />
                        ) : doc.status === "rejeitado" ? (
                          <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
                        ) : (
                          <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${doc.status === "aprovado" ? "text-muted-foreground line-through" : "font-medium"}`}>
                            {doc.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {doc.category && (
                              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{doc.category}</span>
                            )}
                            {doc.is_required && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0">Obrigatório</Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {doc.status === "pendente" && uploaded && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs h-7"
                              onClick={() => updateDocStatus.mutate({ docId: doc.id, status: "aprovado" })}
                            >
                              <CheckCircle className="h-3.5 w-3.5 mr-1" /> Aprovar
                            </Button>
                          )}
                          {doc.status === "enviado" && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs h-7"
                                onClick={() => updateDocStatus.mutate({ docId: doc.id, status: "aprovado" })}
                              >
                                <CheckCircle className="h-3.5 w-3.5 mr-1" /> Aprovar
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs h-7 text-destructive"
                                onClick={() => updateDocStatus.mutate({ docId: doc.id, status: "rejeitado" })}
                              >
                                Rejeitar
                              </Button>
                            </>
                          )}
                          {doc.status === "rejeitado" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs h-7"
                              onClick={() => updateDocStatus.mutate({ docId: doc.id, status: "pendente" })}
                            >
                              <RefreshCw className="h-3.5 w-3.5 mr-1" /> Solicitar novamente
                            </Button>
                          )}
                          {uploaded && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                              <a href={uploaded.file_url} target="_blank" rel="noopener noreferrer">
                                <Eye className="h-3.5 w-3.5" />
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            {/* ── 5. Questions ── */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-primary" />
                  Questionário Complementar
                </CardTitle>
                <CardDescription>
                  {questions.length - unansweredCount} respondidas · {unansweredCount} pendentes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {questions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Nenhuma pergunta cadastrada.</p>
                ) : (
                  questions.map((q) => {
                    const answer = answers.find((a) => a.question_id === q.id);
                    return (
                      <div key={q.id} className="p-3 rounded-lg border space-y-2">
                        <div className="flex items-start gap-2">
                          {answer ? (
                            <CheckCircle className="h-4 w-4 text-success mt-0.5 shrink-0" />
                          ) : (
                            <Circle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                          )}
                          <div className="flex-1">
                            <p className="text-sm font-medium">{q.question}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-muted-foreground uppercase">{q.answer_type}</span>
                              {q.is_required && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0">Obrigatória</Badge>
                              )}
                            </div>
                          </div>
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
                  })
                )}
              </CardContent>
            </Card>

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
                <Separator />
                {/* ── 7. Client Message ── */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Mensagem visível ao cliente
                  </p>
                  <Textarea
                    value={messageValue}
                    onChange={(e) => setClientMessage(e.target.value)}
                    placeholder="Escreva uma mensagem que o cliente verá no portal..."
                    rows={3}
                    className="text-sm"
                  />
                </div>
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

            {/* ── 9. Final Deliverables ── */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Download className="h-4 w-4 text-primary" />
                  Entrega Final
                </CardTitle>
                <CardDescription>Declaração e recibo de entrega</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {deliverable ? (
                  <>
                    <div className="space-y-2">
                      {deliverable.irpf_file_url ? (
                        <div className="flex items-center gap-2 p-2 rounded-lg border bg-success/5">
                          <FileText className="h-4 w-4 text-success" />
                          <span className="text-sm flex-1">Declaração IRPF</span>
                          <Button variant="ghost" size="sm" className="h-7" asChild>
                            <a href={deliverable.irpf_file_url} target="_blank" rel="noopener noreferrer">
                              <Eye className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Declaração não enviada.</p>
                      )}
                      {deliverable.receipt_file_url ? (
                        <div className="flex items-center gap-2 p-2 rounded-lg border bg-success/5">
                          <FileText className="h-4 w-4 text-success" />
                          <span className="text-sm flex-1">Recibo de Entrega</span>
                          <Button variant="ghost" size="sm" className="h-7" asChild>
                            <a href={deliverable.receipt_file_url} target="_blank" rel="noopener noreferrer">
                              <Eye className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Recibo não enviado.</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {deliverable.sent_to_client ? (
                        <Badge className="bg-success/15 text-success border-success/30">
                          <CheckCircle className="h-3 w-3 mr-1" /> Liberado ao cliente
                        </Badge>
                      ) : (
                        <Badge variant="outline">Não liberado ao cliente</Badge>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum arquivo final enviado.</p>
                )}
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
  const [status, setStatus] = useState<BillingStatusType | "">(billing?.billing_status ?? "");
  const [amount, setAmount] = useState(billing?.amount?.toString() ?? "");
  const [notes, setNotes] = useState(billing?.notes ?? "");

  // Sync when billing loads
  const currentStatus = status || billing?.billing_status || "nao_cobrado";
  const currentAmount = amount || billing?.amount?.toString() || "0";

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-muted-foreground">Status</label>
        <Select
          value={currentStatus}
          onValueChange={(v) => {
            setStatus(v as BillingStatusType);
            onUpdate({ billing_status: v as BillingStatusType });
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
      {billing?.payment_date && (
        <div>
          <label className="text-xs font-medium text-muted-foreground">Data de Pagamento</label>
          <p className="text-sm mt-1">{billing.payment_date}</p>
        </div>
      )}
      {billing?.payment_method && (
        <div>
          <label className="text-xs font-medium text-muted-foreground">Método de Pagamento</label>
          <p className="text-sm mt-1">{billing.payment_method}</p>
        </div>
      )}
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
