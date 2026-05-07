import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type CaseWithClient = Tables<"irpf_cases"> & {
  clients: Tables<"clients"> | null;
  billing: Tables<"billing">[];
  final_deliverables: Tables<"final_deliverables">[];
  internal_checklist: Tables<"internal_checklist">[];
};

type DeletedMode = "active" | "deleted" | "all";

async function fetchCasesWithClients(mode: DeletedMode = "active"): Promise<CaseWithClient[]> {
  let query = supabase
    .from("irpf_cases")
    .select("*, clients(*), billing(*), final_deliverables(*), internal_checklist(*)")
    .order("updated_at", { ascending: false });
  if (mode === "active") {
    query = query.is("deleted_at", null);
  } else if (mode === "deleted") {
    query = query.not("deleted_at", "is", null);
  }
  const { data, error } = await query;

  if (error) throw error;
  return (data as unknown as CaseWithClient[]) ?? [];
}

export function useCases(includeDeleted: boolean | DeletedMode = false) {
  const mode: DeletedMode =
    typeof includeDeleted === "string" ? includeDeleted : includeDeleted ? "deleted" : "active";
  return useQuery({
    queryKey: ["irpf-cases", { mode }],
    queryFn: () => fetchCasesWithClients(mode),
  });
}

export function useCase(id: string | undefined) {
  return useQuery({
    queryKey: ["irpf-case", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("irpf_cases")
.select("*, clients(*), billing(*), final_deliverables(*), internal_checklist(*)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as unknown as CaseWithClient;
    },
    enabled: !!id,
  });
}
