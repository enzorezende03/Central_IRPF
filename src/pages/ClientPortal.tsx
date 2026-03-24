import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import {
  FileText, Upload, CheckCircle, Circle, AlertTriangle, Download,
  MessageSquare, Send, Loader2, Phone, Mail, Clock, Eye,
  Home, ClipboardList, HelpCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useOfficeLogo } from "@/hooks/use-office-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { STATUS_LABELS } from "@/lib/types";
import type { Tables } from "@/integrations/supabase/types";
import type { Database } from "@/integrations/supabase/types";

type DocumentStatus = Database["public"]["Enums"]["document_status"];

const STATUS_STEPS = [
  { key: "aguardando_documentos", label: "Aguardando Documentos" },
  { key: "em_analise", label: "Em Análise" },
  { key: "em_andamento", label: "Em Andamento" },
  { key: "previa_enviada", label: "Prévia Enviada" },
  { key: "finalizado", label: "Finalizado" },
] as const;

type PortalTab = "inicio" | "documentos" | "formulario" | "mensagens";

const TAB_CONFIG: { key: PortalTab; label: string; icon: React.ReactNode }[] = [
  { key: "inicio", label: "Início", icon: <Home className="h-4 w-4" /> },
  { key: "documentos", label: "Documentos", icon: <FileText className="h-4 w-4" /> },
  { key: "formulario", label: "Formulário", icon: <HelpCircle className="h-4 w-4" /> },
  { key: "mensagens", label: "Mensagens", icon: <MessageSquare className="h-4 w-4" /> },
];

