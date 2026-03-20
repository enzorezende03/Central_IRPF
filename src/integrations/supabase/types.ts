export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      billing: {
        Row: {
          amount: number
          billing_status: Database["public"]["Enums"]["billing_status"]
          case_id: string
          created_at: string
          id: string
          notes: string | null
          payment_date: string | null
          payment_method: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          billing_status?: Database["public"]["Enums"]["billing_status"]
          case_id: string
          created_at?: string
          id?: string
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          billing_status?: Database["public"]["Enums"]["billing_status"]
          case_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "irpf_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      case_answers: {
        Row: {
          answer_text: string | null
          answered_at: string
          case_id: string
          id: string
          question_id: string
        }
        Insert: {
          answer_text?: string | null
          answered_at?: string
          case_id: string
          id?: string
          question_id: string
        }
        Update: {
          answer_text?: string | null
          answered_at?: string
          case_id?: string
          id?: string
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_answers_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "irpf_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "case_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      case_questions: {
        Row: {
          answer_type: Database["public"]["Enums"]["answer_type"]
          case_id: string
          created_at: string
          id: string
          is_required: boolean
          question: string
          sort_order: number
        }
        Insert: {
          answer_type?: Database["public"]["Enums"]["answer_type"]
          case_id: string
          created_at?: string
          id?: string
          is_required?: boolean
          question: string
          sort_order?: number
        }
        Update: {
          answer_type?: Database["public"]["Enums"]["answer_type"]
          case_id?: string
          created_at?: string
          id?: string
          is_required?: boolean
          question?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "case_questions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "irpf_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      case_timeline: {
        Row: {
          case_id: string
          created_at: string
          created_by: string | null
          description: string | null
          event_type: string
          id: string
          visible_to_client: boolean
        }
        Insert: {
          case_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_type: string
          id?: string
          visible_to_client?: boolean
        }
        Update: {
          case_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_type?: string
          id?: string
          visible_to_client?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "case_timeline_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "irpf_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          cpf: string
          created_at: string
          email: string | null
          full_name: string
          id: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          cpf: string
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          cpf?: string
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      document_requests: {
        Row: {
          case_id: string
          category: string | null
          created_at: string
          due_date: string | null
          id: string
          is_required: boolean
          status: Database["public"]["Enums"]["document_status"]
          title: string
        }
        Insert: {
          case_id: string
          category?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          is_required?: boolean
          status?: Database["public"]["Enums"]["document_status"]
          title: string
        }
        Update: {
          case_id?: string
          category?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          is_required?: boolean
          status?: Database["public"]["Enums"]["document_status"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_requests_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "irpf_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      final_deliverables: {
        Row: {
          case_id: string
          id: string
          irpf_file_url: string | null
          preview_feedback: string | null
          preview_file_url: string | null
          preview_status: Database["public"]["Enums"]["preview_status"] | null
          receipt_file_url: string | null
          sent_to_client: boolean
          uploaded_at: string
        }
        Insert: {
          case_id: string
          id?: string
          irpf_file_url?: string | null
          preview_feedback?: string | null
          preview_file_url?: string | null
          preview_status?: Database["public"]["Enums"]["preview_status"] | null
          receipt_file_url?: string | null
          sent_to_client?: boolean
          uploaded_at?: string
        }
        Update: {
          case_id?: string
          id?: string
          irpf_file_url?: string | null
          preview_feedback?: string | null
          preview_file_url?: string | null
          preview_status?: Database["public"]["Enums"]["preview_status"] | null
          receipt_file_url?: string | null
          sent_to_client?: boolean
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "final_deliverables_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: true
            referencedRelation: "irpf_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      irpf_cases: {
        Row: {
          base_year: number
          client_id: string
          client_message: string | null
          created_at: string
          id: string
          internal_notes: string | null
          internal_owner: string | null
          portal_token: string
          priority: Database["public"]["Enums"]["case_priority"]
          progress_percent: number
          status: Database["public"]["Enums"]["case_status"]
          tax_year: number
          updated_at: string
        }
        Insert: {
          base_year?: number
          client_id: string
          client_message?: string | null
          created_at?: string
          id?: string
          internal_notes?: string | null
          internal_owner?: string | null
          portal_token: string
          priority?: Database["public"]["Enums"]["case_priority"]
          progress_percent?: number
          status?: Database["public"]["Enums"]["case_status"]
          tax_year?: number
          updated_at?: string
        }
        Update: {
          base_year?: number
          client_id?: string
          client_message?: string | null
          created_at?: string
          id?: string
          internal_notes?: string | null
          internal_owner?: string | null
          portal_token?: string
          priority?: Database["public"]["Enums"]["case_priority"]
          progress_percent?: number
          status?: Database["public"]["Enums"]["case_status"]
          tax_year?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "irpf_cases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      uploaded_documents: {
        Row: {
          case_id: string
          client_id: string | null
          document_request_id: string | null
          file_name: string
          file_type: string | null
          file_url: string
          id: string
          uploaded_at: string
          uploaded_by: Database["public"]["Enums"]["uploaded_by_type"]
        }
        Insert: {
          case_id: string
          client_id?: string | null
          document_request_id?: string | null
          file_name: string
          file_type?: string | null
          file_url: string
          id?: string
          uploaded_at?: string
          uploaded_by?: Database["public"]["Enums"]["uploaded_by_type"]
        }
        Update: {
          case_id?: string
          client_id?: string | null
          document_request_id?: string | null
          file_name?: string
          file_type?: string | null
          file_url?: string
          id?: string
          uploaded_at?: string
          uploaded_by?: Database["public"]["Enums"]["uploaded_by_type"]
        }
        Relationships: [
          {
            foreignKeyName: "uploaded_documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "irpf_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "uploaded_documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "uploaded_documents_document_request_id_fkey"
            columns: ["document_request_id"]
            isOneToOne: false
            referencedRelation: "document_requests"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_case_by_token: { Args: { p_token: string }; Returns: string }
      recalc_case_progress: { Args: { p_case_id: string }; Returns: undefined }
    }
    Enums: {
      answer_type: "text" | "yes_no" | "number" | "date" | "file"
      billing_status: "nao_cobrado" | "cobrado" | "pago"
      case_priority: "baixa" | "media" | "alta" | "urgente"
      case_status:
        | "aguardando_cliente"
        | "documentos_em_analise"
        | "em_andamento"
        | "pendencia"
        | "finalizado"
      document_status: "pendente" | "enviado" | "aprovado" | "rejeitado"
      preview_status: "aguardando_revisao" | "aprovado" | "ajustes_solicitados"
      uploaded_by_type: "client" | "office"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      answer_type: ["text", "yes_no", "number", "date", "file"],
      billing_status: ["nao_cobrado", "cobrado", "pago"],
      case_priority: ["baixa", "media", "alta", "urgente"],
      case_status: [
        "aguardando_cliente",
        "documentos_em_analise",
        "em_andamento",
        "pendencia",
        "finalizado",
      ],
      document_status: ["pendente", "enviado", "aprovado", "rejeitado"],
      preview_status: ["aguardando_revisao", "aprovado", "ajustes_solicitados"],
      uploaded_by_type: ["client", "office"],
    },
  },
} as const
