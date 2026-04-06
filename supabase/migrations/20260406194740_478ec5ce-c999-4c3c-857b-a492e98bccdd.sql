
CREATE TABLE public.kanban_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  column_order text[] NOT NULL DEFAULT ARRAY['solicitacao_documentacao','procuracao','aguardando_cliente','documentos_parciais','documentos_em_analise','em_andamento','impedida','reaberta','previa_enviada','pendencia','finalizado'],
  hidden_columns text[] NOT NULL DEFAULT '{}',
  saved_filters jsonb NOT NULL DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.kanban_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own kanban preferences"
ON public.kanban_preferences FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own kanban preferences"
ON public.kanban_preferences FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own kanban preferences"
ON public.kanban_preferences FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

CREATE TRIGGER update_kanban_preferences_updated_at
BEFORE UPDATE ON public.kanban_preferences
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
