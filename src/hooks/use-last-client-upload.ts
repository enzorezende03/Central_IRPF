import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useLastClientUploads() {
  return useQuery({
    queryKey: ["last-client-uploads"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_last_client_uploads");
      if (error) throw error;
      const map = new Map<string, string>();
      (data ?? []).forEach((row: any) => {
        if (row?.case_id && row?.last_uploaded_at) {
          map.set(row.case_id, row.last_uploaded_at);
        }
      });
      return map;
    },
    staleTime: 2 * 60_000,
    gcTime: 10 * 60_000,
  });
}
