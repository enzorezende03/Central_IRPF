import { useParams, Link } from "react-router-dom";
import { formatCPF, formatPhone } from "@/lib/format-utils";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useState, useRef, useCallback, useEffect } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import {
  ArrowLeft, Copy, MessageCircle, CheckCircle, Circle, FileText, Clock,
  User, Mail, Phone, DollarSign, ExternalLink, Upload, Send, Eye,
  AlertCircle, Calendar, CreditCard, Save, RefreshCw, Download, Loader2, Trash2,
  Plus, X, ListChecks, Lock, Bell, BellRing, Check,
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

import { getPortalUrl, getWhatsAppMessage, getPendingDocsMessage, logTimelineEvent, getPaymentGuideMessage, buildWhatsAppLink, buildMailtoLink } from "@/lib/portal-utils";
import { PendenciasCard } from "@/components/PendenciasCard";
import { BulkUploadDialog } from "@/components/BulkUploadDialog";
import { useAuth } from "@/hooks/use-auth";
import { validateFile, getAcceptString, uploadFileToBucket, buildStoragePath, MAX_FILE_SIZE_LABEL, ALLOWED_EXTENSIONS_LABEL } from "@/lib/upload-utils";
import { filenameMatchesCpf, pdfContainsCpf, formatCpfMask } from "@/lib/cpf-check";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { profileName, user } = useAuth();

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
        .eq("retificacao", false)
        .maybeSingle();
      return data;
    },
    enabled: !!id,
  });

  const { data: retDeliverable } = useQuery({
    queryKey: ["case-deliverable-ret", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("final_deliverables")
        .select("*")
        .eq("case_id", id!)
        .eq("retificacao", true)
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
  const [notesMode, setNotesMode] = useState<"view" | "edit" | "append">("view");
  const [appendDraft, setAppendDraft] = useState("");
  const [showImpedirDialog, setShowImpedirDialog] = useState(false);
  const [impedirJustificativa, setImpedirJustificativa] = useState("");
  const [showDispensarDialog, setShowDispensarDialog] = useState(false);
  const [dispensarJustificativa, setDispensarJustificativa] = useState("");
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [uploadingNoteAttachment, setUploadingNoteAttachment] = useState(false);
  const noteAttachmentInputRef = useRef<HTMLInputElement>(null);
  const [showRetificarDialog, setShowRetificarDialog] = useState(false);
  const [retificacaoMotivo, setRetificacaoMotivo] = useState("");

  type NoteAttachment = { url: string; name: string; uploaded_by?: string; uploaded_at?: string };
  const noteAttachments: NoteAttachment[] = Array.isArray((caseData as any)?.notes_attachments)
    ? ((caseData as any).notes_attachments as NoteAttachment[])
    : [];

  const persistNoteAttachments = async (next: NoteAttachment[]) => {
    const { error } = await supabase
      .from("irpf_cases")
      .update({ notes_attachments: next } as any)
      .eq("id", id!);
    if (error) throw error;
  };

  const handleAddNoteAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (noteAttachmentInputRef.current) noteAttachmentInputRef.current.value = "";
    if (!files.length || !id) return;
    setUploadingNoteAttachment(true);
    try {
      const author = profileName || user?.email || "Equipe";
      const added: NoteAttachment[] = [];
      for (const file of files) {
        const err = validateFile(file);
        if (err) { toast.error(err); continue; }
        const path = buildStoragePath(id, file.name, "internal_notes");
        const url = await uploadFileToBucket("documentos_clientes", path, file);
        added.push({ url, name: file.name, uploaded_by: author, uploaded_at: new Date().toISOString() });
      }
      if (!added.length) return;
      await persistNoteAttachments([...noteAttachments, ...added]);
      await logTimelineEvent(id, "Anexo em observação", `${added.length} arquivo(s) anexado(s) às observações internas por ${author}`, false);
      toast.success(`${added.length} arquivo(s) anexado(s)!`);
      invalidateAll();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao anexar arquivo.");
    } finally {
      setUploadingNoteAttachment(false);
    }
  };

  const handleRemoveNoteAttachment = async (idx: number) => {
    if (!id) return;
    const target = noteAttachments[idx];
    if (!target) return;
    if (!confirm(`Remover o anexo "${target.name}"?`)) return;
    try {
      const next = noteAttachments.filter((_, i) => i !== idx);
      await persistNoteAttachments(next);
      const author = profileName || user?.email || "Equipe";
      await logTimelineEvent(id, "Anexo removido", `Anexo "${target.name}" removido das observações internas por ${author}`, false);
      toast.success("Anexo removido.");
      invalidateAll();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao remover anexo.");
    }
  };


  const savedNotes = caseData?.internal_notes ?? "";
  const notesValue = internalNotes ?? savedNotes;
  const hasSavedNotes = savedNotes.trim().length > 0;

  // ── Mutations ──
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["case-detail", id] });
    queryClient.invalidateQueries({ queryKey: ["doc-requests", id] });
    queryClient.invalidateQueries({ queryKey: ["case-billing", id] });
    queryClient.invalidateQueries({ queryKey: ["case-timeline", id] });
    queryClient.invalidateQueries({ queryKey: ["case-deliverable", id] });
    queryClient.invalidateQueries({ queryKey: ["case-deliverable-ret", id] });
    queryClient.invalidateQueries({ queryKey: ["case-messages", id] });
    queryClient.invalidateQueries({ queryKey: ["irpf-cases"] });
  };

  const saveNotes = useMutation({
    mutationFn: async (newValue: string) => {
      const { error } = await supabase
        .from("irpf_cases")
        .update({ internal_notes: newValue })
        .eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Notas salvas!");
      setInternalNotes(null);
      setAppendDraft("");
      setNotesMode("view");
      invalidateAll();
    },
    onError: () => toast.error("Erro ao salvar notas"),
  });

  const toggleNotesAlert = useMutation({
    mutationFn: async (active: boolean) => {
      const author = profileName || user?.email || "Equipe";
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from("irpf_cases")
        .update({
          notes_alert: active,
          notes_alert_at: active ? nowIso : null,
          notes_alert_by: active ? author : null,
          // Quando marca como visualizado (active=false), grava quem/quando viu.
          // Quando reativa o aviso, limpa o "visto" anterior.
          notes_alert_seen_at: active ? null : nowIso,
          notes_alert_seen_by: active ? null : author,
        } as any)
        .eq("id", id!);
      if (error) throw error;
      await logTimelineEvent(
        id!,
        active ? "Aviso ao responsável" : "Observação visualizada",
        active
          ? "Observação interna marcada para atenção do responsável"
          : `Observação interna visualizada por ${author}`,
        false,
      );
    },
    onSuccess: (_, active) => {
      toast.success(active ? "Responsável avisado!" : "Marcado como visualizado.");
      invalidateAll();
    },
    onError: () => toast.error("Erro ao atualizar aviso"),
  });




  const updateStatus = useMutation({
    mutationFn: async (status: CaseStatus) => {
      const { error } = await supabase
        .from("irpf_cases")
        .update({ status: status })
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
        <div className="flex items-start gap-4">
          <Link to="/demandas">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold whitespace-nowrap">{client?.full_name ?? "Cliente"}</h1>
              {(client?.tags ?? []).map((tag: string) => (
                <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
              ))}
            </div>
            <p className="text-sm text-muted-foreground whitespace-nowrap">
              CPF: {formatCPF(client?.cpf)} · Ano-base {caseData.base_year} · Exercício {caseData.tax_year}
            </p>
            <div className="flex flex-wrap gap-2 items-center">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Status:</span>
              <Select value={caseData.status} onValueChange={(v) => updateStatus.mutate(v as CaseStatus)}>
                <SelectTrigger className="w-auto gap-1 border-0 p-0 h-auto shadow-none">
                  <StatusBadge status={caseData.status as any} />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            {caseData.status !== "impedida" ? (
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
                      .update({ status: "em_andamento" })
                      .eq("id", id!);
                    if (error) {
                      toast.error("Erro ao retomar demanda");
                      return;
                    }
                    await logTimelineEvent(id!, "Impedimento resolvido", "Demanda retornou para Em Andamento manualmente pelo escritório", false);
                    toast.success("Demanda retornou para Em Andamento");
                    invalidateAll();
                  }}
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                  Reabrir
                </Button>
              </>
            )}
            {caseData.status !== "dispensada" ? (
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
                      .update({ status: "aguardando_cliente" })
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
        </div>

        {caseData.status === "dispensada" && (() => {
          const ev = (timeline as any[])
            .filter((t) => t.event_type === "Demanda dispensada")
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
          const rawDesc: string = ev?.description ?? "";
          const motivo = rawDesc
            ? (rawDesc.replace(/^\s*Motivo\s*:\s*/i, "").trim() || rawDesc)
            : (caseData.internal_notes?.trim() || "Sem justificativa registrada.");
          return (
            <div className="rounded-lg border-2 border-rose-400 bg-rose-50 p-4 text-rose-900 shadow-sm">
              <div className="flex items-start gap-3">
                <X className="h-6 w-6 mt-0.5 text-rose-600 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-base text-rose-700">Demanda dispensada</p>
                  <p className="text-xs text-rose-600/80 mb-2">
                    Justificativa registrada{ev?.created_by ? ` por ${ev.created_by}` : ""}
                    {ev?.created_at ? ` em ${new Date(ev.created_at).toLocaleString("pt-BR")}` : ""}{ev ? ":" : ""}
                  </p>
                  <p className="text-sm whitespace-pre-wrap font-medium bg-white/70 rounded p-3 border border-rose-200">
                    {motivo}
                  </p>
                  <p className="text-xs text-rose-600/70 mt-2">Todas as ações estão desativadas. Use "Reverter Dispensa" para reativar.</p>
                </div>
              </div>
            </div>
          );
        })()}


        {caseData.status === "impedida" && (() => {
          const ev = (timeline as any[]).find((t) => t.event_type === "Demanda impedida");
          const motivo = ev?.description?.replace(/^Motivo:\s*/i, "") ?? "Sem justificativa registrada.";
          return (
            <div className="rounded-lg border border-rose-300 bg-rose-50 p-4 text-rose-900">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 mt-0.5 text-rose-600 shrink-0" />
                <div className="min-w-0">
                  <p className="font-semibold text-rose-700">Demanda impedida</p>
                  <p className="text-xs text-rose-600/80 mb-1">
                    Justificativa registrada{ev?.created_by ? ` por ${ev.created_by}` : ""}
                    {ev?.created_at ? ` em ${new Date(ev.created_at).toLocaleString("pt-BR")}` : ""}:
                  </p>
                  <p className="text-sm whitespace-pre-wrap">{motivo}</p>
                </div>
              </div>
            </div>
          );
        })()}



        <div className={`${caseData.status === "dispensada" ? "opacity-50 pointer-events-none select-none" : ""}`}>

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
                {(() => {
                  const pendingList = docRequests.filter((d) => d.status === "pendente" || d.status === "rejeitado");
                  if (pendingList.length === 0) return null;
                  const msg = getPendingDocsMessage(clientName, linkId, pendingList.map((p) => ({ title: p.title, status: p.status })));
                  return (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs bg-warning/10 border-warning/40 text-warning hover:bg-warning/20"
                      onClick={() => copyToClipboard(msg, "Cobrança de documentos", "Cobrança copiada", `Mensagem de cobrança de ${pendingList.length} documento(s) copiada para ${client?.full_name}`)}
                    >
                      <Copy className="h-3.5 w-3.5 mr-1" /> Cobrar docs ({pendingList.length})
                    </Button>
                  );
                })()}
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
            {/* ── Pendências ao Cliente ── */}
            <PendenciasCard
              caseId={id!}
              clientName={caseData?.clients?.full_name}
              clientPhone={caseData?.clients?.phone}
              portalSlugOrToken={caseData?.portal_slug ?? caseData?.portal_token}
            />

            {/* ── Internal Checklist ── */}
            <InternalChecklistCard caseId={id!} />

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
                <PreviewCard
                  caseId={id!}
                  deliverable={deliverable}
                  timeline={timeline}
                  clientName={clientName}
                  portalUrl={portalUrl}
                  onRefresh={() => {
                    queryClient.invalidateQueries({ queryKey: ["case-deliverable", id] });
                    queryClient.invalidateQueries({ queryKey: ["case-timeline", id] });
                  }}
                />
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
                      {(caseData.status === "retificando" || caseData.status === "retificada") && (
                        <Badge variant="outline" className="text-xs">Original</Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      {(caseData.status === "retificando" || caseData.status === "retificada")
                        ? "Declaração original (substituída pela retificadora)"
                        : "Declaração IRPF final e recibo de entrega"}
                    </CardDescription>
                  </div>
                  <CopyStageMessageButton
                    message={`Olá!\n\nSua declaração de Imposto de Renda foi finalizada.\nAcesse pelo link da Central do IR no aplicativo ou pelo link: ${portalUrl} para conferência.\n\nEstamos à disposição para qualquer dúvida!`}
                    label="Copiar msg"
                    toastLabel="Mensagem da declaração copiada!"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <DeclarationReceiptCard
                  caseId={id!}
                  deliverable={deliverable}
                  clientCpf={caseData.clients?.cpf ?? null}
                  readOnly={caseData.status === "retificando" || caseData.status === "retificada"}
                  onRefresh={() => {
                    queryClient.invalidateQueries({ queryKey: ["case-deliverable", id] });
                    queryClient.invalidateQueries({ queryKey: ["case-timeline", id] });
                  }}
                />
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
                <GuideCard
                  caseId={id!}
                  deliverable={deliverable}
                  clientName={client?.full_name ?? "Cliente"}
                  clientPhone={client?.phone ?? null}
                  clientEmail={client?.email ?? null}
                  portalSlugOrToken={linkId}
                  onRefresh={() => {
                    queryClient.invalidateQueries({ queryKey: ["case-deliverable", id] });
                    queryClient.invalidateQueries({ queryKey: ["case-timeline", id] });
                  }}
                />

              </CardContent>
            </Card>

            {/* ── 9d. Retificar (botão) ── */}
            {caseData.status === "finalizado" && !caseData.retificacao_iniciada_em && (
              <Card className="border-amber-500/40 bg-amber-500/5">
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Precisa corrigir esta declaração?</p>
                    <p className="text-xs text-muted-foreground">Inicie uma retificação dentro desta mesma demanda.</p>
                  </div>
                  <Button
                    variant="outline"
                    className="border-amber-500/50 text-amber-700 hover:bg-amber-500/10"
                    onClick={() => { setRetificacaoMotivo(""); setShowRetificarDialog(true); }}
                  >
                    <RefreshCw className="h-4 w-4 mr-1.5" /> Retificar Declaração
                  </Button>
                </CardContent>
              </Card>
            )}
            {caseData.status === "retificada" && (
              <Card className="border-amber-500/40 bg-amber-500/5">
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Nova retificação</p>
                    <p className="text-xs text-muted-foreground">Inicie uma nova rodada de retificação se necessário.</p>
                  </div>
                  <Button
                    variant="outline"
                    className="border-amber-500/50 text-amber-700 hover:bg-amber-500/10"
                    onClick={() => { setRetificacaoMotivo(""); setShowRetificarDialog(true); }}
                  >
                    <RefreshCw className="h-4 w-4 mr-1.5" /> Nova Retificação
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* ── 9e. Declaração Retificadora ── */}
            {(caseData.status === "retificando" || caseData.status === "retificada") && (
              <Card className="border-amber-500/40">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <RefreshCw className="h-4 w-4 text-amber-600" />
                        Declaração Retificadora
                        <StatusBadge status={caseData.status as any} />
                      </CardTitle>
                      {caseData.retificacao_justificativa && (
                        <CardDescription className="mt-1">
                          <span className="font-medium">Motivo:</span> {caseData.retificacao_justificativa}
                        </CardDescription>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <DeclarationReceiptCard
                    caseId={id!}
                    deliverable={retDeliverable}
                    clientCpf={caseData.clients?.cpf ?? null}
                    isRetificacao
                    onRefresh={() => {
                      queryClient.invalidateQueries({ queryKey: ["case-deliverable-ret", id] });
                      queryClient.invalidateQueries({ queryKey: ["case-timeline", id] });
                    }}
                  />
                  {caseData.status === "retificando" && retDeliverable?.dec_file_url && retDeliverable?.rec_file_url && (
                    <Button
                      className="w-full"
                      onClick={async () => {
                        const { error } = await supabase
                          .from("irpf_cases")
                          .update({ status: "retificada" })
                          .eq("id", id!);
                        if (error) { toast.error("Erro ao concluir retificação."); return; }
                        await logTimelineEvent(
                          id!,
                          "Retificação concluída",
                          `Declaração retificada entregue por ${profileName ?? "equipe"}`,
                          false,
                        );
                        toast.success("Declaração marcada como Retificada.");
                        invalidateAll();
                      }}
                    >
                      <CheckCircle className="h-4 w-4 mr-1.5" /> Marcar como Retificada
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Retificar dialog */}
          <Dialog open={showRetificarDialog} onOpenChange={setShowRetificarDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Iniciar retificação</DialogTitle>
                <DialogDescription>
                  Descreva o motivo da retificação. Esse texto será registrado no histórico da demanda.
                </DialogDescription>
              </DialogHeader>
              <Textarea
                value={retificacaoMotivo}
                onChange={(e) => setRetificacaoMotivo(e.target.value)}
                placeholder="Ex.: cliente enviou informe de rendimentos adicional não considerado..."
                rows={5}
                maxLength={1000}
              />
              <p className="text-xs text-muted-foreground">
                {retificacaoMotivo.trim().length}/20 caracteres mínimos
              </p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowRetificarDialog(false)}>Cancelar</Button>
                <Button
                  disabled={retificacaoMotivo.trim().length < 20}
                  onClick={async () => {
                    const motivo = retificacaoMotivo.trim();
                    const { error } = await supabase
                      .from("irpf_cases")
                      .update({
                        status: "retificando",
                        retificacao_justificativa: motivo,
                        retificacao_iniciada_em: new Date().toISOString(),
                        retificacao_iniciada_por: user?.id ?? null,
                      } as any)
                      .eq("id", id!);
                    if (error) { toast.error("Erro ao iniciar retificação."); return; }
                    await logTimelineEvent(
                      id!,
                      "Retificação iniciada",
                      `Retificação iniciada por ${profileName ?? "equipe"}. Motivo: ${motivo}`,
                      false,
                    );
                    toast.success("Retificação iniciada.");
                    setShowRetificarDialog(false);
                    invalidateAll();
                  }}
                >
                  Confirmar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>


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
                          toast.info("Compactando documentos em .zip...");
                          try {
                            const JSZip = (await import("jszip")).default;
                            const zip = new JSZip();
                            const usedNames = new Map<string, number>();
                            let failures = 0;

                            await Promise.all(
                              uploadedDocs.map(async (doc) => {
                                try {
                                  const res = await fetch(doc.file_url);
                                  if (!res.ok) throw new Error("fetch failed");
                                  const blob = await res.blob();
                                  let name = doc.file_name;
                                  const count = usedNames.get(name) ?? 0;
                                  if (count > 0) {
                                    const dot = name.lastIndexOf(".");
                                    name = dot > 0
                                      ? `${name.slice(0, dot)} (${count})${name.slice(dot)}`
                                      : `${name} (${count})`;
                                  }
                                  usedNames.set(doc.file_name, count + 1);
                                  zip.file(name, blob);
                                } catch {
                                  failures++;
                                }
                              }),
                            );

                            const zipBlob = await zip.generateAsync({ type: "blob" });
                            const safeClient = (clientName || "cliente").replace(/[^a-zA-Z0-9._-]+/g, "_");
                            const fileName = `documentos_${safeClient}_${caseData.base_year}.zip`;
                            const a = document.createElement("a");
                            a.href = URL.createObjectURL(zipBlob);
                            a.download = fileName;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(a.href);

                            if (failures > 0) {
                              toast.warning(`${uploadedDocs.length - failures} baixados, ${failures} falharam.`);
                            } else {
                              toast.success(`${uploadedDocs.length} documento(s) baixados em .zip!`);
                            }
                          } catch (err) {
                            toast.error("Erro ao gerar arquivo .zip");
                          }
                        }}
                     >
                       <Download className="h-3.5 w-3.5 mr-1.5" />
                       Baixar Todos ({uploadedDocs.length})
                     </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 w-full text-xs"
                      onClick={(e) => { e.stopPropagation(); setBulkUploadOpen(true); }}
                    >
                      <Upload className="h-3.5 w-3.5 mr-1.5" />
                      Anexar em lote (e-mail/WhatsApp)
                    </Button>
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

            {/* ── Observações Internas ── */}
            <Card className={(caseData as any)?.notes_alert ? "border-amber-500/50 bg-amber-500/5" : undefined}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">Observações Internas</CardTitle>
                    <CardDescription>Visível apenas para a equipe</CardDescription>
                  </div>
                  {(caseData as any)?.notes_alert ? (
                    <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                      <BellRing className="h-3 w-3" /> Aviso ao responsável
                    </span>
                  ) : (caseData as any)?.notes_alert_seen_at ? (
                    <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                      <Check className="h-3 w-3" /> Visualizado
                    </span>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {notesMode === "view" && hasSavedNotes && (
                  <>
                    <div className="rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap break-words">
                      {savedNotes}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          setInternalNotes(savedNotes);
                          setNotesMode("edit");
                        }}
                      >
                        <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Atualizar
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          setAppendDraft("");
                          setNotesMode("append");
                        }}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1.5" /> Nova observação
                      </Button>
                    </div>
                  </>
                )}

                {notesMode === "view" && !hasSavedNotes && (
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setInternalNotes("");
                      setNotesMode("edit");
                    }}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1.5" /> Adicionar observação
                  </Button>
                )}

                {notesMode === "edit" && (
                  <>
                    <Textarea
                      value={notesValue}
                      onChange={(e) => setInternalNotes(e.target.value)}
                      placeholder="Adicionar observações internas..."
                      rows={5}
                      className="text-sm"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="flex-1"
                        onClick={() => {
                          setInternalNotes(null);
                          setNotesMode("view");
                        }}
                        disabled={saveNotes.isPending}
                      >
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => saveNotes.mutate(notesValue)}
                        disabled={saveNotes.isPending}
                      >
                        <Save className="h-3.5 w-3.5 mr-1.5" />
                        {saveNotes.isPending ? "Salvando..." : "Salvar"}
                      </Button>
                    </div>
                  </>
                )}

                {notesMode === "append" && (
                  <>
                    {hasSavedNotes && (
                      <div className="rounded-md border bg-muted/20 p-2 text-xs text-muted-foreground whitespace-pre-wrap max-h-32 overflow-auto">
                        {savedNotes}
                      </div>
                    )}
                    <Textarea
                      value={appendDraft}
                      onChange={(e) => setAppendDraft(e.target.value)}
                      placeholder="Nova observação a ser adicionada..."
                      rows={4}
                      className="text-sm"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="flex-1"
                        onClick={() => {
                          setAppendDraft("");
                          setNotesMode("view");
                        }}
                        disabled={saveNotes.isPending}
                      >
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          const text = appendDraft.trim();
                          if (!text) {
                            toast.error("Escreva a observação.");
                            return;
                          }
                          const stamp = format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR });
                          const author = profileName || "Equipe";
                          const entry = `[${stamp} • ${author}]\n${text}`;
                          const merged = hasSavedNotes ? `${savedNotes}\n\n${entry}` : entry;
                          saveNotes.mutate(merged);
                        }}
                        disabled={saveNotes.isPending}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1.5" />
                        {saveNotes.isPending ? "Salvando..." : "Adicionar"}
                      </Button>
                    </div>
                  </>
                )}

                {/* ── Anexos da observação ── */}
                <div className="rounded-md border bg-muted/20 p-2.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium">Anexos</span>
                    <input
                      ref={noteAttachmentInputRef}
                      type="file"
                      multiple
                      accept={getAcceptString()}
                      className="hidden"
                      onChange={handleAddNoteAttachment}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={uploadingNoteAttachment}
                      onClick={() => noteAttachmentInputRef.current?.click()}
                    >
                      {uploadingNoteAttachment ? (
                        <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Enviando...</>
                      ) : (
                        <><Upload className="h-3 w-3 mr-1" /> Anexar</>
                      )}
                    </Button>
                  </div>
                  {noteAttachments.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">
                      Nenhum anexo. {ALLOWED_EXTENSIONS_LABEL} (até {MAX_FILE_SIZE_LABEL}).
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {noteAttachments.map((att, i) => (
                        <li key={`${att.url}-${i}`} className="flex items-center gap-2 rounded border bg-background p-1.5">
                          <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                          <a
                            href={att.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline truncate flex-1"
                            title={att.name}
                          >
                            {att.name}
                          </a>
                          {att.uploaded_by && att.uploaded_at && (
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap hidden sm:inline">
                              {att.uploaded_by} • {format(new Date(att.uploaded_at), "dd/MM/yyyy", { locale: ptBR })}
                            </span>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => handleRemoveNoteAttachment(i)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className={`flex items-start gap-2 rounded-md border p-2.5 ${(caseData as any)?.notes_alert ? "border-amber-500/40 bg-amber-500/10" : "bg-muted/30"}`}>
                  <Checkbox
                    id="notes-alert-toggle"
                    checked={!!(caseData as any)?.notes_alert}
                    onCheckedChange={(v) => toggleNotesAlert.mutate(!!v)}
                    disabled={toggleNotesAlert.isPending}
                    className="mt-0.5"
                  />

                  <label htmlFor="notes-alert-toggle" className="text-xs leading-tight cursor-pointer flex-1">
                    <span className="font-medium">Avisar responsável</span>
                    <span className="block text-muted-foreground">
                      Marca esta demanda como precisando de atenção do responsável.
                      {(caseData as any)?.notes_alert_at && (caseData as any)?.notes_alert_by && (
                        <> Marcado por {(caseData as any).notes_alert_by} em {format(new Date((caseData as any).notes_alert_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}.</>
                      )}
                    </span>
                  </label>
                </div>

                {(caseData as any)?.notes_alert ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full border-amber-500/50 bg-amber-500/10 text-amber-800 hover:bg-amber-500/20 hover:text-amber-900"
                    onClick={() => toggleNotesAlert.mutate(false)}
                    disabled={toggleNotesAlert.isPending}
                  >
                    <Check className="h-3.5 w-3.5 mr-1.5" />
                    {toggleNotesAlert.isPending ? "Marcando..." : "Marcar como visualizado"}
                  </Button>
                ) : (caseData as any)?.notes_alert_seen_at ? (
                  <div className="flex items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2.5 text-xs text-emerald-800">
                    <Check className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>
                      <span className="font-medium">Observação visualizada</span>
                      {(caseData as any)?.notes_alert_seen_by && (
                        <> por {(caseData as any).notes_alert_seen_by}</>
                      )}{" "}
                      em {format(new Date((caseData as any).notes_alert_seen_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}.
                    </span>
                  </div>
                ) : null}
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

    <BulkUploadDialog
      open={bulkUploadOpen}
      onOpenChange={setBulkUploadOpen}
      caseId={id!}
      docRequests={docRequests}
      onDone={() => {
        queryClient.invalidateQueries({ queryKey: ["doc-requests", id] });
        queryClient.invalidateQueries({ queryKey: ["uploaded-docs", id] });
        queryClient.invalidateQueries({ queryKey: ["case-timeline", id] });
        queryClient.invalidateQueries({ queryKey: ["irpf-case", id] });
      }}
    />

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
                .update({ status: "impedida" })
                .eq("id", id!);
              if (error) {
                toast.error("Erro ao impedir demanda");
                return;
              }
              await logTimelineEvent(id!, "Demanda impedida", `Motivo: ${justificativa}`, true);
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
                .update({ status: "dispensada" })
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
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 text-destructive hover:text-destructive"
                title="Excluir arquivo"
                onClick={async () => {
                  if (!confirm(`Excluir o arquivo "${u.file_name}"? Esta ação não pode ser desfeita.`)) return;
                  try {
                    const marker = "/storage/v1/object/public/documentos_clientes/";
                    const idx = u.file_url.indexOf(marker);
                    if (idx >= 0) {
                      const path = decodeURIComponent(u.file_url.slice(idx + marker.length));
                      await supabase.storage.from("documentos_clientes").remove([path]);
                    }
                    await supabase.from("uploaded_documents").delete().eq("id", u.id);
                    const remaining = uploads.filter((x) => x.id !== u.id).length;
                    if (remaining === 0 && doc.status !== "pendente") {
                      await supabase
                        .from("document_requests")
                        .update({ status: "pendente" as DocumentStatus })
                        .eq("id", doc.id);
                    }
                    await logTimelineEvent(caseId, "Arquivo excluído", `Arquivo "${u.file_name}" removido do checklist (${doc.title})`);
                    toast.success("Arquivo excluído.");
                    onRefresh();
                  } catch {
                    toast.error("Erro ao excluir arquivo.");
                  }
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Preview Card ──
function PreviewCard({
  caseId,
  deliverable,
  timeline = [],
  clientName = "",
  portalUrl = "",
  onRefresh,
}: {
  caseId: string;
  deliverable: Tables<"final_deliverables"> | null | undefined;
  timeline?: any[];
  clientName?: string;
  portalUrl?: string;
  onRefresh: () => void;
}) {
  const previewRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [taxDialogOpen, setTaxDialogOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [hadTax, setHadTax] = useState<"sim" | "nao" | null>(null);
  const [taxValue, setTaxValue] = useState<string>("");
  const del = deliverable as any;

  const openTaxDialog = (file: File) => {
    const err = validateFile(file);
    if (err) { toast.error(err); return; }
    setPendingFile(file);
    setHadTax(null);
    setTaxValue("");
    setTaxDialogOpen(true);
  };

  const parsedTax = (() => {
    const n = parseFloat(taxValue.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : 0;
  })();
  const maxCotas = Math.min(8, Math.max(1, Math.floor(parsedTax / 100)));
  const canSubmitTax =
    !!pendingFile && (hadTax === "nao" || (hadTax === "sim" && parsedTax >= 100));

  const handleConfirmUpload = async () => {
    if (!pendingFile || !canSubmitTax) return;
    setUploading(true);
    try {
      const file = pendingFile;
      const url = await uploadFileToBucket("declaracoes_finais", buildStoragePath(caseId, file.name, "preview"), file);
      const updates: any = {
        preview_file_url: url,
        preview_status: "aguardando_revisao",
        preview_feedback: null,
        tax_due_amount: hadTax === "sim" ? parsedTax : 0,
      };
      let deliverableId = deliverable?.id;
      if (deliverable) {
        await supabase.from("final_deliverables").update(updates).eq("id", deliverable.id);
      } else {
        const { data: inserted } = await supabase
          .from("final_deliverables")
          .insert({ case_id: caseId, ...updates } as any)
          .select("id")
          .single();
        deliverableId = inserted?.id;
      }
      await logTimelineEvent(
        caseId,
        "Prévia da Declaração enviada",
        `Arquivo: ${file.name}${hadTax === "sim" ? ` — Imposto a pagar: ${fmt(parsedTax)}` : " — Sem imposto a pagar"}`,
        true,
      );




      toast.success("Prévia enviada!");
      setTaxDialogOpen(false);
      setPendingFile(null);
      onRefresh();
    } catch {
      toast.error("Erro ao enviar.");
    } finally {
      setUploading(false);
    }
  };


  const previewStatusLabel: Record<string, { text: string; color: string }> = {
    aguardando_revisao: { text: "Aguardando revisão do cliente", color: "text-warning" },
    aprovado: { text: "Aprovado pelo cliente ✓", color: "text-success" },
    ajustes_solicitados: { text: "Ajustes solicitados", color: "text-destructive" },
  };
  const pStatus = del?.preview_status as string | null;

  // Data do envio mais recente da prévia (a partir do timeline) — fallback para uploaded_at
  const sentAtIso: string | null = (() => {
    const sentEvents = (timeline ?? [])
      .filter((t: any) => t.event_type === "Prévia da Declaração enviada")
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return sentEvents[0]?.created_at ?? del?.uploaded_at ?? null;
  })();

  const daysSince = sentAtIso
    ? Math.max(0, Math.floor((Date.now() - new Date(sentAtIso).getTime()) / (1000 * 60 * 60 * 24)))
    : null;

  const isWaiting = pStatus === "aguardando_revisao";

  const handleCopyChase = async () => {
    const firstName = (clientName || "").split(" ")[0] || "Olá";
    const dias = daysSince ?? 0;
    const tempo =
      dias === 0 ? "hoje" :
      dias === 1 ? "ontem" :
      `há ${dias} dias`;
    const msg =
      `Olá ${firstName}, tudo bem?\n\n` +
      `Enviamos a *prévia da sua declaração de Imposto de Renda* ${tempo} e ainda não recebemos seu retorno.\n\n` +
      `Para que possamos transmitir sua declaração o quanto antes, pedimos que acesse o portal, revise e *aprove a prévia*:\n${portalUrl}\n\n` +
      `Se identificar algum ajuste, é só sinalizar pelo próprio portal.\n\nFicamos no aguardo. Obrigado!`;
    try {
      await navigator.clipboard.writeText(msg);
      toast.success("Mensagem de cobrança copiada!");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

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
        {del?.preview_file_url && deliverable && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            disabled={uploading}
            title="Excluir prévia"
            onClick={async () => {
              if (!confirm("Excluir a prévia enviada? Esta ação não pode ser desfeita.")) return;
              try {
                await supabase
                  .from("final_deliverables")
                  .update({
                    preview_file_url: null,
                    preview_status: "aguardando_revisao",
                    preview_feedback: null,
                    preview_approved_at: null,
                  } as any)
                  .eq("id", deliverable.id);
                await logTimelineEvent(caseId, "Prévia removida", "A prévia anterior foi excluída pela equipe.", false);
                toast.success("Prévia removida.");
                onRefresh();
              } catch {
                toast.error("Erro ao remover prévia.");
              }
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
        <input ref={previewRef} type="file" className="hidden" accept={getAcceptString()} onChange={(e) => { const f = e.target.files?.[0]; if (f) openTaxDialog(f); e.target.value = ""; }} />
        <Button variant="outline" size="sm" className="h-7 text-xs" disabled={uploading} onClick={() => previewRef.current?.click()}>
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Upload className="h-3.5 w-3.5 mr-1" /> {del?.preview_file_url ? "Substituir" : "Upload"}</>}
        </Button>
      </div>

      <Dialog open={taxDialogOpen} onOpenChange={(o) => { if (!uploading) setTaxDialogOpen(o); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Envio da prévia</DialogTitle>
            <DialogDescription>
              Antes de enviar a prévia, confirme se a declaração apresenta imposto a pagar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {pendingFile && (
              <div className="flex items-center gap-2 text-sm rounded-md border p-2 bg-muted/30">
                <FileText className="h-4 w-4 text-primary shrink-0" />
                <span className="truncate">{pendingFile.name}</span>
              </div>
            )}
            <div className="space-y-2">
              <p className="text-sm font-medium">Houve imposto a pagar no IR?</p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setHadTax("sim")} className={hadTax === "sim" ? "border-primary bg-primary/10" : ""}>Sim</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => { setHadTax("nao"); setTaxValue(""); }} className={hadTax === "nao" ? "border-primary bg-primary/10" : ""}>Não</Button>
              </div>
            </div>
            {hadTax === "sim" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Valor do imposto a pagar (R$)</label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={taxValue}
                  onChange={(e) => setTaxValue(e.target.value)}
                />
                {parsedTax > 0 && parsedTax < 100 && (
                  <p className="text-xs text-destructive">O valor mínimo para parcelamento é R$ 100,00.</p>
                )}
                {parsedTax >= 100 && (
                  <p className="text-xs text-muted-foreground">
                    O cliente verá o valor do imposto junto com a aprovação da prévia e poderá escolher em quantas
                    cotas pagar (até <strong>{maxCotas}</strong> {maxCotas === 1 ? "cota" : "cotas"}, mínimo R$ 100,00 por cota).
                  </p>
                )}

              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={uploading} onClick={() => setTaxDialogOpen(false)}>Cancelar</Button>
            <Button disabled={!canSubmitTax || uploading} onClick={handleConfirmUpload}>
              {uploading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...</> : "Enviar prévia"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {del?.preview_file_url && sentAtIso && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          <span>
            Enviada em{" "}
            <span className="font-medium text-foreground">
              {format(new Date(sentAtIso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </span>
          </span>
        </div>
      )}

      {isWaiting && daysSince !== null && (
        <div
          className={`rounded-md border p-2.5 flex items-center justify-between gap-2 ${
            daysSince >= 7
              ? "bg-destructive/10 border-destructive/30"
              : daysSince >= 3
                ? "bg-warning/10 border-warning/30"
                : "bg-muted/50 border-border"
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Clock
              className={`h-4 w-4 shrink-0 ${
                daysSince >= 7 ? "text-destructive" : daysSince >= 3 ? "text-warning" : "text-muted-foreground"
              }`}
            />
            <p className="text-xs">
              <span
                className={`font-bold ${
                  daysSince >= 7 ? "text-destructive" : daysSince >= 3 ? "text-warning" : "text-foreground"
                }`}
              >
                {daysSince === 0
                  ? "Enviada hoje"
                  : daysSince === 1
                    ? "1 dia sem retorno"
                    : `${daysSince} dias sem retorno`}
              </span>
              <span className="text-muted-foreground"> do cliente</span>
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs shrink-0"
            onClick={handleCopyChase}
            disabled={!portalUrl}
          >
            <Copy className="h-3 w-3 mr-1" /> Copiar cobrança
          </Button>
        </div>
      )}

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

      {del?.preview_file_url && pStatus !== "aprovado" && deliverable && (
        <div className="rounded-md border border-dashed p-2.5 bg-muted/30 space-y-2">
          <p className="text-xs text-muted-foreground">
            O cliente confirmou aprovação por outro canal (ex.: WhatsApp)? Aprove
            internamente para liberar o envio da Declaração e Recibo.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs w-full"
            onClick={async () => {
              if (!confirm("Confirmar aprovação interna da prévia? Isso liberará a etapa de Declaração/Recibo.")) return;
              try {
                await supabase
                  .from("final_deliverables")
                  .update({
                    preview_status: "aprovado",
                    preview_approved_at: new Date().toISOString(),
                    preview_feedback: null,
                  } as any)
                  .eq("id", deliverable.id);
                await logTimelineEvent(
                  caseId,
                  "Prévia aprovada internamente",
                  "Aprovação registrada manualmente pela equipe (cliente confirmou por canal externo).",
                  true
                );
                toast.success("Prévia aprovada internamente!");
                onRefresh();
              } catch {
                toast.error("Erro ao aprovar internamente.");
              }
            }}
          >
            <CheckCircle className="h-3.5 w-3.5 mr-1.5" /> Aprovar internamente
          </Button>
        </div>
      )}

      {del?.preview_file_url && pStatus === "aprovado" && deliverable && (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs w-full text-muted-foreground hover:text-destructive"
          onClick={async () => {
            if (!confirm("Cancelar a aprovação interna da prévia? Ela voltará para 'Aguardando revisão do cliente'.")) return;
            try {
              await supabase
                .from("final_deliverables")
                .update({
                  preview_status: "aguardando_revisao",
                  preview_approved_at: null,
                  preview_feedback: null,
                } as any)
                .eq("id", deliverable.id);
              await logTimelineEvent(
                caseId,
                "Aprovação da prévia cancelada",
                "A aprovação interna da prévia foi cancelada pela equipe.",
                false
              );
              toast.success("Aprovação cancelada.");
              onRefresh();
            } catch {
              toast.error("Erro ao cancelar aprovação.");
            }
          }}
        >
          <X className="h-3.5 w-3.5 mr-1.5" /> Cancelar aprovação
        </Button>
      )}
    </div>
  );
}

// ── Declaration & Receipt Card ──
function DeclarationReceiptCard({ caseId, deliverable, clientCpf, onRefresh, isRetificacao = false, readOnly = false }: { caseId: string; deliverable: Tables<"final_deliverables"> | null | undefined; clientCpf?: string | null; onRefresh: () => void; isRetificacao?: boolean; readOnly?: boolean }) {
  const irpfRef = useRef<HTMLInputElement>(null);
  const receiptRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<HTMLInputElement>(null);
  const decRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<"irpf" | "receipt" | "rec" | "dec" | null>(null);
  const [checking, setChecking] = useState<"irpf" | "receipt" | "rec" | "dec" | null>(null);
  const [confirmState, setConfirmState] = useState<{ type: "irpf" | "receipt" | "rec" | "dec"; file: File; reason: string } | null>(null);

  const UPLOAD_CONFIG = {
    irpf: { bucket: "declaracoes_finais", field: "irpf_file_url", label: "Declaração IRPF" },
    receipt: { bucket: "recibos_entrega", field: "receipt_file_url", label: "Recibo de Entrega" },
    rec: { bucket: "recibos_entrega", field: "rec_file_url", label: "Arquivo REC" },
    dec: { bucket: "declaracoes_finais", field: "dec_file_url", label: "Arquivo DEC" },
  } as const;

  const performUpload = async (type: keyof typeof UPLOAD_CONFIG, file: File, skippedCheck = false) => {
    setUploading(type);
    const cfg = UPLOAD_CONFIG[type];
    try {
      const url = await uploadFileToBucket(cfg.bucket, buildStoragePath(caseId, file.name), file);
      if (deliverable) {
        await supabase.from("final_deliverables").update({ [cfg.field]: url } as any).eq("id", deliverable.id);
      } else {
        await supabase.from("final_deliverables").insert({ case_id: caseId, retificacao: isRetificacao, [cfg.field]: url } as any);
      }
      await logTimelineEvent(
        caseId,
        `${cfg.label} enviado(a)`,
        `Arquivo: ${file.name}${skippedCheck ? " — anexado SEM confirmação de CPF do cliente" : ""}`,
        true,
      );
      toast.success(`${cfg.label} enviado(a)!`);
      onRefresh();
    } catch { toast.error("Erro ao enviar."); } finally { setUploading(null); }
  };

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
    if (file.size > 50 * 1024 * 1024) { toast.error(`Arquivo "${file.name}" excede o limite de 50 MB.`); return; }

    // CPF verification
    const cpfDigits = (clientCpf ?? "").replace(/\D/g, "");
    if (cpfDigits.length === 11) {
      const nameMatch = filenameMatchesCpf(file.name, clientCpf);
      if (nameMatch) {
        await performUpload(type, file);
        return;
      }
      const isPdf = file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf";
      if (isPdf) {
        setChecking(type);
        try {
          const pdfMatch = await pdfContainsCpf(file, clientCpf);
          if (pdfMatch) {
            setChecking(null);
            await performUpload(type, file);
            return;
          }
        } finally { setChecking(null); }
        setConfirmState({ type, file, reason: "O CPF do cliente não foi encontrado no nome do arquivo nem no conteúdo do PDF." });
        return;
      }
      setConfirmState({ type, file, reason: "O CPF do cliente não foi encontrado no nome do arquivo." });
      return;
    }

    // No CPF on client record — just upload
    await performUpload(type, file);
  };


  const toggleRelease = async () => {
    if (!deliverable) return;
    const newVal = !deliverable.sent_to_client;
    await supabase.from("final_deliverables").update({ sent_to_client: newVal }).eq("id", deliverable.id);
    await logTimelineEvent(caseId, newVal ? "Entrega liberada" : "Entrega bloqueada", newVal ? "Arquivos finais liberados para o cliente" : "Arquivos finais bloqueados", true);
    toast.success(newVal ? "Arquivos liberados!" : "Liberação revogada.");
    onRefresh();
  };

  const handleDelete = async (type: keyof typeof UPLOAD_CONFIG) => {
    if (!deliverable) return;
    const cfg = UPLOAD_CONFIG[type];
    if (!confirm(`Remover ${cfg.label}? Esta ação não poderá ser desfeita.`)) return;
    const updates: any = { [cfg.field]: null };
    if (deliverable.sent_to_client) {
      const remaining = (["irpf","receipt","rec","dec"] as const)
        .filter((t) => t !== type)
        .some((t) => (deliverable as any)?.[UPLOAD_CONFIG[t].field]);
      if (!remaining) updates.sent_to_client = false;
    }
    const { error } = await supabase.from("final_deliverables").update(updates).eq("id", deliverable.id);
    if (error) { toast.error("Erro ao remover arquivo."); return; }
    await logTimelineEvent(caseId, `${cfg.label} removido(a)`, `Arquivo removido pela equipe`, false);
    toast.success(`${cfg.label} removido(a).`);
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
        <input ref={ref} type="file" className="hidden" accept={type === "rec" ? ".rec" : type === "dec" ? ".dec" : getAcceptString()} onChange={(e) => { if (e.target.files?.[0]) { handleUpload(type, e.target.files[0]); e.target.value = ""; } }} />
        <Button variant="outline" size="sm" className="h-7 text-xs" disabled={uploading === type || checking === type} onClick={() => ref.current?.click()}>
          {uploading === type || checking === type
            ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> {checking === type ? "Conferindo CPF…" : ""}</>
            : <><Upload className="h-3.5 w-3.5 mr-1" /> {url ? "Substituir" : "Upload"}</>}
        </Button>
        {url && (
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" title="Excluir arquivo" onClick={() => handleDelete(type)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    );
  };

  const hasAnyFile = deliverable?.irpf_file_url || deliverable?.receipt_file_url || fileUrl("rec_file_url") || fileUrl("dec_file_url");

  const previewApproved = (deliverable as any)?.preview_status === "aprovado";

  if (!previewApproved && !isRetificacao) {
    return (
      <div className="rounded-md border border-dashed p-4 bg-muted/30 text-center space-y-1">
        <Lock className="h-5 w-5 mx-auto text-muted-foreground" />
        <p className="text-sm font-medium">Etapa bloqueada</p>
        <p className="text-xs text-muted-foreground">
          Disponível somente após a <span className="font-medium">aprovação da prévia</span> pelo cliente
          (ou aprovação interna pela equipe).
        </p>
      </div>
    );
  }

  if (readOnly) {
    return (
      <div className="space-y-3">
        {(["irpf","receipt","rec","dec"] as const).map((t) => {
          const cfg = UPLOAD_CONFIG[t];
          const url = fileUrl(cfg.field);
          if (!url) return null;
          return (
            <div key={t} className="flex items-center gap-2 p-2.5 rounded-lg border bg-muted/20">
              <FileText className="h-4 w-4 shrink-0 text-success" />
              <span className="text-sm flex-1">{cfg.label}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                <a href={url} target="_blank" rel="noopener noreferrer"><Eye className="h-3.5 w-3.5" /></a>
              </Button>
            </div>
          );
        })}
        {!hasAnyFile && <p className="text-xs text-muted-foreground italic">Nenhum arquivo enviado.</p>}
      </div>
    );
  }

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
import { ExternalLink as ExternalLinkIcon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";


type PaymentQuota = {
  id: string;
  case_id: string;
  quota_number: number;
  due_date: string | null;
  file_url: string | null;
  file_name: string | null;
  sent_to_client: boolean;
  sent_at: string | null;
  notes: string | null;
};

function GuideCard({ caseId, deliverable, clientName, clientPhone, clientEmail, portalSlugOrToken, onRefresh }: { caseId: string; deliverable: Tables<"final_deliverables"> | null | undefined; clientName: string; clientPhone: string | null; clientEmail: string | null; portalSlugOrToken: string; onRefresh: () => void }) {
  const del = deliverable as any;
  const [hasGuide, setHasGuide] = useState<boolean>(del?.has_guide ?? false);
  const [paymentType, setPaymentType] = useState<"cota_unica" | "cotas">(
    (del?.guide_payment_type as "cota_unica" | "cotas") ?? "cota_unica"
  );
  const [quotaCount, setQuotaCount] = useState<number>(del?.guide_quota_count ?? 2);
  const [savingConfig, setSavingConfig] = useState(false);
  const [quotas, setQuotas] = useState<PaymentQuota[]>([]);
  const [loadingQuotas, setLoadingQuotas] = useState(false);

  const loadQuotas = useCallback(async () => {
    setLoadingQuotas(true);
    const { data } = await supabase
      .from("payment_quotas" as any)
      .select("*")
      .eq("case_id", caseId)
      .order("quota_number", { ascending: true });
    setQuotas((data as any) ?? []);
    setLoadingQuotas(false);
  }, [caseId]);

  useEffect(() => { loadQuotas(); }, [loadQuotas]);

  const ensureDeliverable = async (patch: Record<string, any>) => {
    if (deliverable) {
      await supabase.from("final_deliverables").update(patch as any).eq("id", deliverable.id);
    } else {
      await supabase.from("final_deliverables").insert({ case_id: caseId, ...patch } as any);
    }
  };

  const ensureQuotas = async (count: number) => {
    const { data: existing } = await supabase
      .from("payment_quotas" as any)
      .select("id, quota_number")
      .eq("case_id", caseId);
    const existingNums = new Set(((existing as any[]) ?? []).map((q) => q.quota_number));
    const toInsert: any[] = [];
    for (let i = 1; i <= count; i++) {
      if (!existingNums.has(i)) toInsert.push({ case_id: caseId, quota_number: i });
    }
    if (toInsert.length > 0) {
      await supabase.from("payment_quotas" as any).insert(toInsert);
    }
    // Remove extras above count
    await supabase
      .from("payment_quotas" as any)
      .delete()
      .eq("case_id", caseId)
      .gt("quota_number", count);
    await loadQuotas();
  };

  const toggleGuide = async (checked: boolean) => {
    setHasGuide(checked);
    await ensureDeliverable({ has_guide: checked });
    if (checked) {
      await ensureQuotas(paymentType === "cota_unica" ? 1 : quotaCount);
    }
    onRefresh();
  };

  const saveConfig = async () => {
    setSavingConfig(true);
    try {
      const count = paymentType === "cota_unica" ? 1 : Math.max(2, Math.min(8, quotaCount));
      await ensureDeliverable({
        has_guide: true,
        guide_payment_type: paymentType,
        guide_quota_count: count,
      });
      await ensureQuotas(count);
      toast.success("Configuração salva!");
      onRefresh();
    } catch {
      toast.error("Erro ao salvar configuração.");
    } finally {
      setSavingConfig(false);
    }
  };

  const previewApproved = (deliverable as any)?.preview_status === "aprovado";

  if (!previewApproved) {
    return (
      <div className="rounded-md border border-dashed p-4 bg-muted/30 text-center space-y-1">
        <Lock className="h-5 w-5 mx-auto text-muted-foreground" />
        <p className="text-sm font-medium">Etapa bloqueada</p>
        <p className="text-xs text-muted-foreground">
          Disponível somente após a <span className="font-medium">aprovação da prévia</span> pelo cliente
          (ou aprovação interna pela equipe).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Possui guia de pagamento?</label>
        <Switch checked={hasGuide} onCheckedChange={toggleGuide} />
      </div>

      {hasGuide && (
        <>
          <div className="space-y-2 rounded-md border p-3 bg-muted/30">
            <Label className="text-xs font-medium text-muted-foreground">Forma de pagamento</Label>
            <RadioGroup
              value={paymentType}
              onValueChange={(v) => setPaymentType(v as "cota_unica" | "cotas")}
              className="flex flex-col gap-1.5"
            >
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <RadioGroupItem value="cota_unica" id="pt-unica" />
                <span>Cota única</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <RadioGroupItem value="cotas" id="pt-cotas" />
                <span>Parcelado em cotas</span>
              </label>
            </RadioGroup>

            {paymentType === "cotas" && (
              <div className="flex items-center gap-2 pt-1">
                <Label className="text-xs">Quantidade de cotas:</Label>
                <Input
                  type="number"
                  min={2}
                  max={8}
                  value={quotaCount}
                  onChange={(e) => setQuotaCount(parseInt(e.target.value) || 2)}
                  className="h-8 w-20 text-sm"
                />
              </div>
            )}

            <Button size="sm" className="w-full mt-2" onClick={saveConfig} disabled={savingConfig}>
              {savingConfig ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Save className="h-3.5 w-3.5 mr-1" /> Aplicar configuração</>}
            </Button>
          </div>

          {loadingQuotas ? (
            <Skeleton className="h-20 w-full" />
          ) : quotas.length > 0 ? (
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">
                {paymentType === "cota_unica" ? "Guia DARF" : "Controle de cotas"}
              </Label>
              {quotas.map((q) => (
                <QuotaRow
                  key={q.id}
                  quota={q}
                  caseId={caseId}
                  isSingle={paymentType === "cota_unica"}
                  totalQuotas={quotas.length}
                  clientName={clientName}
                  clientPhone={clientPhone}
                  clientEmail={clientEmail}
                  portalSlugOrToken={portalSlugOrToken}
                  onChanged={loadQuotas}
                />
              ))}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function QuotaRow({
  quota,
  caseId,
  isSingle,
  totalQuotas,
  clientName,
  clientPhone,
  clientEmail,
  portalSlugOrToken,
  onChanged,
}: {
  quota: PaymentQuota;
  caseId: string;
  isSingle: boolean;
  totalQuotas: number;
  clientName: string;
  clientPhone: string | null;
  clientEmail: string | null;
  portalSlugOrToken: string;
  onChanged: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [dueDate, setDueDate] = useState(quota.due_date ?? "");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const message = getPaymentGuideMessage({
    clientName,
    slugOrToken: portalSlugOrToken,
    isSingle,
    quotaNumber: quota.quota_number,
    totalQuotas,
    dueDate: quota.due_date,
  });
  const subject = isSingle
    ? "Sua guia DARF do Imposto de Renda"
    : `Guia DARF — Cota ${quota.quota_number}/${totalQuotas} do Imposto de Renda`;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateFile(file);
    if (err) { toast.error(err); return; }
    setUploading(true);
    try {
      const path = buildStoragePath(caseId, file.name, `guias/cota-${quota.quota_number}`);
      const url = await uploadFileToBucket("documentos_clientes", path, file);
      await supabase.from("payment_quotas" as any).update({
        file_url: url, file_name: file.name,
      }).eq("id", quota.id);
      toast.success(`Guia da cota ${quota.quota_number} anexada!`);
      onChanged();
    } catch {
      toast.error("Erro ao enviar arquivo.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeFile = async () => {
    await supabase.from("payment_quotas" as any).update({
      file_url: null, file_name: null, sent_to_client: false, sent_at: null,
    }).eq("id", quota.id);
    onChanged();
  };

  const saveDueDate = async (value: string) => {
    setDueDate(value);
    await supabase.from("payment_quotas" as any).update({ due_date: value || null }).eq("id", quota.id);
    onChanged();
  };

  const toggleSent = async () => {
    if (!quota.file_url) { toast.error("Anexe a guia antes de marcar como enviada."); return; }
    const newSent = !quota.sent_to_client;
    await supabase.from("payment_quotas" as any).update({
      sent_to_client: newSent,
      sent_at: newSent ? new Date().toISOString() : null,
    }).eq("id", quota.id);
    if (newSent) {
      await logTimelineEvent(
        caseId,
        "Guia enviada",
        isSingle
          ? "Guia DARF enviada ao cliente"
          : `Cota ${quota.quota_number}/${totalQuotas} enviada ao cliente`,
        true,
      );
    }
    onChanged();
  };

  return (
    <div className="rounded-md border p-2.5 space-y-2 bg-card">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">
          {isSingle ? "Guia única" : `Cota ${quota.quota_number} / ${totalQuotas}`}
        </span>
        {quota.sent_to_client ? (
          <Badge variant="default" className="text-[10px]">Enviada</Badge>
        ) : quota.file_url ? (
          <Badge variant="secondary" className="text-[10px]">Pronta</Badge>
        ) : (
          <Badge variant="outline" className="text-[10px]">Pendente</Badge>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground shrink-0">Vencimento:</Label>
        <Input
          type="date"
          value={dueDate}
          onChange={(e) => saveDueDate(e.target.value)}
          className="h-8 text-xs"
        />
      </div>

      {quota.file_url ? (
        <div className="flex items-center gap-2 p-1.5 border rounded bg-muted/40">
          <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
          <a
            href={quota.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline truncate flex-1"
          >
            {quota.file_name ?? "Guia anexada"}
          </a>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={removeFile}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept={getAcceptString()}
            className="hidden"
            onChange={handleUpload}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full h-8 text-xs"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Upload className="h-3.5 w-3.5 mr-1.5" /> Anexar guia</>}
          </Button>
        </div>
      )}

      <Button
        size="sm"
        variant={quota.sent_to_client ? "outline" : "default"}
        className="w-full h-7 text-xs"
        onClick={toggleSent}
        disabled={!quota.file_url}
      >
        {quota.sent_to_client ? (
          <><CheckCircle className="h-3 w-3 mr-1" /> Enviada {quota.sent_at ? `em ${format(new Date(quota.sent_at), "dd/MM/yyyy")}` : ""} — desfazer</>
        ) : (
          <><Send className="h-3 w-3 mr-1" /> Marcar como enviada ao cliente</>
        )}
      </Button>

      {quota.file_url && (
        <div className="space-y-1.5 pt-1 border-t">
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Mensagem para o cliente</Label>
          <Textarea
            value={message}
            readOnly
            rows={4}
            className="text-xs resize-none"
            onFocus={(e) => e.currentTarget.select()}
          />
          <div className="grid grid-cols-3 gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-[11px] px-2"
              onClick={() => {
                navigator.clipboard.writeText(message);
                toast.success("Mensagem copiada!");
              }}
            >
              <Copy className="h-3 w-3 mr-1" /> Copiar
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-[11px] px-2"
              asChild
            >
              <a
                href={buildWhatsAppLink(clientPhone, message)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle className="h-3 w-3 mr-1" /> WhatsApp
              </a>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-[11px] px-2"
              asChild
            >
              <a href={buildMailtoLink(clientEmail, subject, message)}>
                <Mail className="h-3 w-3 mr-1" /> E-mail
              </a>
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground leading-tight">
            Lembre de anexar o arquivo da guia ao enviar pelo WhatsApp ou e-mail.
          </p>
        </div>
      )}
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
                className={`group relative p-2.5 rounded-lg text-sm max-w-[85%] ${
                  msg.sender === "office"
                    ? "bg-primary/10 ml-auto"
                    : "bg-muted mr-auto"
                }`}
              >
                {msg.sender === "office" && (
                  <button
                    onClick={async () => {
                      if (!confirm("Excluir esta mensagem?")) return;
                      const { error } = await supabase
                        .from("case_messages" as any)
                        .delete()
                        .eq("id", msg.id);
                      if (error) {
                        toast.error("Erro ao excluir mensagem.");
                        return;
                      }
                      toast.success("Mensagem excluída.");
                      onRefresh();
                    }}
                    className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                    title="Excluir mensagem"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
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
    const item = items.find((i: any) => i.id === itemId);
    await supabase.from("internal_checklist").update({ checked: !checked }).eq("id", itemId);
    if (!checked && item?.label?.toLowerCase().trim() === "preencher declaração") {
      const { data: c } = await supabase.from("irpf_cases").select("status").eq("id", caseId).single();
      const blocked = ["finalizado", "impedida", "dispensada", "previa_aprovada", "previa_enviada", "retificada"];
      if (c && !blocked.includes(c.status as string)) {
        await supabase.from("irpf_cases").update({ status: "declaracao_em_preenchimento" as any }).eq("id", caseId);
        await logTimelineEvent(caseId, "Status alterado", "Declaração em preenchimento", false);
        queryClient.invalidateQueries({ queryKey: ["irpf-cases"] });
        queryClient.invalidateQueries({ queryKey: ["irpf-case", caseId] });
        queryClient.invalidateQueries({ queryKey: ["case-timeline", caseId] });
      }
    }
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
    <Collapsible>
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
