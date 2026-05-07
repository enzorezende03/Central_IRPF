import { useState, useRef, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Paperclip, FileText, X, Loader2, Wand2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  validateFile,
  getAcceptString,
  uploadFileToBucket,
  buildStoragePath,
  ALLOWED_EXTENSIONS_LABEL,
  MAX_FILE_SIZE_LABEL,
} from "@/lib/upload-utils";
import { logTimelineEvent } from "@/lib/portal-utils";
import type { Tables } from "@/integrations/supabase/types";

type DocReq = Tables<"document_requests">;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  docRequests: DocReq[];
  onDone: () => void;
}

const UNLINKED = "__unlinked__";

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function autoMatch(fileName: string, candidates: DocReq[]): string {
  const f = normalize(fileName);
  if (!f) return UNLINKED;
  // Score: prefer the candidate with the longest matching token overlap
  let best: { id: string; score: number } | null = null;
  for (const c of candidates) {
    const t = normalize(c.title);
    if (!t) continue;
    let score = 0;
    if (f.includes(t) || t.includes(f)) score = Math.min(t.length, f.length);
    else {
      const fTokens = f.split(" ").filter((x) => x.length > 2);
      const tTokens = new Set(t.split(" ").filter((x) => x.length > 2));
      for (const tk of fTokens) if (tTokens.has(tk)) score += tk.length;
    }
    if (score > 0 && (!best || score > best.score)) best = { id: c.id, score };
  }
  return best ? best.id : UNLINKED;
}

export function BulkUploadDialog({ open, onOpenChange, caseId, docRequests, onDone }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [links, setLinks] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const pendingDocs = useMemo(
    () => docRequests.filter((d) => d.status === "pendente" || d.status === "rejeitado"),
    [docRequests],
  );

  const reset = () => {
    setFiles([]);
    setLinks({});
    if (inputRef.current) inputRef.current.value = "";
  };

  const handlePick = (selected: FileList | null) => {
    if (!selected) return;
    const valid: File[] = [];
    for (const f of Array.from(selected)) {
      const err = validateFile(f);
      if (err) { toast.error(err); continue; }
      valid.push(f);
    }
    setFiles((prev) => [...prev, ...valid]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
    setLinks((prev) => {
      const next: Record<number, string> = {};
      Object.entries(prev).forEach(([k, v]) => {
        const n = Number(k);
        if (n < idx) next[n] = v;
        else if (n > idx) next[n - 1] = v;
      });
      return next;
    });
  };

  const autoLink = () => {
    const next: Record<number, string> = { ...links };
    files.forEach((f, i) => {
      if (!next[i] || next[i] === UNLINKED) next[i] = autoMatch(f.name, pendingDocs);
    });
    setLinks(next);
    const matched = Object.values(next).filter((v) => v && v !== UNLINKED).length;
    toast.success(`${matched} de ${files.length} vinculado(s) automaticamente.`);
  };

  const handleSubmit = async () => {
    if (files.length === 0) { toast.error("Selecione pelo menos um arquivo."); return; }
    setSaving(true);
    try {
      const touchedDocIds = new Set<string>();
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const linkId = links[i];
        const docRequestId = linkId && linkId !== UNLINKED ? linkId : null;
        const subfolder = docRequestId ?? "lote";
        const path = buildStoragePath(caseId, file.name, subfolder);
        const url = await uploadFileToBucket("documentos_clientes", path, file);
        const { error: insErr } = await supabase.from("uploaded_documents").insert({
          case_id: caseId,
          document_request_id: docRequestId,
          file_name: file.name,
          file_url: url,
          file_type: file.type || null,
          uploaded_by: "office",
        });
        if (insErr) throw insErr;
        if (docRequestId) touchedDocIds.add(docRequestId);
      }

      // Marca itens vinculados como "enviado"
      for (const docId of touchedDocIds) {
        await supabase
          .from("document_requests")
          .update({ status: "enviado" })
          .eq("id", docId);
        const doc = pendingDocs.find((d) => d.id === docId);
        await logTimelineEvent(
          caseId,
          "Documento recebido fora do portal",
          `Equipe anexou arquivo(s) referente(s) a "${doc?.title ?? "item"}" recebido(s) por e-mail/WhatsApp.`,
        );
      }

      toast.success(
        `${files.length} arquivo(s) enviados${touchedDocIds.size > 0 ? `, ${touchedDocIds.size} item(ns) marcado(s) como recebido(s)` : ""}.`,
      );
      reset();
      onOpenChange(false);
      onDone();
    } catch (e) {
      console.error(e);
      toast.error("Erro ao enviar arquivos. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => { if (!saving) { onOpenChange(o); if (!o) reset(); } }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Anexar documentos em lote
          </DialogTitle>
          <DialogDescription>
            Para arquivos recebidos por e-mail ou WhatsApp. Vincule cada arquivo ao item do checklist correspondente para dar baixa nos pendentes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={getAcceptString()}
              className="hidden"
              onChange={(e) => handlePick(e.target.files)}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => inputRef.current?.click()}
              disabled={saving}
              className="w-full"
            >
              <Paperclip className="h-4 w-4 mr-2" />
              {files.length === 0 ? "Selecionar arquivos" : "Adicionar mais arquivos"}
            </Button>
            <p className="text-[11px] text-muted-foreground mt-1">
              Aceitos: {ALLOWED_EXTENSIONS_LABEL} — até {MAX_FILE_SIZE_LABEL} cada
            </p>
          </div>

          {files.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  {files.length} arquivo(s) · vincule aos itens pendentes
                </p>
                {pendingDocs.length > 0 && (
                  <Button type="button" variant="ghost" size="sm" onClick={autoLink} disabled={saving}>
                    <Wand2 className="h-3.5 w-3.5 mr-1" />
                    Auto-vincular por nome
                  </Button>
                )}
              </div>

              <div className="max-h-[360px] overflow-y-auto space-y-2 pr-1">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-md border bg-muted/40 p-2">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs truncate font-medium">{f.name}</p>
                      <p className="text-[10px] text-muted-foreground">{(f.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    <Select
                      value={links[i] ?? UNLINKED}
                      onValueChange={(v) => setLinks((prev) => ({ ...prev, [i]: v }))}
                      disabled={saving}
                    >
                      <SelectTrigger className="h-8 w-[240px] text-xs">
                        <SelectValue placeholder="Vincular a..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNLINKED}>Avulso (sem vincular)</SelectItem>
                        {pendingDocs.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      disabled={saving}
                      className="text-muted-foreground hover:text-destructive shrink-0"
                      aria-label={`Remover ${f.name}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              {pendingDocs.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Não há itens pendentes no checklist. Os arquivos serão salvos como avulsos.
                </p>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving || files.length === 0}>
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
            Enviar {files.length > 0 ? `(${files.length})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
