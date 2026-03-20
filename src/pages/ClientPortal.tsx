import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import {
  FileText, Upload, CheckCircle, Circle, AlertTriangle, Download,
  MessageSquare, Send, Loader2, Phone, Mail, Clock, Eye,
} from "lucide-react";
import { motion } from "framer-motion";
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
  { key: "aguardando_cliente", label: "Aguardando Documentos" },
  { key: "documentos_em_analise", label: "Em Análise" },
  { key: "em_andamento", label: "Em Andamento" },
  { key: "finalizado", label: "Finalizado" },
] as const;

export default function ClientPortal() {
  const { token, org, slug } = useParams<{ token?: string; org?: string; slug?: string }>();
  const queryClient = useQueryClient();

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
  const currentStepIndex = STATUS_STEPS.findIndex((s) => s.key === caseData.status);
  const isPendencia = caseData.status === "pendencia";
  const isFinished = caseData.status === "finalizado";
  const answeredIds = new Set(answers.map((a) => a.question_id));
  const unansweredQuestions = questions.filter((q) => !answeredIds.has(q.id));
  const pendingDocs = docRequests.filter((d) => d.status === "pendente");
  const rejectedDocs = docRequests.filter((d) => d.status === "rejeitado");
  const hasPendencies = pendingDocs.length > 0 || unansweredQuestions.length > 0 || rejectedDocs.length > 0;

  return (
    <PortalShell>
      <div className="space-y-6">
        {/* ── 1. Header ── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardContent className="p-6">
              <p className="text-xl font-bold mb-1">Olá, {client?.full_name ?? "Cliente"}!</p>
              <p className="text-sm text-muted-foreground">
                IRPF {caseData.tax_year} · Ano-base {caseData.base_year}
              </p>
              {caseData.client_message && (
                <div className="mt-4 p-4 rounded-lg bg-accent border border-primary/20">
                  <div className="flex items-start gap-2.5">
                    <MessageSquare className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <p className="text-sm leading-relaxed">{caseData.client_message}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Status Progress ── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Andamento do IRPF</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-1 mb-1">
                {STATUS_STEPS.map((step, i) => {
                  const isActive = !isPendencia && i <= currentStepIndex;
                  const isCurrent = i === currentStepIndex && !isPendencia;
                  return (
                    <div key={step.key} className="flex-1">
                      <div className={`h-2 rounded-full transition-colors ${isActive ? "bg-primary" : "bg-muted"}`} />
                      <p className={`text-[10px] mt-1.5 text-center leading-tight ${isCurrent ? "font-semibold text-primary" : "text-muted-foreground"}`}>
                        {step.label}
                      </p>
                    </div>
                  );
                })}
              </div>
              {isPendencia && (
                <div className="mt-3 flex items-center gap-2 text-destructive bg-destructive/10 p-3 rounded-lg">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <p className="text-sm font-medium">Existem pendências que precisam da sua atenção.</p>
                </div>
              )}
              <div className="mt-3">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Progresso geral</span>
                  <span className="font-semibold text-foreground">{caseData.progress_percent}%</span>
                </div>
                <Progress value={caseData.progress_percent} className="h-2" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ── 4. Pendencies Summary ── */}
        {hasPendencies && !isFinished && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="border-warning/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  O que ainda falta
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {pendingDocs.map((d) => (
                    <li key={d.id} className="flex items-center gap-2 text-sm">
                      <Circle className="h-3 w-3 text-warning shrink-0" />
                      <span>Enviar: <strong>{d.title}</strong></span>
                    </li>
                  ))}
                  {rejectedDocs.map((d) => (
                    <li key={d.id} className="flex items-center gap-2 text-sm text-destructive">
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      <span>Reenviar: <strong>{d.title}</strong> (documento rejeitado)</span>
                    </li>
                  ))}
                  {unansweredQuestions.map((q) => (
                    <li key={q.id} className="flex items-center gap-2 text-sm">
                      <Circle className="h-3 w-3 text-warning shrink-0" />
                      <span>Responder: <strong>{q.question}</strong></span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ── 2. Documents ── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Documentos Solicitados</CardTitle>
              <CardDescription>
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
        </motion.div>

        {/* ── 3. Questions ── */}
        {questions.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Perguntas do Escritório</CardTitle>
                <CardDescription>Responda as perguntas abaixo para auxiliar na sua declaração.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {questions.map((q) => {
                  const answer = answers.find((a) => a.question_id === q.id);
                  return (
                    <QuestionRow
                      key={q.id}
                      question={q}
                      answer={answer ?? null}
                      caseId={caseId!}
                      onSuccess={() => {
                        queryClient.invalidateQueries({ queryKey: ["portal-answers", caseId] });
                        queryClient.invalidateQueries({ queryKey: ["portal-case", caseId] });
                      }}
                    />
                  );
                })}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ── 5a. Preview Declaration (for client approval) ── */}
        {deliverable && (deliverable as any).preview_file_url && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}>
            <PreviewApprovalCard
              deliverable={deliverable}
              caseId={caseId!}
              onSuccess={() => {
                queryClient.invalidateQueries({ queryKey: ["portal-deliverable", caseId] });
                queryClient.invalidateQueries({ queryKey: ["portal-timeline", caseId] });
                queryClient.invalidateQueries({ queryKey: ["portal-case", caseId] });
              }}
            />
          </motion.div>
        )}

        {/* ── 5b. Final Deliverables ── */}
        {deliverable && deliverable.sent_to_client && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <Card className="border-success/40">
              <CardContent className="p-6 text-center">
                <CheckCircle className="h-12 w-12 text-success mx-auto mb-3" />
                <h2 className="text-lg font-bold mb-1">Declaração Finalizada! 🎉</h2>
                <p className="text-sm text-muted-foreground mb-5">
                  Sua declaração de IRPF {caseData.tax_year} foi concluída com sucesso.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  {deliverable.irpf_file_url && (
                    <Button asChild>
                      <a href={deliverable.irpf_file_url} target="_blank" rel="noopener noreferrer">
                        <Download className="h-4 w-4 mr-2" /> Baixar Declaração
                      </a>
                    </Button>
                  )}
                  {deliverable.receipt_file_url && (
                    <Button variant="outline" asChild>
                      <a href={deliverable.receipt_file_url} target="_blank" rel="noopener noreferrer">
                        <Download className="h-4 w-4 mr-2" /> Baixar Recibo de Entrega
                      </a>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ── Already sent docs ── */}
        {uploadedDocs.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Documentos Já Enviados</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {uploadedDocs.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-muted/50">
                    <CheckCircle className="h-4 w-4 text-success shrink-0" />
                    <span className="text-sm flex-1 truncate">{doc.file_name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(doc.uploaded_at).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ── 6. Footer ── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <div className="text-center py-6 space-y-2">
            <p className="text-sm text-muted-foreground">
              Em caso de dúvidas, entre em contato com o escritório.
            </p>
            <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> Telefone do escritório</span>
              <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> Email do escritório</span>
            </div>
            <p className="text-[10px] text-muted-foreground/60 mt-4">Central IRPF 2026 · Portal do Cliente</p>
          </div>
        </motion.div>
      </div>
    </PortalShell>
  );
}

// ── Shell layout ──
function PortalShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
            <FileText className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-sm font-bold">Central IRPF 2026</h1>
            <p className="text-[10px] text-muted-foreground">Portal do Cliente</p>
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

  const handleNotHave = async () => {
    setMarkingNotHave(true);
    try {
      await supabase.from("document_requests").update({ status: "enviado" as DocumentStatus }).eq("id", doc.id);
      await supabase.from("case_timeline").insert({
        case_id: caseId,
        event_type: "Documento marcado como não possui",
        description: `Cliente informou que não possui "${doc.title}"`,
        visible_to_client: true,
        created_by: "Cliente",
      });
      toast.success(`Documento "${doc.title}" marcado como "Não tenho".`);
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

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Validate all files first
    for (const file of Array.from(files)) {
      const validationError = validateFile(file);
      if (validationError) {
        toast.error(validationError);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
    }

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
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

      // Log timeline
      await supabase.from("case_timeline").insert({
        case_id: caseId,
        event_type: "Documento enviado",
        description: `Cliente enviou "${doc.title}" (${files.length} arquivo(s))`,
        visible_to_client: true,
        created_by: "Cliente",
      });

      toast.success(`✅ Documento "${doc.title}" enviado com sucesso!`);
      onSuccess();
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao enviar documento. Verifique sua conexão e tente novamente.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
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
            <span className="text-[10px] text-muted-foreground">{statusLabel[doc.status]}</span>
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
        <div className="shrink-0 flex flex-col items-end gap-1">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            multiple
            accept={getAcceptString()}
            onChange={handleUpload}
          />
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-8 w-full sm:w-auto"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Enviando...</>
            ) : (
              <><Upload className="h-3.5 w-3.5 mr-1" /> Enviar Arquivo</>
            )}
          </Button>
          <p className="text-[9px] text-muted-foreground text-right">
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
  onSuccess,
}: {
  question: Tables<"case_questions">;
  answer: Tables<"case_answers"> | null;
  caseId: string;
  onSuccess: () => void;
}) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!text.trim()) {
      toast.error("Digite uma resposta.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("case_answers").insert({
        case_id: caseId,
        question_id: question.id,
        answer_text: text.trim(),
      });
      if (error) throw error;
      toast.success("Resposta enviada com sucesso!");
      setText("");
      onSuccess();
    } catch {
      toast.error("Erro ao enviar resposta. Tente novamente.");
    } finally {
      setSaving(false);
    }
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
          {question.answer_type === "yes_no" ? (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setText("Sim"); }}
                className={text === "Sim" ? "border-primary bg-primary/10" : ""}
              >
                Sim
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setText("Não"); }}
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
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || !text.trim()}
            className="w-full sm:w-auto"
          >
            {saving ? (
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
