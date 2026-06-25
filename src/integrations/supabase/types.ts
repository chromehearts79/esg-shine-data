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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string
          diff: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          diff?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          diff?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      indicator_attachments: {
        Row: {
          created_at: string
          file_name: string
          id: string
          indicator_id: string
          mime_type: string | null
          note: string | null
          period_quarter: number | null
          period_year: number | null
          size_bytes: number | null
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          indicator_id: string
          mime_type?: string | null
          note?: string | null
          period_quarter?: number | null
          period_year?: number | null
          size_bytes?: number | null
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          indicator_id?: string
          mime_type?: string | null
          note?: string | null
          period_quarter?: number | null
          period_year?: number | null
          size_bytes?: number | null
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "indicator_attachments_indicator_id_fkey"
            columns: ["indicator_id"]
            isOneToOne: false
            referencedRelation: "indicators"
            referencedColumns: ["id"]
          },
        ]
      }
      indicator_categories: {
        Row: {
          code: string
          created_at: string
          description: string | null
          esg_type: Database["public"]["Enums"]["esg_type"]
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          esg_type: Database["public"]["Enums"]["esg_type"]
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          esg_type?: Database["public"]["Enums"]["esg_type"]
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      indicator_narratives: {
        Row: {
          content: string | null
          created_at: string
          id: string
          indicator_id: string
          period_quarter: number | null
          period_year: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          indicator_id: string
          period_quarter?: number | null
          period_year: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          indicator_id?: string
          period_quarter?: number | null
          period_year?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "indicator_narratives_indicator_id_fkey"
            columns: ["indicator_id"]
            isOneToOne: false
            referencedRelation: "indicators"
            referencedColumns: ["id"]
          },
        ]
      }
      indicator_table_cells_schema: {
        Row: {
          col_no: number
          id: string
          is_input: boolean
          label: string
          row_no: number
          table_id: string
        }
        Insert: {
          col_no: number
          id?: string
          is_input?: boolean
          label: string
          row_no: number
          table_id: string
        }
        Update: {
          col_no?: number
          id?: string
          is_input?: boolean
          label?: string
          row_no?: number
          table_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "indicator_table_cells_schema_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "indicator_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      indicator_table_values: {
        Row: {
          col_no: number
          created_at: string
          id: string
          numeric_value: number | null
          period_year: number
          row_no: number
          table_id: string
          text_value: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          col_no: number
          created_at?: string
          id?: string
          numeric_value?: number | null
          period_year: number
          row_no: number
          table_id: string
          text_value?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          col_no?: number
          created_at?: string
          id?: string
          numeric_value?: number | null
          period_year?: number
          row_no?: number
          table_id?: string
          text_value?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "indicator_table_values_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "indicator_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      indicator_tables: {
        Row: {
          created_at: string
          description: string | null
          id: string
          indicator_id: string
          sort_order: number
          table_no: number
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          indicator_id: string
          sort_order?: number
          table_no: number
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          indicator_id?: string
          sort_order?: number
          table_no?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "indicator_tables_indicator_id_fkey"
            columns: ["indicator_id"]
            isOneToOne: false
            referencedRelation: "indicators"
            referencedColumns: ["id"]
          },
        ]
      }
      indicator_values: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          indicator_id: string
          note: string | null
          numeric_value: number | null
          period_quarter: number | null
          period_year: number
          source: string | null
          text_value: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          indicator_id: string
          note?: string | null
          numeric_value?: number | null
          period_quarter?: number | null
          period_year: number
          source?: string | null
          text_value?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          indicator_id?: string
          note?: string | null
          numeric_value?: number | null
          period_quarter?: number | null
          period_year?: number
          source?: string | null
          text_value?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "indicator_values_indicator_id_fkey"
            columns: ["indicator_id"]
            isOneToOne: false
            referencedRelation: "indicators"
            referencedColumns: ["id"]
          },
        ]
      }
      indicators: {
        Row: {
          category_id: string | null
          code: string
          created_at: string
          cycle: string | null
          department: string | null
          description: string | null
          evidence_required: string | null
          excluded_reason: string | null
          guideline_ref: string | null
          id: string
          input_method: string
          is_active: boolean
          name: string
          sort_order: number
          type: Database["public"]["Enums"]["indicator_type"]
          unit: string | null
          updated_at: string
          writing_guide: string | null
        }
        Insert: {
          category_id?: string | null
          code: string
          created_at?: string
          cycle?: string | null
          department?: string | null
          description?: string | null
          evidence_required?: string | null
          excluded_reason?: string | null
          guideline_ref?: string | null
          id?: string
          input_method?: string
          is_active?: boolean
          name: string
          sort_order?: number
          type?: Database["public"]["Enums"]["indicator_type"]
          unit?: string | null
          updated_at?: string
          writing_guide?: string | null
        }
        Update: {
          category_id?: string | null
          code?: string
          created_at?: string
          cycle?: string | null
          department?: string | null
          description?: string | null
          evidence_required?: string | null
          excluded_reason?: string | null
          guideline_ref?: string | null
          id?: string
          input_method?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          type?: Database["public"]["Enums"]["indicator_type"]
          unit?: string | null
          updated_at?: string
          writing_guide?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "indicators_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "indicator_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_list_users: {
        Args: never
        Returns: {
          created_at: string
          display_name: string
          email: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }[]
      }
      admin_set_user_role: {
        Args: {
          _new_role: Database["public"]["Enums"]["app_role"]
          _target: string
        }
        Returns: undefined
      }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "editor" | "viewer"
      esg_type: "E" | "S" | "G"
      indicator_type: "quantitative" | "qualitative"
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
      app_role: ["admin", "editor", "viewer"],
      esg_type: ["E", "S", "G"],
      indicator_type: ["quantitative", "qualitative"],
    },
  },
} as const
