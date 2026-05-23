import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useLastClientUploads() {
  return useQuery({
    queryKey: ["last-client-uploads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("uploaded_documents")
        .select("case_id, uploaded_at")
        .eq("uploaded_by", "client")
        .order("uploaded_at", { ascending: false })
        .limit(10000);
      if (error) throw error;
      const map = new Map<string, string>();
      (data ?? []).forEach((row: any) => {
        if (!map.has(row.case_id)) map.set(row.case_id, row.uploaded_at);
      });
      return map;
    },
    staleTime: 2 * 60_000,
    gcTime: 10 * 60_000,
  });
}
