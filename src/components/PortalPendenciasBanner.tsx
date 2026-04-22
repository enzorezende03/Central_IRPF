import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, CheckCircle2, Loader2, Paperclip, X, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  validateFile,
  getAcceptString,
  uploadFileToBucket,
  buildStoragePath,
  ALLOWED_EXTENSIONS_LABEL,
  MAX_FILE_SIZE_LABEL,
} from "@/lib/upload-utils";

type Pendencia = {
  id: string;
  case_id: string;
  title: string;
  description: string;
  status: "aberta" | "resolvida";
  client_response: string | null;
  created_at: string;
};

export function PortalPendenciasBanner({ caseId }: { caseId: string }) {
  const queryClient = useQueryClient();
  const [responseFor, setResponseFor] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { data: pendencias = [] } = useQuery({
    queryKey: ["portal-pendencias", caseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("case_pendencias" as any)
        .select("*")
        .eq("case_id", caseId)
        .eq("status", "aberta")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as Pendencia[]) ?? [];
    },
    enabled: !!caseId,
    refetchInterval: 30000,
  });

  if (pendencias.length === 0) return null;

  const resetForm = () => {
    setResponseFor(null);
    setResponseText("");
    setFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handlePickFiles = (selected: FileList | null) => {
    if (!selected) return;
    const valid: File[] = [];
    for (const f of Array.from(selected)) {
      const err = validateFile(f);
      if (err) {
        toast.error(err);
        continue;
      }
      valid.push(f);
    }
    setFiles((prev) => [...prev, ...valid]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleResolve = async (id: string) => {
    const text = responseText.trim();
    if (text.length > 2000) {
      toast.error("Resposta muito longa.");
      return;
    }
    if (!text && files.length === 0) {
      toast.error("Escreva uma resposta ou anexe pelo menos um documento.");
      return;
    }
    setSaving(true);
    try {
      // Upload files to storage and register them in uploaded_documents
      const uploadedNames: string[] = [];
      for (const file of files) {
        const path = buildStoragePath(caseId, file.name, "pendencias");
        const url = await uploadFileToBucket("documentos_clientes", path, file);
        const { error: insErr } = await supabase.from("uploaded_documents").insert({
          case_id: caseId,
          file_url: url,
          file_name: file.name,
          file_type: file.type || null,
          uploaded_by: "client",
        });
        if (insErr) throw insErr;
        uploadedNames.push(file.name);
      }

      const composedResponse = [
        text,
        uploadedNames.length > 0
          ? `📎 Documentos anexados: ${uploadedNames.join(", ")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n");

      const { error } = await supabase
        .from("case_pendencias" as any)
        .update({
          status: "resolvida",
          resolved_at: new Date().toISOString(),
          client_response: composedResponse || null,
        })
        .eq("id", id);
      if (error) throw error;

      toast.success("Pendência resolvida. Obrigado!");
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["portal-pendencias", caseId] });
    } catch (e) {
      console.error(e);
      toast.error("Erro ao registrar resposta. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border-2 border-destructive bg-destructive/5 shadow-lg shadow-destructive/10 overflow-hidden"
    >
      <div className="bg-destructive text-destructive-foreground px-4 py-2.5 flex items-center gap-2">
        <motion.div
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <AlertTriangle className="h-5 w-5" />
        </motion.div>
        <p className="font-bold text-sm">
          {pendencias.length === 1
            ? "Você tem 1 pendência aguardando sua ação"
            : `Você tem ${pendencias.length} pendências aguardando sua ação`}
        </p>
      </div>
      <div className="p-3 space-y-2">
        {pendencias.map((p) => (
          <div key={p.id} className="rounded-lg bg-background border border-destructive/30 p-3 space-y-2">
            <div>
              <p className="font-semibold text-sm text-destructive">{p.title}</p>
              <p className="text-sm text-foreground mt-1 whitespace-pre-wrap">{p.description}</p>
            </div>
            <AnimatePresence>
              {responseFor === p.id ? (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2 overflow-hidden"
                >
                  <Textarea
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    placeholder="Escreva uma resposta para a equipe (opcional se anexar documentos)"
                    rows={3}
                    maxLength={2000}
                  />

                  <div className="space-y-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept={getAcceptString()}
                      className="hidden"
                      onChange={(e) => handlePickFiles(e.target.files)}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={saving}
                      className="w-full sm:w-auto"
                    >
                      <Paperclip className="h-4 w-4 mr-1" />
                      Anexar documentos
                    </Button>
                    <p className="text-[11px] text-muted-foreground">
                      Aceitos: {ALLOWED_EXTENSIONS_LABEL} — até {MAX_FILE_SIZE_LABEL} cada
                    </p>

                    {files.length > 0 && (
                      <ul className="space-y-1">
                        {files.map((f, i) => (
                          <li
                            key={i}
                            className="flex items-center justify-between gap-2 rounded-md border bg-muted/40 px-2 py-1 text-xs"
                          >
                            <span className="flex items-center gap-1.5 min-w-0">
                              <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              <span className="truncate">{f.name}</span>
                              <span className="text-muted-foreground shrink-0">
                                ({(f.size / 1024 / 1024).toFixed(2)} MB)
                              </span>
                            </span>
                            <button
                              type="button"
                              onClick={() => removeFile(i)}
                              disabled={saving}
                              className="text-muted-foreground hover:text-destructive shrink-0"
                              aria-label={`Remover ${f.name}`}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" onClick={() => handleResolve(p.id)} disabled={saving} className="flex-1 min-w-[180px]">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                      Enviar resposta e resolver
                    </Button>
                    <Button size="sm" variant="outline" onClick={resetForm} disabled={saving}>
                      Cancelar
                    </Button>
                  </div>
                </motion.div>
              ) : (
                <Button
                  size="sm"
                  className="bg-success text-success-foreground hover:bg-success/90 w-full sm:w-auto"
                  onClick={() => { setResponseFor(p.id); setResponseText(""); setFiles([]); }}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Resolver pendência
                </Button>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
