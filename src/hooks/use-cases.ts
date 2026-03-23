import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type CaseWithClient = Tables<"irpf_cases"> & {
  clients: Tables<"clients"> | null;
  billing: Tables<"billing">[];
  final_deliverables: Tables<"final_deliverables">[];
};

async function fetchCasesWithClients(): Promise<CaseWithClient[]> {
  const { data, error } = await supabase
    .from("irpf_cases")
    .select("*, clients(*), billing(*)")
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data as unknown as CaseWithClient[]) ?? [];
}

export function useCases() {
  return useQuery({
    queryKey: ["irpf-cases"],
    queryFn: fetchCasesWithClients,
  });
}

export function useCase(id: string | undefined) {
  return useQuery({
    queryKey: ["irpf-case", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("irpf_cases")
        .select("*, clients(*), billing(*)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as unknown as CaseWithClient;
    },
    enabled: !!id,
  });
}
