import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Landmark, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import {
  RECEITA_SITUACOES, RECEITA_SITUACAO_MAP, MALHA_STATUS_OPTIONS,
  type ReceitaSituacao, type MalhaStatus,
} from "@/lib/receita-situacao";

type Props = {
  caseId: string;
  initialSituacao: ReceitaSituacao | null;
  initialSituacaoEm: string | null;
  initialSituacaoPorId: string | null;
  initialMalhaMotivo: string | null;
  initialMalhaStatus: MalhaStatus | null;
};

export function ReceitaSituacaoCard({
  caseId,
  initialSituacao,
  initialSituacaoEm,
  initialSituacaoPorId,
  initialMalhaMotivo,
  initialMalhaStatus,
}: Props) {
  const qc = useQueryClient();
  const { user, profileName } = useAuth() as any;
  const [situacao, setSituacao] = useState<ReceitaSituacao | "">(initialSituacao ?? "");
  const [malhaMotivo, setMalhaMotivo] = useState(initialMalhaMotivo ?? "");
  const [malhaStatus, setMalhaStatus] = useState<MalhaStatus | "">(initialMalhaStatus ?? "");
  const [saving, setSaving] = useState(false);
  const [suggestRegularizada, setSuggestRegularizada] = useState(false);

  // Author name lookup
  const { data: autorProfile } = useQuery({
    queryKey: ["profile-name", initialSituacaoPorId],
    enabled: !!initialSituacaoPorId,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", initialSituacaoPorId!)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    setSituacao(initialSituacao ?? "");
    setMalhaMotivo(initialMalhaMotivo ?? "");
    setMalhaStatus(initialMalhaStatus ?? "");
  }, [initialSituacao, initialMalhaMotivo, initialMalhaStatus]);

  const handleMalhaStatusChange = (v: MalhaStatus) => {
    setMalhaStatus(v);
    if (v === "regularizada" && situacao === "em_malha") {
      setSuggestRegularizada(true);
    } else {
      setSuggestRegularizada(false);
    }
  };

  const handleSave = async () => {
    if (!situacao) {
      toast.error("Selecione uma situação.");
      return;
    }
    if (situacao === "em_malha") {
      if (!malhaMotivo.trim()) {
        toast.error("Informe o motivo da malha.");
        return;
      }
      if (!malhaStatus) {
        toast.error("Selecione o status da malha.");
        return;
      }
    }
    setSaving(true);
    const payload: any = {
      receita_situacao: situacao,
      receita_situacao_em: new Date().toISOString(),
      receita_situacao_por: user?.id ?? null,
    };
    if (situacao === "em_malha") {
      payload.malha_motivo = malhaMotivo.trim();
      payload.malha_status = malhaStatus;
    } else {
      payload.malha_motivo = null;
      payload.malha_status = null;
    }
    const { error } = await supabase.from("irpf_cases").update(payload).eq("id", caseId);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar acompanhamento da Receita Federal.");
      return;
    }
    await supabase.from("case_timeline").insert({
      case_id: caseId,
      event_type: "Receita Federal atualizada",
      description: `Situação alterada para "${RECEITA_SITUACAO_MAP[situacao].label}"`,
      visible_to_client: false,
      created_by: profileName ?? user?.email ?? "sistema",
    });
    toast.success("Acompanhamento da Receita Federal atualizado.");
    qc.invalidateQueries({ queryKey: ["case-detail", caseId] });
    qc.invalidateQueries({ queryKey: ["irpf-cases"] });
    qc.invalidateQueries({ queryKey: ["irpf-case", caseId] });
  };

  const confirmarRegularizada = () => {
    setSituacao("malha_regularizada");
    setSuggestRegularizada(false);
  };

  const current = situacao ? RECEITA_SITUACAO_MAP[situacao] : null;
  const autorNome = autorProfile?.full_name || autorProfile?.email || null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Landmark className="h-4 w-4 text-primary" />
          Receita Federal
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Situação</label>
          <Select value={situacao} onValueChange={(v) => setSituacao(v as ReceitaSituacao)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a situação..." />
            </SelectTrigger>
            <SelectContent>
              {RECEITA_SITUACOES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  <span className="inline-flex items-center gap-2">
                    <span>{s.icon}</span>
                    <span>{s.label}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {current && (
            <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium mt-1", current.badgeClass)}>
              <span>{current.icon}</span> {current.label}
            </span>
          )}
        </div>

        {situacao === "em_malha" && (
          <div className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <div className="space-y-2">
              <label className="text-xs font-medium">Motivo da malha</label>
              <Textarea
                value={malhaMotivo}
                onChange={(e) => setMalhaMotivo(e.target.value)}
                placeholder="Descreva o motivo identificado na Receita Federal"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium">Status da malha</label>
              <Select value={malhaStatus} onValueChange={(v) => handleMalhaStatusChange(v as MalhaStatus)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o status..." />
                </SelectTrigger>
                <SelectContent>
                  {MALHA_STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {suggestRegularizada && (
              <div className="flex items-center justify-between gap-3 rounded-md border border-blue-500/30 bg-blue-500/10 p-2 text-xs">
                <span>Deseja marcar a situação como <strong>Malha regularizada</strong>?</span>
                <Button size="sm" variant="outline" onClick={confirmarRegularizada}>
                  Confirmar
                </Button>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            {initialSituacaoEm && (
              <>
                Atualizado em {format(new Date(initialSituacaoEm), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                {autorNome ? ` por ${autorNome}` : ""}
              </>
            )}
          </div>
          <Button onClick={handleSave} disabled={saving} size="sm">
            <Save className="h-4 w-4 mr-1.5" />
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
