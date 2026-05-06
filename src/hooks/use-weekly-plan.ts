import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface WeeklyPlanItem {
  id: string;
  season_id: string;
  week_number: number;
  case_id: string;
  responsible: string | null;
  planned_by: string | null;
  created_at: string;
}

/** All plan items for a season (used to know which cases are already planned). */
export function useSeasonPlan(seasonId: string | null | undefined) {
  return useQuery({
    queryKey: ["irpf_weekly_plan_season", seasonId],
    enabled: !!seasonId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("irpf_weekly_plan" as any)
        .select("*")
        .eq("season_id", seasonId!);
      if (error) throw error;
      return (data || []) as unknown as WeeklyPlanItem[];
    },
  });
}

/** All plan items across all seasons — used to flag planned cases (e.g. in Kanban). */
export function useAllPlanItems() {
  return useQuery({
    queryKey: ["irpf_weekly_plan_all"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("irpf_weekly_plan" as any)
        .select("case_id, week_number, season_id, responsible");
      if (error) throw error;
      return (data || []) as unknown as Array<Pick<WeeklyPlanItem, "case_id" | "week_number" | "season_id" | "responsible">>;
    },
  });
}

export function useAddToPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      items: Array<{ season_id: string; week_number: number; case_id: string; responsible: string | null }>
    ) => {
      if (items.length === 0) return;
      const { data: userData } = await supabase.auth.getUser();
      const planned_by = userData?.user?.id ?? null;
      const rows = items.map((i) => ({ ...i, planned_by }));
      const { error } = await supabase.from("irpf_weekly_plan" as any).insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["irpf_weekly_plan_season"] });
      toast({ title: "Planejamento atualizado" });
    },
    onError: (e: any) => toast({ title: "Erro ao planejar", description: e.message, variant: "destructive" }),
  });
}

export function useRemoveFromPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("irpf_weekly_plan" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["irpf_weekly_plan_season"] });
    },
  });
}

export interface EligibleCase {
  id: string;
  internal_owner: string | null;
  status: string;
  docs_received_at: string | null;
  created_at: string;
  earliest_doc_at: string | null; // min uploaded_at
  client_name: string | null;
  client_cpf: string | null;
}

/** Eligible cases (not finalized/dispensada), enriched with the earliest doc upload date. */
export function useEligibleCases() {
  return useQuery({
    queryKey: ["irpf_eligible_cases"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data: cases, error } = await supabase
        .from("irpf_cases")
        .select("id, internal_owner, status, docs_received_at, created_at, clients(full_name, cpf)")
        .not("status", "in", "(finalizado,dispensada)")
        .limit(5000);
      if (error) throw error;

      const ids = (cases || []).map((c: any) => c.id);
      let earliestByCase = new Map<string, string>();
      if (ids.length > 0) {
        const { data: docs, error: dErr } = await supabase
          .from("uploaded_documents")
          .select("case_id, uploaded_at")
          .in("case_id", ids)
          .limit(20000);
        if (dErr) throw dErr;
        for (const d of docs || []) {
          const prev = earliestByCase.get((d as any).case_id);
          if (!prev || (d as any).uploaded_at < prev) {
            earliestByCase.set((d as any).case_id, (d as any).uploaded_at);
          }
        }
      }

      return (cases || []).map((c: any): EligibleCase => ({
        id: c.id,
        internal_owner: c.internal_owner,
        status: c.status,
        docs_received_at: c.docs_received_at,
        created_at: c.created_at,
        earliest_doc_at: earliestByCase.get(c.id) ?? null,
        client_name: c.clients?.full_name ?? null,
        client_cpf: c.clients?.cpf ?? null,
      }));
    },
  });
}

/** Computes the "reference date" used for ordering suggestions (oldest first). */
export function getReferenceDate(c: EligibleCase): string {
  return c.docs_received_at ?? c.earliest_doc_at ?? c.created_at;
}
