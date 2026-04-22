import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertCircle, CheckCircle2, Plus, Trash2, MessageCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getPortalUrl } from "@/lib/portal-utils";

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
  const [saving, setSaving] = useState(false);

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
    setSaving(true);
    try {
      const { error } = await supabase.from("case_pendencias" as any).insert({
        case_id: caseId,
        title: t,
        description: d,
      });
      if (error) throw error;
      toast.success("Pendência registrada e visível ao cliente.");
      setTitle("");
      setDescription("");
      setOpen(false);
      refresh();
    } catch (e) {
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

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta pendência?")) return;
    const { error } = await supabase.from("case_pendencias" as any).delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir.");
      return;
    }
    refresh();
  };

  const sendWhatsApp = (p: Pendencia) => {
    if (!clientPhone || !portalSlugOrToken) {
      toast.error("Cliente sem telefone ou link de portal configurado.");
      return;
    }
    const phone = clientPhone.replace(/\D/g, "");
    const firstName = (clientName ?? "").split(" ")[0] || "Olá";
    const link = getPortalUrl(portalSlugOrToken);
    const msg =
      `Olá ${firstName}, tudo bem?\n\n` +
      `Registramos uma *pendência* na sua declaração de IR que precisa da sua atenção:\n\n` +
      `📌 *${p.title}*\n${p.description}\n\n` +
      `Por favor, acesse seu portal e nos retorne assim que possível para não atrasarmos sua declaração:\n${link}`;
    const url = `https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
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

          {abertas.map((p) => (
            <div key={p.id} className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{p.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">{p.description}</p>
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
                  className="bg-success text-success-foreground hover:bg-success/90 border-success"
                  onClick={() => sendWhatsApp(p)}
                >
                  <MessageCircle className="h-3.5 w-3.5 mr-1" /> Avisar via WhatsApp
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleResolveByOffice(p.id)}>
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Marcar como resolvida
                </Button>
              </div>
            </div>
          ))}

          {resolvidas.length > 0 && (
            <div className="pt-2 border-t">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">Resolvidas</p>
              <div className="space-y-2">
                {resolvidas.map((p) => (
                  <div key={p.id} className="rounded-lg border bg-muted/30 p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium line-through opacity-70">{p.title}</p>
                        {p.client_response && (
                          <p className="text-xs text-muted-foreground mt-1 italic">
                            Resposta do cliente: "{p.client_response}"
                          </p>
                        )}
                        {p.resolved_at && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Resolvida em {format(new Date(p.resolved_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </p>
                        )}
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDelete(p.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
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
