import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export const DEFAULT_WEEKLY_CAPACITY = 10;

export interface WeeklyCapacity {
  id: string;
  responsible: string;
  capacity: number;
}

export function useCapacities() {
  return useQuery({
    queryKey: ["weekly_capacity"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weekly_capacity" as any)
        .select("id, responsible, capacity");
      if (error) throw error;
      return (data || []) as unknown as WeeklyCapacity[];
    },
  });
}

export function useUpsertCapacity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { responsible: string; capacity: number }) => {
      const { error } = await supabase
        .from("weekly_capacity" as any)
        .upsert(
          { responsible: input.responsible, capacity: input.capacity, updated_at: new Date().toISOString() },
          { onConflict: "responsible" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["weekly_capacity"] });
      toast({ title: "Capacidade atualizada" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });
}

export function getCapacityFor(
  responsible: string,
  caps: WeeklyCapacity[]
): number {
  return caps.find((c) => c.responsible === responsible)?.capacity ?? DEFAULT_WEEKLY_CAPACITY;
}
