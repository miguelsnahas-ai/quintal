// Generated from the Supabase project (familyos) schema.
// Regenerate after every migration: see `mcp__Supabase__generate_typescript_types`.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_feedback: {
        Row: {
          activity_id: string
          caregiver_id: string | null
          child_id: string | null
          created_at: string
          helpful: boolean
          id: string
        }
        Insert: {
          activity_id: string
          caregiver_id?: string | null
          child_id?: string | null
          created_at?: string
          helpful: boolean
          id?: string
        }
        Update: {
          activity_id?: string
          caregiver_id?: string | null
          child_id?: string | null
          created_at?: string
          helpful?: boolean
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_feedback_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "knowledge_chunks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_feedback_caregiver_id_fkey"
            columns: ["caregiver_id"]
            isOneToOne: false
            referencedRelation: "caregivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_feedback_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_settings: {
        Row: {
          custom_instructions: string
          id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          custom_instructions?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          custom_instructions?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      caregiver_sessions: {
        Row: {
          caregiver_id: string
          created_at: string
          token: string
        }
        Insert: {
          caregiver_id: string
          created_at?: string
          token: string
        }
        Update: {
          caregiver_id?: string
          created_at?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "caregiver_sessions_caregiver_id_fkey"
            columns: ["caregiver_id"]
            isOneToOne: false
            referencedRelation: "caregivers"
            referencedColumns: ["id"]
          },
        ]
      }
      caregivers: {
        Row: {
          created_at: string
          family_id: string
          id: string
          is_primary_contact: boolean
          name: string
          phone_number: string
          role: string | null
        }
        Insert: {
          created_at?: string
          family_id: string
          id?: string
          is_primary_contact?: boolean
          name: string
          phone_number: string
          role?: string | null
        }
        Update: {
          created_at?: string
          family_id?: string
          id?: string
          is_primary_contact?: boolean
          name?: string
          phone_number?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "caregivers_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      children: {
        Row: {
          birth_date: string | null
          created_at: string
          family_id: string
          id: string
          name: string
          notes: string | null
          sex: string | null
        }
        Insert: {
          birth_date?: string | null
          created_at?: string
          family_id: string
          id?: string
          name: string
          notes?: string | null
          sex?: string | null
        }
        Update: {
          birth_date?: string | null
          created_at?: string
          family_id?: string
          id?: string
          name?: string
          notes?: string | null
          sex?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "children_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          child_id: string
          created_at: string
          created_by: string | null
          id: string
          notes: string
          occurred_at: string
          payload: Json
          source_message_id: string | null
          type: string
        }
        Insert: {
          child_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes: string
          occurred_at?: string
          payload?: Json
          source_message_id?: string | null
          type: string
        }
        Update: {
          child_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string
          occurred_at?: string
          payload?: Json
          source_message_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      families: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
        }
        Relationships: []
      }
      knowledge_chunks: {
        Row: {
          age_max_months: number | null
          age_min_months: number | null
          category: string
          content: string
          created_at: string
          id: string
          search: unknown
          tags: string[] | null
          title: string
        }
        Insert: {
          age_max_months?: number | null
          age_min_months?: number | null
          category: string
          content: string
          created_at?: string
          id: string
          search?: unknown
          tags?: string[] | null
          title: string
        }
        Update: {
          age_max_months?: number | null
          age_min_months?: number | null
          category?: string
          content?: string
          created_at?: string
          id?: string
          search?: unknown
          tags?: string[] | null
          title?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          activity_id: string | null
          body: string | null
          caregiver_id: string | null
          created_at: string
          direction: string
          family_id: string | null
          feedback_notes: string | null
          feedback_recorded_at: string | null
          from_phone_number: string
          handled_at: string | null
          helpful: boolean | null
          id: string
          in_reply_to_message_id: string | null
          message_type: string
          raw_payload: Json
          wa_message_id: string
          wa_timestamp: string | null
        }
        Insert: {
          activity_id?: string | null
          body?: string | null
          caregiver_id?: string | null
          created_at?: string
          direction?: string
          family_id?: string | null
          feedback_notes?: string | null
          feedback_recorded_at?: string | null
          from_phone_number: string
          handled_at?: string | null
          helpful?: boolean | null
          id?: string
          in_reply_to_message_id?: string | null
          message_type: string
          raw_payload: Json
          wa_message_id: string
          wa_timestamp?: string | null
        }
        Update: {
          activity_id?: string | null
          body?: string | null
          caregiver_id?: string | null
          created_at?: string
          direction?: string
          family_id?: string | null
          feedback_notes?: string | null
          feedback_recorded_at?: string | null
          from_phone_number?: string
          handled_at?: string | null
          helpful?: boolean | null
          id?: string
          in_reply_to_message_id?: string | null
          message_type?: string
          raw_payload?: Json
          wa_message_id?: string
          wa_timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "knowledge_chunks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_caregiver_id_fkey"
            columns: ["caregiver_id"]
            isOneToOne: false
            referencedRelation: "caregivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_in_reply_to_message_id_fkey"
            columns: ["in_reply_to_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist_leads: {
        Row: {
          app_used: string | null
          app_which: string | null
          caregivers: string[] | null
          caregivers_other: string | null
          challenges: string[] | null
          challenges_other: string | null
          child_age: string[]
          child_count: string | null
          course_taken: string | null
          course_which: string | null
          created_at: string
          email: string
          expectation: string | null
          family_setup_interest: boolean
          how_found: string | null
          how_found_other: string | null
          id: string
          name: string
          professionals: string[] | null
          support_network: string[] | null
          support_network_other: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          whatsapp: string
        }
        Insert: {
          app_used?: string | null
          app_which?: string | null
          caregivers?: string[] | null
          caregivers_other?: string | null
          challenges?: string[] | null
          challenges_other?: string | null
          child_age?: string[]
          child_count?: string | null
          course_taken?: string | null
          course_which?: string | null
          created_at?: string
          email: string
          expectation?: string | null
          family_setup_interest?: boolean
          how_found?: string | null
          how_found_other?: string | null
          id?: string
          name: string
          professionals?: string[] | null
          support_network?: string[] | null
          support_network_other?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          whatsapp: string
        }
        Update: {
          app_used?: string | null
          app_which?: string | null
          caregivers?: string[] | null
          caregivers_other?: string | null
          challenges?: string[] | null
          challenges_other?: string | null
          child_age?: string[]
          child_count?: string | null
          course_taken?: string | null
          course_which?: string | null
          created_at?: string
          email?: string
          expectation?: string | null
          family_setup_interest?: boolean
          how_found?: string | null
          how_found_other?: string | null
          id?: string
          name?: string
          professionals?: string[] | null
          support_network?: string[] | null
          support_network_other?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          whatsapp?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      knowledge_chunks_tsvector: {
        Args: { content: string; tags: string[]; title: string }
        Returns: unknown
      }
      search_knowledge_chunks: {
        Args: { age_months?: number; message: string; result_limit?: number }
        Returns: {
          category: string
          content: string
          id: string
          title: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
