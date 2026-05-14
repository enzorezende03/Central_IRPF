import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Operator {
  user_id: string;
  full_name: string;
}

/** Internal users with role 'operacional', joined with profiles for display name. */
export function useOperators() {
  return useQuery({
    queryKey: ["operators_list"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data: roles, error } = await supabase
        .from("user_roles" as any)
        .select("user_id, role")
        .eq("role", "operacional");
      if (error) throw error;
      const ids = ((roles || []) as any[]).map((r) => r.user_id);
      if (ids.length === 0) return [] as Operator[];
      const { data: profs, error: pErr } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", ids);
      if (pErr) throw pErr;
      return ((profs || []) as any[])
        .map<Operator>((p) => ({
          user_id: p.id,
          full_name: (p.full_name && p.full_name.trim()) || p.email || "Sem nome",
        }))
        .sort((a, b) => a.full_name.localeCompare(b.full_name));
    },
  });
}
