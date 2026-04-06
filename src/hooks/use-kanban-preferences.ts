import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

const DEFAULT_COLUMNS = [
  "solicitacao_documentacao",
  "procuracao",
  "aguardando_cliente",
  "documentos_parciais",
  "documentos_em_analise",
  "em_andamento",
  "impedida",
  "reaberta",
  "previa_enviada",
  "pendencia",
  "finalizado",
];

export type KanbanPreferences = {
  column_order: string[];
  hidden_columns: string[];
  saved_filters: Record<string, string>;
};

const DEFAULTS: KanbanPreferences = {
  column_order: DEFAULT_COLUMNS,
  hidden_columns: [],
  saved_filters: {},
};

export function useKanbanPreferences() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["kanban-preferences", user?.id],
    queryFn: async (): Promise<KanbanPreferences> => {
      if (!user) return DEFAULTS;
      const { data, error } = await supabase
        .from("kanban_preferences")
        .select("column_order, hidden_columns, saved_filters")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return DEFAULTS;
      return {
        column_order: (data.column_order as string[]) ?? DEFAULTS.column_order,
        hidden_columns: (data.hidden_columns as string[]) ?? [],
        saved_filters: (data.saved_filters as Record<string, string>) ?? {},
      };
    },
    enabled: !!user,
  });

  const mutation = useMutation({
    mutationFn: async (prefs: Partial<KanbanPreferences>) => {
      if (!user) return;
      const { error } = await supabase
        .from("kanban_preferences")
        .upsert(
          { user_id: user.id, ...prefs, updated_at: new Date().toISOString() },
          { onConflict: "user_id" }
        );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kanban-preferences"] }),
  });

  return {
    preferences: query.data ?? DEFAULTS,
    isLoading: query.isLoading,
    savePreferences: mutation.mutate,
    isSaving: mutation.isPending,
  };
}
