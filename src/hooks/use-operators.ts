import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Operator {
  user_id: string;
  full_name: string;
}

/**
 * Operadores exibidos no Planejamento.
 * Fonte: tabela `weekly_capacity` (configurada em Configurações → Capacidade Semanal).
 * Apenas quem está cadastrado lá aparece na grade do planejamento.
 */
export function useOperators() {
  return useQuery({
    queryKey: ["operators_list_from_capacity"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weekly_capacity" as any)
        .select("responsible");
      if (error) throw error;
      const names = Array.from(
        new Set(
          ((data || []) as any[])
            .map((r) => (r.responsible || "").trim())
            .filter(Boolean),
        ),
      );
      return names
        .map<Operator>((name) => ({ user_id: name, full_name: name }))
        .sort((a, b) => a.full_name.localeCompare(b.full_name));
    },
  });
}
