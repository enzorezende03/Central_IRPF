import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertCircle, CheckCircle2, Plus, Trash2, Copy, Loader2, Paperclip, Download, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getPortalUrl } from "@/lib/portal-utils";
import { validateFile, uploadFileToBucket, buildStoragePath, getAcceptString } from "@/lib/upload-utils";

type Pendencia = {
  id: string;
  case_id: string;
  title: string;
  description: string;
  status: "aberta" | "resolvida";
  client_response: string | null;
  resolved_at: string | null;
  created_by_name: string | null;
  created_at: string;
};

export function PendenciasCard({
  caseId,
  clientName,
  clientPhone,
  portalSlugOrToken,
}: {
  caseId: string;
  clientName?: string | null;
  clientPhone?: string | null;
  portalSlugOrToken?: string | null;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  // Offline resolve dialog state
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveTarget, setResolveTarget] = useState<Pendencia | null>(null);
  const [resolveNote, setResolveNote] = useState("");
  const [resolveFiles, setResolveFiles] = useState<File[]>([]);
  const [resolving, setResolving] = useState(false);

  const { data: pendencias = [], isLoading } = useQuery({
    queryKey: ["case-pendencias", caseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("case_pendencias" as any)
        .select("*")
        .eq("case_id", caseId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as Pendencia[]) ?? [];
    },
    enabled: !!caseId,
  });

  const { data: uploadedDocs = [] } = useQuery({
    queryKey: ["case-uploaded-docs-pendencias", caseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("uploaded_documents")
        .select("id, file_name, file_url, uploaded_at, uploaded_by")
        .eq("case_id", caseId)
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!caseId,
  });

  // Extract attached file names from a client_response string
  const parseAttachedNames = (response: string | null): string[] => {
    if (!response) return [];
    const match = response.match(/📎\s*Documentos anexados:\s*(.+?)(?:\n|$)/);
    if (!match) return [];
    return match[1].split(",").map((s) => s.trim()).filter(Boolean);
  };

  // Strip the "Documentos anexados" line so we display only the textual reply
  const stripAttachmentsLine = (response: string | null): string => {
    if (!response) return "";
    return response.replace(/\n*📎\s*Documentos anexados:.+?(?:\n|$)/g, "").trim();
  };

  const findDocByName = (name: string) =>
    uploadedDocs.find((d) => d.file_name === name);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["case-pendencias", caseId] });

  const abertas = pendencias.filter((p) => p.status === "aberta");
  const resolvidas = pendencias.filter((p) => p.status === "resolvida");

  const handleCreate = async () => {
    const t = title.trim();
    const d = description.trim();
    if (!t || !d) {
      toast.error("Preencha o título e a descrição.");
      return;
    }
    if (t.length > 200 || d.length > 2000) {
      toast.error("Texto muito longo.");
      return;
    }
    for (const f of files) {
      const err = validateFile(f);
      if (err) { toast.error(err); return; }
    }
    setSaving(true);
    try {
      const uploadedNames: string[] = [];
      for (const f of files) {
        const path = buildStoragePath(caseId, f.name, "pendencias");
        const url = await uploadFileToBucket("documentos_clientes", path, f);
        const { error: insErr } = await supabase.from("uploaded_documents").insert({
          case_id: caseId,
          file_name: f.name,
          file_url: url,
          file_type: f.type || null,
          uploaded_by: "office",
        });
        if (insErr) throw insErr;
        uploadedNames.push(f.name);
      }

      const finalDescription = uploadedNames.length > 0
        ? `${d}\n\n📎 Documentos anexados: ${uploadedNames.join(", ")}`
        : d;

      const { error } = await supabase.from("case_pendencias" as any).insert({
        case_id: caseId,
        title: t,
        description: finalDescription,
      });
      if (error) throw error;
      toast.success("Pendência registrada e visível ao cliente.");
      setTitle("");
      setDescription("");
      setFiles([]);
      setOpen(false);
      refresh();
      queryClient.invalidateQueries({ queryKey: ["case-uploaded-docs-pendencias", caseId] });
    } catch (e) {
      console.error(e);
      toast.error("Erro ao salvar pendência.");
    } finally {
      setSaving(false);
    }
  };

  const handleResolveByOffice = async (id: string) => {
    const { error } = await supabase
      .from("case_pendencias" as any)
      .update({ status: "resolvida", resolved_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error("Erro ao marcar como resolvida.");
      return;
    }
    toast.success("Pendência marcada como resolvida.");
    refresh();
  };

  const openResolveDialog = (p: Pendencia) => {
    setResolveTarget(p);
    setResolveNote("");
    setResolveFiles([]);
    setResolveOpen(true);
  };

  const handleResolveWithUpload = async () => {
    if (!resolveTarget) return;
    for (const f of resolveFiles) {
      const err = validateFile(f);
      if (err) { toast.error(err); return; }
    }
    if (resolveFiles.length === 0 && !resolveNote.trim()) {
      toast.error("Anexe pelo menos um arquivo ou adicione uma observação.");
      return;
    }
    setResolving(true);
    try {
      const uploadedNames: string[] = [];
      for (const f of resolveFiles) {
        const path = buildStoragePath(caseId, f.name, "pendencias");
        const url = await uploadFileToBucket("documentos_clientes", path, f);
        const { error: insErr } = await supabase.from("uploaded_documents").insert({
          case_id: caseId,
          file_name: f.name,
          file_url: url,
          file_type: f.type || null,
          uploaded_by: "client",
        });
        if (insErr) throw insErr;
        uploadedNames.push(f.name);
      }

      const noteText = resolveNote.trim();
      const headerLine = "(Recebido fora do portal — registrado pela equipe)";
      const baseText = noteText ? `${headerLine}\n${noteText}` : headerLine;
      const finalResponse = uploadedNames.length > 0
        ? `${baseText}\n📎 Documentos anexados: ${uploadedNames.join(", ")}`
        : baseText;

      const { error } = await supabase
        .from("case_pendencias" as any)
        .update({
          status: "resolvida",
          resolved_at: new Date().toISOString(),
          client_response: finalResponse,
        })
        .eq("id", resolveTarget.id);
      if (error) throw error;

      toast.success("Pendência resolvida e documentos anexados.");
      setResolveOpen(false);
      setResolveTarget(null);
      setResolveNote("");
      setResolveFiles([]);
      refresh();
      queryClient.invalidateQueries({ queryKey: ["case-uploaded-docs-pendencias", caseId] });
    } catch (e) {
      console.error(e);
      toast.error("Erro ao registrar resolução.");
    } finally {
      setResolving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta pendência?")) return;
    const { error } = await supabase.from("case_pendencias" as any).delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir.");
      return;
    }
    refresh();
  };

  const copyMessage = async (p: Pendencia) => {
    if (!portalSlugOrToken) {
      toast.error("Cliente sem link de portal configurado.");
      return;
    }
    const firstName = (clientName ?? "").split(" ")[0] || "Olá";
    const link = getPortalUrl(portalSlugOrToken);
    const msg =
      `Olá ${firstName}, tudo bem?\n\n` +
      `Registramos uma *pendência* na sua declaração de IR que precisa da sua atenção:\n\n` +
      `📌 *${p.title}*\n${p.description}\n\n` +
      `Por favor, acesse seu portal e nos retorne assim que possível para não atrasarmos sua declaração:\n${link}`;
    try {
      await navigator.clipboard.writeText(msg);
      toast.success("Mensagem copiada! Cole no seu sistema de mensagens.");
    } catch {
      toast.error("Não foi possível copiar. Selecione manualmente.");
    }
  };

  return (
    <>
      <Card className={abertas.length > 0 ? "border-destructive/40 shadow-sm" : ""}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertCircle className={`h-4 w-4 ${abertas.length > 0 ? "text-destructive" : "text-muted-foreground"}`} />
                Pendências ao Cliente
                {abertas.length > 0 && (
                  <Badge variant="destructive" className="ml-1">{abertas.length} aberta{abertas.length !== 1 ? "s" : ""}</Badge>
                )}
              </CardTitle>
              <CardDescription>Itens que o cliente precisa resolver — exibidos em destaque no portal</CardDescription>
            </div>
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Nova
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && <p className="text-xs text-muted-foreground">Carregando...</p>}

          {!isLoading && pendencias.length === 0 && (
            <p className="text-sm text-muted-foreground py-3 text-center">Nenhuma pendência registrada.</p>
          )}

          {abertas.map((p) => {
            const internalAttached = parseAttachedNames(p.description);
            const descText = stripAttachmentsLine(p.description);
            return (
            <div key={p.id} className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{p.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">{descText}</p>
                  {internalAttached.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                        <Paperclip className="h-3 w-3" /> Anexos da equipe:
                      </p>
                      <ul className="space-y-1">
                        {internalAttached.map((name, i) => {
                          const doc = findDocByName(name);
                          return (
                            <li key={i} className="text-xs">
                              {doc ? (
                                <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline break-all">
                                  <Download className="h-3 w-3 shrink-0" />{name}
                                </a>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-muted-foreground break-all">
                                  <Paperclip className="h-3 w-3 shrink-0" />{name}
                                </span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Criada em {format(new Date(p.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(p.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyMessage(p)}
                >
                  <Copy className="h-3.5 w-3.5 mr-1" /> Copiar mensagem
                </Button>
                <Button size="sm" variant="outline" onClick={() => openResolveDialog(p)}>
                  <Upload className="h-3.5 w-3.5 mr-1" /> Resolver com anexo
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleResolveByOffice(p.id)}>
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Marcar como resolvida
                </Button>
              </div>
            </div>
          );})}

          {resolvidas.length > 0 && (
            <div className="pt-2 border-t">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">Resolvidas</p>
              <div className="space-y-2">
                {resolvidas.map((p) => {
                  const attachedNames = parseAttachedNames(p.client_response);
                  const responseText = stripAttachmentsLine(p.client_response);
                  return (
                    <div key={p.id} className="rounded-lg border bg-muted/30 p-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium line-through opacity-70">{p.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">{p.description}</p>
                          {responseText && (
                            <p className="text-xs text-foreground mt-1.5 italic whitespace-pre-wrap border-l-2 border-primary/40 pl-2">
                              Resposta do cliente: "{responseText}"
                            </p>
                          )}
                          {attachedNames.length > 0 && (
                            <div className="mt-2 space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                                  <Paperclip className="h-3 w-3" />
                                  Documentos anexados:
                                </p>
                                {attachedNames.filter((n) => findDocByName(n)).length > 1 && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 px-2 text-[11px]"
                                    onClick={async () => {
                                      const docs = attachedNames
                                        .map((n) => findDocByName(n))
                                        .filter(Boolean) as typeof uploadedDocs;
                                      const toastId = toast.loading(`Compactando ${docs.length} arquivos...`);
                                      try {
                                        const JSZip = (await import("jszip")).default;
                                        const zip = new JSZip();
                                        for (const d of docs) {
                                          const res = await fetch(d!.file_url);
                                          if (!res.ok) throw new Error(`Falha em ${d!.file_name}`);
                                          zip.file(d!.file_name, await res.blob());
                                        }
                                        const blob = await zip.generateAsync({ type: "blob" });
                                        const url = URL.createObjectURL(blob);
                                        const safeTitle = p.title.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_").slice(0, 40) || "pendencia";
                                        const a = document.createElement("a");
                                        a.href = url;
                                        a.download = `${safeTitle}_documentos.zip`;
                                        document.body.appendChild(a);
                                        a.click();
                                        a.remove();
                                        URL.revokeObjectURL(url);
                                        toast.success("ZIP baixado com sucesso.", { id: toastId });
                                      } catch (e) {
                                        console.error(e);
                                        toast.error("Erro ao gerar o ZIP.", { id: toastId });
                                      }
                                    }}
                                  >
                                    <Download className="h-3 w-3 mr-1" />
                                    Baixar todos
                                  </Button>
                                )}
                              </div>
                              <ul className="space-y-1">
                                {attachedNames.map((name, i) => {
                                  const doc = findDocByName(name);
                                  return (
                                    <li key={i} className="text-xs">
                                      {doc ? (
                                        <a
                                          href={doc.file_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1 text-primary hover:underline break-all"
                                        >
                                          <Download className="h-3 w-3 shrink-0" />
                                          {name}
                                        </a>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 text-muted-foreground break-all">
                                          <Paperclip className="h-3 w-3 shrink-0" />
                                          {name}
                                          <span className="text-[10px] opacity-70">(arquivo não localizado)</span>
                                        </span>
                                      )}
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          )}
                          {p.resolved_at && (
                            <p className="text-[10px] text-muted-foreground mt-1.5">
                              Resolvida em {format(new Date(p.resolved_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </p>
                          )}
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDelete(p.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova pendência ao cliente</DialogTitle>
            <DialogDescription>
              O cliente verá esta pendência em destaque no portal e poderá respondê-la.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium">Assunto</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Informe atualizado do banco"
                maxLength={200}
              />
            </div>
            <div>
              <label className="text-xs font-medium">Descrição</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Explique o que o cliente precisa fazer/enviar para dar continuidade."
                rows={5}
                maxLength={2000}
              />
            </div>
            <div>
              <label className="text-xs font-medium">Anexos (opcional)</label>
              <div className="mt-1 space-y-2">
                <label className="flex items-center justify-center gap-2 px-3 py-2 border-2 border-dashed rounded-md cursor-pointer hover:bg-muted/50 text-xs text-muted-foreground">
                  <Upload className="h-4 w-4" />
                  <span>Clique para selecionar arquivos</span>
                  <input
                    type="file"
                    multiple
                    accept={getAcceptString()}
                    className="hidden"
                    onChange={(e) => {
                      const list = Array.from(e.target.files ?? []);
                      setFiles((prev) => [...prev, ...list]);
                      e.target.value = "";
                    }}
                  />
                </label>
                {files.length > 0 && (
                  <ul className="space-y-1">
                    {files.map((f, i) => (
                      <li key={i} className="flex items-center justify-between gap-2 text-xs bg-muted/40 rounded px-2 py-1">
                        <span className="truncate flex items-center gap-1">
                          <Paperclip className="h-3 w-3 shrink-0" />{f.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Salvar e exibir ao cliente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
