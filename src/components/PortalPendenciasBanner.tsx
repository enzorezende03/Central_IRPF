import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

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
  const [saving, setSaving] = useState(false);

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

  const handleResolve = async (id: string) => {
    const text = responseText.trim();
    if (text.length > 2000) {
      toast.error("Resposta muito longa.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("case_pendencias" as any)
        .update({
          status: "resolvida",
          resolved_at: new Date().toISOString(),
          client_response: text || null,
        })
        .eq("id", id);
      if (error) throw error;
      toast.success("Pendência marcada como resolvida. Obrigado!");
      setResponseFor(null);
      setResponseText("");
      queryClient.invalidateQueries({ queryKey: ["portal-pendencias", caseId] });
    } catch {
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
                    placeholder="Conte para a equipe como você resolveu (opcional)"
                    rows={3}
                    maxLength={2000}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleResolve(p.id)} disabled={saving} className="flex-1">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                      Confirmar resolução
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setResponseFor(null); setResponseText(""); }} disabled={saving}>
                      Cancelar
                    </Button>
                  </div>
                </motion.div>
              ) : (
                <Button
                  size="sm"
                  className="bg-success text-success-foreground hover:bg-success/90 w-full sm:w-auto"
                  onClick={() => { setResponseFor(p.id); setResponseText(""); }}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Já resolvi esta pendência
                </Button>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