export default function ClientPortal() {
  const { token, org, slug } = useParams<{ token?: string; org?: string; slug?: string }>();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<PortalTab>("inicio");
  const [lastRead, setLastRead] = useState<string>("");

  // Build the identifier: either "org/slug" or plain token
  const identifier = org && slug ? `${org}/${slug}` : token;

  // ── Resolve token or slug → case_id ──
  const { data: caseId, isLoading: loadingToken, isError } = useQuery({
    queryKey: ["portal-token", identifier],
    queryFn: async () => {
      // Try slug first if it looks like org/slug
      if (org && slug) {
        const fullSlug = `${org}/${slug}`;
        const { data: slugData, error: slugErr } = await supabase.rpc("get_case_by_slug", { p_slug: fullSlug });
        if (!slugErr && slugData) return slugData as string;
      }
      // Fallback to token
      if (token) {
        const { data, error } = await supabase.rpc("get_case_by_token", { p_token: token });
        if (error || !data) throw new Error("Token inválido");
        return data as string;
      }
      throw new Error("Link inválido");
    },
    enabled: !!(token || (org && slug)),
    retry: false,
  });

  // ── Fetch case ──
  const { data: caseData, isLoading: loadingCase } = useQuery({
    queryKey: ["portal-case", caseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("irpf_cases")
        .select("*, clients(*)")
        .eq("id", caseId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!caseId,
  });

  // ── Fetch doc requests ──
  const { data: docRequests = [] } = useQuery({
    queryKey: ["portal-docs", caseId],
    queryFn: async () => {
      const { data } = await supabase
        .from("document_requests")
        .select("*")
        .eq("case_id", caseId!)
        .order("created_at");
      return data ?? [];
    },
    enabled: !!caseId,
  });

  // ── Fetch uploaded docs ──
  const { data: uploadedDocs = [] } = useQuery({
    queryKey: ["portal-uploaded", caseId],
    queryFn: async () => {
      const { data } = await supabase
        .from("uploaded_documents")
        .select("*")
        .eq("case_id", caseId!)
        .order("uploaded_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!caseId,
  });

  // ── Fetch questions + answers ──
  const { data: questions = [] } = useQuery({
    queryKey: ["portal-questions", caseId],
    queryFn: async () => {
      const { data } = await supabase
        .from("case_questions")
        .select("*")
        .eq("case_id", caseId!)
        .order("sort_order");
      return data ?? [];
    },
    enabled: !!caseId,
  });

  // ── Fetch form templates (for conditional config) ──
  const { data: formTemplates = [] } = useQuery({
    queryKey: ["portal-form-templates"],
    queryFn: async () => {
      const { data } = await supabase
        .from("form_question_templates")
        .select("*")
        .eq("is_active", true);
      return data ?? [];
    },
    enabled: !!caseId,
  });

  const { data: answers = [] } = useQuery({
    queryKey: ["portal-answers", caseId],
    queryFn: async () => {
      const { data } = await supabase
        .from("case_answers")
        .select("*")
        .eq("case_id", caseId!);
      return data ?? [];
    },
    enabled: !!caseId,
  });

  // ── Fetch timeline (visible to client) ──
  const { data: timeline = [] } = useQuery({
    queryKey: ["portal-timeline", caseId],
    queryFn: async () => {
      const { data } = await supabase
        .from("case_timeline")
        .select("*")
        .eq("case_id", caseId!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!caseId,
  });

  // ── Fetch deliverables ──
  const { data: deliverable } = useQuery({
    queryKey: ["portal-deliverable", caseId],
    queryFn: async () => {
      const { data } = await supabase
        .from("final_deliverables")
        .select("*")
        .eq("case_id", caseId!)
        .maybeSingle();
      return data;
    },
    enabled: !!caseId,
  });

  const { data: caseMessages = [] } = useQuery({
    queryKey: ["portal-messages", caseId],
    queryFn: async () => {
      const { data } = await supabase
        .from("case_messages")
        .select("*")
        .eq("case_id", caseId!)
        .eq("visible_to_client", true)
        .order("created_at", { ascending: true });
      return (data as any[]) ?? [];
    },
    enabled: !!caseId,
  });

  // Track unread messages using localStorage
  const storageKey = `portal-last-read-${caseId ?? "none"}`;

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey) ?? "";
      setLastRead(stored);
    } catch { /* ignore */ }
  }, [storageKey]);

  const officeMessages = caseMessages.filter((m: any) => m.sender === "office");
  const msgBadge = officeMessages.filter((m: any) => !lastRead || m.created_at > lastRead).length;

  useEffect(() => {
    if (activeTab === "mensagens" && officeMessages.length > 0) {
      const latest = officeMessages[officeMessages.length - 1]?.created_at;
      if (latest && latest !== lastRead) {
        localStorage.setItem(storageKey, latest);
        setLastRead(latest);
      }
    }
  }, [activeTab, officeMessages, lastRead, storageKey]);

  // ── Loading / error states ──
  if (loadingToken || loadingCase) {
    return (
      <PortalShell>
        <div className="space-y-4">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </PortalShell>
    );
  }

  if (isError || !caseData) {
    return (
      <PortalShell>
        <Card className="max-w-md mx-auto">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-12 w-12 text-warning mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-2">Link inválido</h1>
            <p className="text-sm text-muted-foreground">
              Este link não é válido ou expirou. Entre em contato com seu escritório de contabilidade.
            </p>
          </CardContent>
        </Card>
      </PortalShell>
    );
  }

  const client = caseData.clients as Tables<"clients"> | null;
  const hasPreview = !!(deliverable as any)?.preview_file_url;
  const allDocsHandled = docRequests.length > 0 && docRequests.every((d) => d.status !== "pendente" && d.status !== "rejeitado");
  const allDocsApproved = docRequests.length > 0 && docRequests.every((d) => d.status === "aprovado");

  let currentStepIndex = 0;
  if (caseData.status === "finalizado") {
    currentStepIndex = 4;
  } else if (hasPreview) {
    currentStepIndex = 3;
  } else if (allDocsApproved || caseData.status === "em_andamento") {
    currentStepIndex = 2;
  } else if (allDocsHandled || caseData.status === "documentos_em_analise") {
    currentStepIndex = 1;
  }

  const isPendencia = caseData.status === "pendencia";
  const isFinished = caseData.status === "finalizado";
  const answeredIds = new Set(answers.map((a) => a.question_id));
  const unansweredQuestions = questions.filter((q) => !answeredIds.has(q.id));
  const pendingDocs = docRequests.filter((d) => d.status === "pendente");
  const rejectedDocs = docRequests.filter((d) => d.status === "rejeitado");
  const hasPendencies = pendingDocs.length > 0 || unansweredQuestions.length > 0 || rejectedDocs.length > 0;

  const docBadge = pendingDocs.length + rejectedDocs.length;
  const formBadge = unansweredQuestions.length;

  return (
    <PortalShell>
      <div className="space-y-4">
        {/* ── Compact Header ── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-center px-2">
            <p className="text-lg font-bold">Olá, {client?.full_name?.split(" ")[0] ?? "Cliente"}!</p>
            <p className="text-xs text-muted-foreground">
              IRPF {caseData.tax_year} · Ano-base {caseData.base_year}
            </p>
          </div>
        </motion.div>

        {/* ── Tab Navigation (sticky) ── */}
        <div className="sticky top-[88px] z-20 bg-background/95 backdrop-blur-sm pb-2 pt-1 -mx-4 px-4 border-b">
          <div className="flex gap-1">
            {TAB_CONFIG.map((tab) => {
              const badge = tab.key === "documentos" ? docBadge : tab.key === "formulario" ? formBadge : tab.key === "mensagens" ? msgBadge : 0;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg text-[11px] font-medium transition-colors relative ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                  {badge > 0 && (
                    <span className={`absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${
                      isActive ? "bg-destructive text-destructive-foreground" : "bg-destructive text-destructive-foreground"
                    }`}>
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Tab Content ── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === "inicio" && (
              <div className="space-y-4">
                {/* Status Progress */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Andamento do IRPF</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-1 mb-1">
                      {STATUS_STEPS.map((step, i) => {
                        const isActive = !isPendencia && i <= currentStepIndex;
                        const isCurrent = i === currentStepIndex && !isPendencia;
                        return (
                          <div key={step.key} className="flex-1">
                            <div className={`h-2 rounded-full transition-colors ${isActive ? "bg-primary" : "bg-muted"}`} />
                            <p className={`text-[9px] mt-1 text-center leading-tight ${isCurrent ? "font-semibold text-primary" : "text-muted-foreground"}`}>
                              {step.label}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                    {isPendencia && (
                      <div className="mt-3 flex items-center gap-2 text-destructive bg-destructive/10 p-2.5 rounded-lg">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <p className="text-xs font-medium">Existem pendências que precisam da sua atenção.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Client message */}
                {caseData.client_message && (
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-2.5">
                        <MessageSquare className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <p className="text-sm leading-relaxed">{caseData.client_message}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Quick actions / pendencies */}
                {hasPendencies && !isFinished && (
                  <PendenciesCard
                    pendingDocs={pendingDocs}
                    rejectedDocs={rejectedDocs}
                    unansweredQuestions={unansweredQuestions}
                    docBadge={docBadge}
                    formBadge={formBadge}
                    onGoToDocs={() => setActiveTab("documentos")}
                    onGoToForm={() => setActiveTab("formulario")}
                  />
                )}

                {/* Preview Approval */}
                {deliverable && (deliverable as any).preview_file_url && (
                  <PreviewApprovalCard
                    deliverable={deliverable}
                    caseId={caseId!}
                    onSuccess={() => {
                      queryClient.invalidateQueries({ queryKey: ["portal-deliverable", caseId] });
                      queryClient.invalidateQueries({ queryKey: ["portal-timeline", caseId] });
                      queryClient.invalidateQueries({ queryKey: ["portal-case", caseId] });
                    }}
                  />
                )}

                {/* Final Deliverables */}
                {deliverable && deliverable.sent_to_client && (
                  <Card className="border-success/40">
                    <CardContent className="p-5 text-center">
                      <CheckCircle className="h-10 w-10 text-success mx-auto mb-2" />
                      <h2 className="text-base font-bold mb-1">Declaração Finalizada! 🎉</h2>
                      <p className="text-xs text-muted-foreground mb-4">
                        Sua declaração de IRPF {caseData.tax_year} foi concluída com sucesso.
                      </p>
                      <div className="flex flex-col gap-2">
                        {deliverable.irpf_file_url && (
                          <Button size="sm" asChild>
                            <a href={deliverable.irpf_file_url} target="_blank" rel="noopener noreferrer">
                              <Download className="h-4 w-4 mr-2" /> Baixar Declaração
                            </a>
                          </Button>
                        )}
                        {deliverable.receipt_file_url && (
                          <Button variant="outline" size="sm" asChild>
                            <a href={deliverable.receipt_file_url} target="_blank" rel="noopener noreferrer">
                              <Download className="h-4 w-4 mr-2" /> Baixar Recibo de Entrega
                            </a>
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Footer */}
                <div className="text-center py-4 space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Em caso de dúvidas, entre em contato com o escritório.
                  </p>
                  <p className="text-[10px] text-muted-foreground/60">Central IRPF 2026 · Portal do Cliente</p>
                </div>
              </div>
            )}

            {activeTab === "documentos" && (
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Documentos Solicitados</CardTitle>
                    <CardDescription className="text-xs">
                      Envie os documentos abaixo para darmos andamento à sua declaração.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {docRequests.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">Nenhum documento solicitado no momento.</p>
                    ) : (
                      docRequests.map((doc) => (
                        <DocumentRow
                          key={doc.id}
                          doc={doc}
                          caseId={caseId!}
                          clientId={client?.id}
                          uploadedDocs={uploadedDocs.filter((u) => u.document_request_id === doc.id)}
                          onSuccess={() => {
                            queryClient.invalidateQueries({ queryKey: ["portal-uploaded", caseId] });
                            queryClient.invalidateQueries({ queryKey: ["portal-docs", caseId] });
                            queryClient.invalidateQueries({ queryKey: ["portal-case", caseId] });
                          }}
                        />
                      ))
                    )}
                  </CardContent>
                </Card>

                {uploadedDocs.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Documentos Já Enviados</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1.5">
                      {uploadedDocs.map((doc) => (
                        <div key={doc.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-muted/50">
                          <CheckCircle className="h-3.5 w-3.5 text-success shrink-0" />
                          <span className="text-xs flex-1 truncate">{doc.file_name}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(doc.uploaded_at).toLocaleDateString("pt-BR")}
                          </span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {activeTab === "formulario" && (
              <div className="space-y-4">
                {questions.length === 0 ? (
                  <Card>
                    <CardContent className="p-6 text-center">
                      <CheckCircle className="h-8 w-8 text-success mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Nenhuma pergunta pendente no momento.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Perguntas do Escritório</CardTitle>
                      <CardDescription className="text-xs">Responda as perguntas abaixo para auxiliar na sua declaração.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {questions.map((q) => {
                        const answer = answers.find((a) => a.question_id === q.id);
                        const template = formTemplates.find((t) => t.question === q.question);
                        return (
                          <QuestionRow
                            key={q.id}
                            question={q}
                            answer={answer ?? null}
                            caseId={caseId!}
                            template={template ?? null}
                            onSuccess={() => {
                              queryClient.invalidateQueries({ queryKey: ["portal-answers", caseId] });
                              queryClient.invalidateQueries({ queryKey: ["portal-case", caseId] });
                            }}
                          />
                        );
                      })}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {activeTab === "mensagens" && (
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-primary" />
                      Mensagens
                    </CardTitle>
                    <CardDescription className="text-xs">Converse com o escritório sobre sua declaração.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {caseMessages.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        Nenhuma mensagem ainda. Envie uma mensagem abaixo caso tenha dúvidas.
                      </p>
                    )}
                    <div className="max-h-[50vh] overflow-y-auto space-y-2">
                      {caseMessages.map((msg: any) => (
                        <div
                          key={msg.id}
                          className={`p-2.5 rounded-lg text-xs ${
                            msg.sender === "office" ? "bg-primary/5 border border-primary/10" : "bg-muted ml-4"
                          }`}
                        >
                          <p className="leading-relaxed">{msg.message}</p>
                          <p className="text-[9px] text-muted-foreground mt-1">
                            {msg.sender === "office" ? "Escritório" : "Você"} · {new Date(msg.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      ))}
                    </div>
                    <PortalReplyBox caseId={caseId!} onSent={() => queryClient.invalidateQueries({ queryKey: ["portal-messages", caseId] })} />
                  </CardContent>
                </Card>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </PortalShell>
  );
}
// ── Pendencies Card ──
function PendenciesCard({
  pendingDocs,
  rejectedDocs,
  unansweredQuestions,
  docBadge,
  formBadge,
  onGoToDocs,
  onGoToForm,
}: {
  pendingDocs: any[];
  rejectedDocs: any[];
  unansweredQuestions: any[];
  docBadge: number;
  formBadge: number;
  onGoToDocs: () => void;
  onGoToForm: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  // Build all items into a single list
  const allItems: { id: string; type: "pending" | "rejected" | "question"; label: string }[] = [];
  pendingDocs.forEach((d) => allItems.push({ id: d.id, type: "pending", label: d.title }));
  rejectedDocs.forEach((d) => allItems.push({ id: d.id, type: "rejected", label: d.title }));
  unansweredQuestions.forEach((q) => allItems.push({ id: q.id, type: "question", label: q.question }));

  const totalCount = allItems.length;
  const visibleItems = expanded ? allItems : allItems.slice(0, 3);
  const hiddenCount = totalCount - 3;

  return (
    <Card className="border-warning/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning" />
          O que ainda falta
          <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0 font-bold border-warning/50 text-warning">
            {totalCount}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1.5">
          {visibleItems.map((item) => (
            <li key={item.id} className={`flex items-center gap-2 text-xs ${item.type === "rejected" ? "text-destructive" : ""}`}>
              {item.type === "rejected" ? (
                <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
              ) : (
                <Circle className="h-2.5 w-2.5 text-warning shrink-0" />
              )}
              <span>
                {item.type === "pending" ? "Enviar" : item.type === "rejected" ? "Reenviar" : "Responder"}:{" "}
                <strong>{item.label}</strong>
              </span>
            </li>
          ))}
        </ul>
        {hiddenCount > 0 && !expanded && (
          <button
            onClick={() => setExpanded(true)}
            className="text-xs text-primary font-medium mt-2 hover:underline"
          >
            Ver mais {hiddenCount} {hiddenCount === 1 ? "item" : "itens"} pendentes
          </button>
        )}
        {expanded && hiddenCount > 0 && (
          <button
            onClick={() => setExpanded(false)}
            className="text-xs text-muted-foreground font-medium mt-2 hover:underline"
          >
            Ver menos
          </button>
        )}
        <div className="flex gap-2 mt-3">
          {docBadge > 0 && (
            <Button size="sm" variant="outline" className="flex-1 text-xs h-8" onClick={onGoToDocs}>
              <FileText className="h-3.5 w-3.5 mr-1" /> Documentos ({docBadge})
            </Button>
          )}
          {formBadge > 0 && (
            <Button size="sm" variant="outline" className="flex-1 text-xs h-8" onClick={onGoToForm}>
              <HelpCircle className="h-3.5 w-3.5 mr-1" /> Formulário ({formBadge})
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PortalShell({ children }: { children: React.ReactNode }) {
  const logoUrl = useOfficeLogo();
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex flex-col items-center gap-2">
          <img src={logoUrl} alt="Logo do Escritório" className="h-20 w-20 rounded-lg object-contain" />
          <div className="text-center">
            <h1 className="text-base font-bold">Central IRPF 2026</h1>
            <p className="text-[11px] text-muted-foreground">Portal do Cliente</p>
          </div>
        </div>
      </header>
      <div className="max-w-2xl mx-auto px-4 py-6 pb-12">{children}</div>
    </div>
  );
}

// ── Preview Approval Card ──
function PreviewApprovalCard({
  deliverable,
  caseId,
  onSuccess,
}: {
  deliverable: Tables<"final_deliverables">;
  caseId: string;
  onSuccess: () => void;
}) {
  const [feedback, setFeedback] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const del = deliverable as any;

  const previewStatus = del.preview_status as string;
  const isApproved = previewStatus === "aprovado";
  const isAdjustments = previewStatus === "ajustes_solicitados";

  const handleApprove = async () => {
    setSubmitting(true);
    try {
      await supabase.from("final_deliverables").update({
        preview_status: "aprovado",
        preview_feedback: null,
      } as any).eq("id", deliverable.id);
      await supabase.from("case_timeline").insert({
        case_id: caseId,
        event_type: "Prévia aprovada",
        description: "Cliente aprovou a prévia da declaração",
        visible_to_client: true,
        created_by: "Cliente",
      });
      toast.success("Prévia aprovada com sucesso!");
      onSuccess();
    } catch {
      toast.error("Erro ao aprovar.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestAdjustments = async () => {
    if (!feedback.trim()) {
      toast.error("Descreva os ajustes necessários.");
      return;
    }
    setSubmitting(true);
    try {
      await supabase.from("final_deliverables").update({
        preview_status: "ajustes_solicitados",
        preview_feedback: feedback.trim(),
      } as any).eq("id", deliverable.id);
      await supabase.from("case_timeline").insert({
        case_id: caseId,
        event_type: "Ajustes solicitados",
        description: `Cliente solicitou ajustes: ${feedback.trim()}`,
        visible_to_client: true,
        created_by: "Cliente",
      });
      toast.success("Solicitação de ajustes enviada!");
      setShowFeedback(false);
      setFeedback("");
      onSuccess();
    } catch {
      toast.error("Erro ao enviar solicitação.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className={`border-primary/30 ${isApproved ? "border-success/40" : isAdjustments ? "border-warning/40" : ""}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Eye className="h-4 w-4 text-primary" />
          Prévia da Declaração
        </CardTitle>
        <CardDescription>
          {isApproved
            ? "Você aprovou esta prévia. O escritório dará andamento à versão final."
            : isAdjustments
              ? "Ajustes solicitados. O escritório enviará uma nova versão."
              : "Verifique a prévia da sua declaração e aprove ou solicite ajustes."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button variant="outline" className="w-full justify-start" asChild>
          <a href={del.preview_file_url} target="_blank" rel="noopener noreferrer">
            <Download className="h-4 w-4 mr-2" /> Visualizar Prévia da Declaração
          </a>
        </Button>

        {isApproved && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 text-success">
            <CheckCircle className="h-5 w-5 shrink-0" />
            <p className="text-sm font-medium">Prévia aprovada</p>
          </div>
        )}

        {isAdjustments && del.preview_feedback && (
          <div className="p-3 rounded-lg bg-warning/10 border border-warning/30">
            <p className="text-xs font-medium text-warning mb-1">Seus ajustes solicitados:</p>
            <p className="text-sm">{del.preview_feedback}</p>
          </div>
        )}

        {!isApproved && (
          <div className="flex flex-col gap-2">
            <Button
              onClick={handleApprove}
              disabled={submitting}
              className="w-full"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              Aprovar Prévia
            </Button>

            {!showFeedback ? (
              <Button
                variant="outline"
                onClick={() => setShowFeedback(true)}
                className="w-full"
              >
                <AlertTriangle className="h-4 w-4 mr-2" /> Solicitar Ajustes
              </Button>
            ) : (
              <div className="space-y-2">
                <Textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Descreva os ajustes necessários..."
                  rows={3}
                  className="text-sm"
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setShowFeedback(false); setFeedback(""); }}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleRequestAdjustments}
                    disabled={submitting}
                    className="flex-1"
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                    Enviar
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Document Row ──
import { validateFile, getAcceptString, uploadFileToBucket, buildStoragePath, MAX_FILE_SIZE_LABEL, ALLOWED_EXTENSIONS_LABEL } from "@/lib/upload-utils";

function DocumentRow({
  doc,
  caseId,
  clientId,
  uploadedDocs,
  onSuccess,
}: {
  doc: Tables<"document_requests">;
  caseId: string;
  clientId?: string;
  uploadedDocs: Tables<"uploaded_documents">[];
  onSuccess: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [markingNotHave, setMarkingNotHave] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);

  const checkAllDocsComplete = async () => {
    const { data: remaining } = await supabase
      .from("document_requests")
      .select("id")
      .eq("case_id", caseId)
      .in("status", ["pendente", "rejeitado"]);
    if (remaining && remaining.length === 0) {
      // Check if we already logged this event to avoid duplicates
      const { data: existing } = await supabase
        .from("case_timeline")
        .select("id")
        .eq("case_id", caseId)
        .eq("event_type", "Documentação completa")
        .limit(1);
      if (!existing || existing.length === 0) {
        await supabase.from("case_timeline").insert({
          case_id: caseId,
          event_type: "Documentação completa",
          description: "Cliente concluiu o envio de toda a documentação solicitada",
          visible_to_client: true,
          created_by: "Cliente",
        });
      }
    }
  };

  const handleNotHave = async () => {
    setMarkingNotHave(true);
    try {
      await supabase
        .from("document_requests")
        .update({ status: "enviado" as DocumentStatus, category: "nao_possui" })
        .eq("id", doc.id);
      await supabase.from("case_timeline").insert({
        case_id: caseId,
        event_type: "Documento marcado como não possui",
        description: `Cliente informou que não possui "${doc.title}"`,
        visible_to_client: true,
        created_by: "Cliente",
      });
      toast.success(`Documento "${doc.title}" marcado como "Não tenho".`);
      await checkAllDocsComplete();
      onSuccess();
    } catch {
      toast.error("Erro ao marcar documento. Tente novamente.");
    } finally {
      setMarkingNotHave(false);
    }
  };

  const statusIcon = {
    pendente: <Circle className="h-5 w-5 text-muted-foreground shrink-0" />,
    enviado: <Clock className="h-5 w-5 text-info shrink-0" />,
    aprovado: <CheckCircle className="h-5 w-5 text-success shrink-0" />,
    rejeitado: <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />,
  } satisfies Record<DocumentStatus, React.ReactNode>;

  const statusLabel = {
    pendente: "Pendente",
    enviado: "Enviado — Em análise",
    aprovado: "Aprovado ✓",
    rejeitado: "Rejeitado — Reenvie o documento",
  } satisfies Record<DocumentStatus, string>;

  const canUpload = doc.status === "pendente" || doc.status === "rejeitado";

  const handleStageFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      const validationError = validateFile(file);
      if (validationError) {
        toast.error(validationError);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
    }

    setStagedFiles((prev) => [...prev, ...Array.from(files)]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemoveStaged = (index: number) => {
    setStagedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSendFiles = async () => {
    if (stagedFiles.length === 0) return;
    setUploading(true);
    try {
      for (const file of stagedFiles) {
        const filePath = buildStoragePath(caseId, file.name, doc.id);
        const fileUrl = await uploadFileToBucket("documentos_clientes", filePath, file);

        const { error: insertError } = await supabase.from("uploaded_documents").insert({
          case_id: caseId,
          document_request_id: doc.id,
          client_id: clientId ?? null,
          file_name: file.name,
          file_url: fileUrl,
          file_type: file.type || null,
          uploaded_by: "client",
        });
        if (insertError) throw insertError;
      }

      await supabase.from("document_requests").update({ status: "enviado" as DocumentStatus }).eq("id", doc.id);

      await supabase.from("case_timeline").insert({
        case_id: caseId,
        event_type: "Documento enviado",
        description: `Cliente enviou "${doc.title}" (${stagedFiles.length} arquivo(s))`,
        visible_to_client: true,
        created_by: "Cliente",
      });

      toast.success(`✅ Documento "${doc.title}" enviado com sucesso!`);
      setStagedFiles([]);
      await checkAllDocsComplete();
      onSuccess();
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao enviar documento. Verifique sua conexão e tente novamente.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border transition-colors ${
      doc.status === "rejeitado" ? "border-destructive/30 bg-destructive/5" :
      doc.status === "aprovado" ? "border-success/30 bg-success/5" :
      "hover:bg-muted/50"
    }`}>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {statusIcon[doc.status]}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${doc.status === "aprovado" ? "line-through text-muted-foreground" : ""}`}>
            {doc.title}
          </p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-[10px] text-muted-foreground">
              {doc.category === "nao_possui" ? "Informado — Não possuo" : statusLabel[doc.status]}
            </span>
            {doc.is_required && (
              <Badge variant="outline" className="text-[10px] px-1 py-0">Obrigatório</Badge>
            )}
            {doc.category && (
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{doc.category}</span>
            )}
          </div>
          {uploadedDocs.length > 0 && (
            <div className="mt-1.5 space-y-1">
              {uploadedDocs.map((ud) => (
                <div key={ud.id} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <CheckCircle className="h-3 w-3 text-success shrink-0" />
                  <span className="truncate">{ud.file_name}</span>
                  <span>· {new Date(ud.uploaded_at).toLocaleDateString("pt-BR")}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {canUpload && (
        <div className="w-full flex flex-col gap-1">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            multiple
            accept={getAcceptString()}
            onChange={handleStageFiles}
          />
          <div className="flex gap-2 w-full">
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8 flex-1"
              disabled={uploading || markingNotHave}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5 mr-1" /> Anexar Arquivo
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8 border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground flex-1 font-medium"
              disabled={uploading || markingNotHave}
              onClick={handleNotHave}
            >
              {markingNotHave ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5 mr-1" />
              )}
              Não Tenho
            </Button>
          </div>
          {stagedFiles.length > 0 && (
            <div className="w-full space-y-1.5 mt-1">
              {stagedFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-[11px] bg-muted/60 rounded px-2 py-1">
                  <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">{f.name}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveStaged(i)}
                    className="text-destructive hover:text-destructive/80 text-xs font-medium"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <Button
                size="sm"
                className="w-full text-xs h-8 mt-1"
                disabled={uploading}
                onClick={handleSendFiles}
              >
                {uploading ? (
                  <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Enviando...</>
                ) : (
                  <><Send className="h-3.5 w-3.5 mr-1" /> Enviar {stagedFiles.length} arquivo{stagedFiles.length > 1 ? "s" : ""}</>
                )}
              </Button>
            </div>
          )}
          <p className="text-[9px] text-muted-foreground text-center w-full">
            Máx. {MAX_FILE_SIZE_LABEL} · {ALLOWED_EXTENSIONS_LABEL}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Question Row ──
function QuestionRow({
  question,
  answer,
  caseId,
  template,
  onSuccess,
}: {
  question: Tables<"case_questions">;
  answer: Tables<"case_answers"> | null;
  caseId: string;
  template: Tables<"form_question_templates"> | null;
  onSuccess: () => void;
}) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [conditionalText, setConditionalText] = useState("");
  const [conditionalFile, setConditionalFile] = useState<File | null>(null);
  const [uploadingConditional, setUploadingConditional] = useState(false);
  const conditionalFileRef = useRef<HTMLInputElement>(null);

  const hasConditional = template?.has_conditional ?? false;
  const conditionalLabel = template?.conditional_label ?? "";
  const conditionalType = template?.conditional_type ?? "text";
  const templateOptions = (template?.options as Array<{ label: string; value: string }>) ?? [];
  const isSelect = template?.answer_type === "select";

  // For yes_no with conditional: show extra field when "Sim" is selected
  const showConditionalField = hasConditional && text === "Sim";
  // For select with conditional: show when specific option triggers it (e.g. conta_bancaria)
  const showSelectConditional = isSelect && hasConditional && text === "conta_bancaria";

  const handleSave = async () => {
    if (!text.trim()) {
      toast.error("Digite uma resposta.");
      return;
    }

    // Build full answer including conditional data
    let fullAnswer = text;
    if (showConditionalField && conditionalType === "spouse_data") {
      const parts = [text];
      if (spouseData.novoEstadoCivil) parts.push(`Estado civil: ${spouseData.novoEstadoCivil}`);
      if (spouseData.nome) parts.push(`Cônjuge: ${spouseData.nome}`);
      if (spouseData.cpf) parts.push(`CPF: ${spouseData.cpf}`);
      if (spouseData.dataNascimento) parts.push(`Nascimento: ${new Date(spouseData.dataNascimento).toLocaleDateString("pt-BR")}`);
      fullAnswer = parts.join(" — ");
    } else if (showConditionalField && conditionalType === "file") {
      // File is handled separately, just save the main answer
    } else if (showConditionalField && conditionalText.trim()) {
      fullAnswer = `${text} — ${conditionalLabel}: ${conditionalText.trim()}`;
    } else if (showSelectConditional && conditionalText.trim()) {
      const selectedLabel = templateOptions.find(o => o.value === text)?.label ?? text;
      fullAnswer = `${selectedLabel} — ${conditionalLabel}: ${conditionalText.trim()}`;
    } else if (isSelect) {
      const selectedLabel = templateOptions.find(o => o.value === text)?.label ?? text;
      fullAnswer = selectedLabel;
    }

    setSaving(true);
    try {
      // Upload conditional file if needed
      if (showConditionalField && conditionalType === "file" && conditionalFile) {
        setUploadingConditional(true);
        const validationError = validateFile(conditionalFile);
        if (validationError) {
          toast.error(validationError);
          setSaving(false);
          setUploadingConditional(false);
          return;
        }
        const filePath = buildStoragePath(caseId, conditionalFile.name, "formulario");
        const fileUrl = await uploadFileToBucket("documentos_clientes", filePath, conditionalFile);
        fullAnswer = `${text} — Arquivo: ${conditionalFile.name} (${fileUrl})`;
        setUploadingConditional(false);
      }

      const { error } = await supabase.from("case_answers").insert({
        case_id: caseId,
        question_id: question.id,
        answer_text: fullAnswer.trim(),
      });
      if (error) throw error;
      toast.success("Resposta enviada com sucesso!");
      setText("");
      setConditionalText("");
      setConditionalFile(null);
      onSuccess();
    } catch {
      toast.error("Erro ao enviar resposta. Tente novamente.");
    } finally {
      setSaving(false);
      setUploadingConditional(false);
    }
  };

  const [spouseData, setSpouseData] = useState({
    nome: "", cpf: "", dataNascimento: "", novoEstadoCivil: "",
  });

  const renderConditionalField = () => {
    if (!hasConditional) return null;

    // For yes_no questions: show when "Sim"
    if (question.answer_type === "yes_no" && text !== "Sim") return null;
    // For select questions: show when trigger value selected
    if (isSelect && !showSelectConditional) return null;

    if (conditionalType === "spouse_data") {
      return (
        <div className="mt-3 p-3 rounded-lg border border-primary/20 bg-primary/5 space-y-3">
          <p className="text-sm font-medium text-primary">{conditionalLabel}</p>
          <div className="space-y-2">
            <div>
              <label className="text-xs text-muted-foreground">Novo estado civil</label>
              <Input
                placeholder="Ex: Casado(a), Divorciado(a), Viúvo(a)..."
                value={spouseData.novoEstadoCivil}
                onChange={(e) => setSpouseData(prev => ({ ...prev, novoEstadoCivil: e.target.value }))}
                className="text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Nome completo do cônjuge</label>
              <Input
                placeholder="Nome completo"
                value={spouseData.nome}
                onChange={(e) => setSpouseData(prev => ({ ...prev, nome: e.target.value }))}
                className="text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">CPF do cônjuge</label>
              <Input
                placeholder="000.000.000-00"
                value={spouseData.cpf}
                onChange={(e) => setSpouseData(prev => ({ ...prev, cpf: e.target.value }))}
                className="text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Data de nascimento do cônjuge</label>
              <Input
                type="date"
                value={spouseData.dataNascimento}
                onChange={(e) => setSpouseData(prev => ({ ...prev, dataNascimento: e.target.value }))}
                className="text-sm"
              />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="mt-3 p-3 rounded-lg border border-primary/20 bg-primary/5 space-y-2">
        <p className="text-sm font-medium text-primary">{conditionalLabel}</p>
        {conditionalType === "file" ? (
          <div>
            <input
              ref={conditionalFileRef}
              type="file"
              className="hidden"
              accept={getAcceptString()}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  const err = validateFile(f);
                  if (err) { toast.error(err); return; }
                  setConditionalFile(f);
                }
              }}
            />
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => conditionalFileRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5 mr-1" />
              {conditionalFile ? conditionalFile.name : "Selecionar arquivo"}
            </Button>
            <p className="text-[9px] text-muted-foreground mt-1">
              Máx. {MAX_FILE_SIZE_LABEL} · {ALLOWED_EXTENSIONS_LABEL}
            </p>
          </div>
        ) : conditionalType === "address" ? (
          <Textarea
            placeholder="Rua, número, bairro, cidade, estado, CEP..."
            value={conditionalText}
            onChange={(e) => setConditionalText(e.target.value)}
            rows={3}
            className="text-sm"
          />
        ) : conditionalType === "bank_details" ? (
          <Textarea
            placeholder="Banco, agência, conta, tipo de conta..."
            value={conditionalText}
            onChange={(e) => setConditionalText(e.target.value)}
            rows={3}
            className="text-sm"
          />
        ) : (
          <Textarea
            placeholder="Digite aqui..."
            value={conditionalText}
            onChange={(e) => setConditionalText(e.target.value)}
            rows={2}
            className="text-sm"
          />
        )}
      </div>
    );
  };

  return (
    <div className="space-y-2 p-3 rounded-lg border">
      <div className="flex items-start gap-2">
        {answer ? (
          <CheckCircle className="h-4 w-4 text-success mt-0.5 shrink-0" />
        ) : (
          <Circle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        )}
        <div className="flex-1">
          <p className="text-sm font-medium">{question.question}</p>
          {question.is_required && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 mt-1">Obrigatória</Badge>
          )}
        </div>
      </div>
      {answer ? (
        <div className="ml-6 bg-success/10 p-3 rounded-md">
          <p className="text-sm">{answer.answer_text}</p>
          <p className="text-[10px] text-muted-foreground mt-1">
            Respondido em {new Date(answer.answered_at).toLocaleDateString("pt-BR")}
          </p>
        </div>
      ) : (
        <div className="ml-6 space-y-2">
          {isSelect && templateOptions.length > 0 ? (
            <div className="flex flex-col gap-2">
              {templateOptions.map((opt) => (
                <Button
                  key={opt.value}
                  variant="outline"
                  size="sm"
                  onClick={() => setText(opt.value)}
                  className={`justify-start text-left whitespace-normal h-auto py-2 ${text === opt.value ? "border-primary bg-primary/10" : ""}`}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          ) : question.answer_type === "yes_no" ? (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setText("Sim"); setConditionalText(""); setConditionalFile(null); }}
                className={text === "Sim" ? "border-primary bg-primary/10" : ""}
              >
                Sim
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setText("Não"); setConditionalText(""); setConditionalFile(null); }}
                className={text === "Não" ? "border-primary bg-primary/10" : ""}
              >
                Não
              </Button>
            </div>
          ) : question.answer_type === "number" ? (
            <Input
              type="number"
              placeholder="Digite o valor..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="text-sm"
            />
          ) : question.answer_type === "date" ? (
            <Input
              type="date"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="text-sm"
            />
          ) : (
            <Textarea
              placeholder="Digite sua resposta..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={2}
              className="text-sm"
            />
          )}

          {renderConditionalField()}

          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || !text.trim()}
            className="w-full sm:w-auto"
          >
            {saving || uploadingConditional ? (
              <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Enviando...</>
            ) : (
              <><Send className="h-3.5 w-3.5 mr-1" /> Enviar Resposta</>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Portal Reply Box ──
function PortalReplyBox({ caseId, onSent }: { caseId: string; onSent: () => void }) {
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!reply.trim()) return;
    setSending(true);
    try {
      await supabase.from("case_messages").insert({
        case_id: caseId,
        sender: "client",
        message: reply.trim(),
        visible_to_client: true,
      } as any);
      setReply("");
      toast.success("Mensagem enviada!");
      onSent();
    } catch {
      toast.error("Erro ao enviar mensagem.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex gap-2 mt-2">
      <Input
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        placeholder="Responder ao escritório..."
        className="text-sm"
        onKeyDown={(e) => e.key === "Enter" && send()}
      />
      <Button size="sm" disabled={sending || !reply.trim()} onClick={send}>
        <Send className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
