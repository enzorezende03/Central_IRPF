import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface SeasonConfig {
  id: string;
  season_year: number;
  start_date: string; // YYYY-MM-DD
  deadline_date: string;
  total_planned: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface WeeklyGoal {
  id: string;
  season_id: string;
  week_number: number;
  week_start: string;
  week_end: string;
  goal_count: number;
}

export function useSeasons() {
  return useQuery({
    queryKey: ["irpf_seasons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("irpf_season_config" as any)
        .select("*")
        .order("season_year", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as SeasonConfig[];
    },
  });
}

export function useWeeklyGoals(seasonId: string | null | undefined) {
  return useQuery({
    queryKey: ["irpf_weekly_goals", seasonId],
    enabled: !!seasonId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("irpf_weekly_goals" as any)
        .select("*")
        .eq("season_id", seasonId!)
        .order("week_number", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as WeeklyGoal[];
    },
  });
}

export function useUpsertSeason() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<SeasonConfig> & { season_year: number; start_date: string; deadline_date: string; total_planned: number; }) => {
      const { data, error } = await supabase
        .from("irpf_season_config" as any)
        .upsert(payload, { onConflict: "season_year" })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as SeasonConfig;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["irpf_seasons"] });
      toast({ title: "Temporada salva", description: "Configuração atualizada com sucesso." });
    },
    onError: (e: any) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });
}

export function useDeleteSeason() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("irpf_season_config" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["irpf_seasons"] });
      toast({ title: "Temporada excluída" });
    },
  });
}

export function useReplaceWeeklyGoals() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ seasonId, weeks }: { seasonId: string; weeks: Omit<WeeklyGoal, "id" | "season_id">[] }) => {
      // Replace all goals for the season
      const { error: delErr } = await supabase.from("irpf_weekly_goals" as any).delete().eq("season_id", seasonId);
      if (delErr) throw delErr;
      if (weeks.length === 0) return;
      const rows = weeks.map((w) => ({ ...w, season_id: seasonId }));
      const { error } = await supabase.from("irpf_weekly_goals" as any).insert(rows);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["irpf_weekly_goals", vars.seasonId] });
    },
  });
}

export function useUpdateWeeklyGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, goal_count }: { id: string; goal_count: number }) => {
      const { error } = await supabase
        .from("irpf_weekly_goals" as any)
        .update({ goal_count })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["irpf_weekly_goals"] });
    },
  });
}

/**
 * Fetches cases that count toward the season goal: finalized OR with preview sent.
 * Uses updated_at as the proxy for "completion date".
 *
 * IMPORTANT: We intentionally fetch everything up to the deadline (no lower
 * bound) so that work already delivered BEFORE the season officially starts
 * is absorbed by week 1. The page-level logic decides how to bucket it.
 */
export function useFinalizedCasesInRange(start: string | undefined, end: string | undefined) {
  return useQuery({
    queryKey: ["irpf_realized_in_range", end],
    enabled: !!start && !!end,
    queryFn: async () => {
      // include the end day fully
      const endDate = new Date(`${end}T00:00:00`);
      endDate.setDate(endDate.getDate() + 1);
      const endIso = endDate.toISOString();

      const { data, error } = await supabase
        .from("irpf_cases")
        .select("id, status, updated_at, created_at")
        .in("status", ["finalizado", "previa_enviada"])
        .lt("updated_at", endIso);
      if (error) throw error;
      return data || [];
    },
  });
}
