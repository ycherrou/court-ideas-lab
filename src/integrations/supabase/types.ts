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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action_type: string
          description: string | null
          entity_id: string | null
          entity_type: string
          id: string
          new_values: Json | null
          old_values: Json | null
          performed_at: string
          performed_by: string | null
          performer_name: string
        }
        Insert: {
          action_type: string
          description?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          performed_at?: string
          performed_by?: string | null
          performer_name: string
        }
        Update: {
          action_type?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          performed_at?: string
          performed_by?: string | null
          performer_name?: string
        }
        Relationships: []
      }
      blocked_slots: {
        Row: {
          court_id: string | null
          created_at: string
          created_by: string | null
          date: string
          end_time: string
          id: string
          reason: string
          start_time: string
        }
        Insert: {
          court_id?: string | null
          created_at?: string
          created_by?: string | null
          date: string
          end_time: string
          id?: string
          reason: string
          start_time: string
        }
        Update: {
          court_id?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          end_time?: string
          id?: string
          reason?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocked_slots_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
        ]
      }
      courts: {
        Row: {
          court_number: number
          created_at: string
          id: string
          is_central: boolean
          name: string
        }
        Insert: {
          court_number: number
          created_at?: string
          id?: string
          is_central?: boolean
          name: string
        }
        Update: {
          court_number?: number
          created_at?: string
          id?: string
          is_central?: boolean
          name?: string
        }
        Relationships: []
      }
      favorite_partners: {
        Row: {
          created_at: string
          favorite_user_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          favorite_user_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          favorite_user_id?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          must_change_password: boolean | null
          temporary_pin: string | null
          username: string | null
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id: string
          must_change_password?: boolean | null
          temporary_pin?: string | null
          username?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          must_change_password?: boolean | null
          temporary_pin?: string | null
          username?: string | null
        }
        Relationships: []
      }
      reservations: {
        Row: {
          court_id: string
          created_at: string
          created_by: string | null
          date: string
          end_time: string
          id: string
          player1_id: string
          player2_id: string
          start_time: string
        }
        Insert: {
          court_id: string
          created_at?: string
          created_by?: string | null
          date: string
          end_time: string
          id?: string
          player1_id: string
          player2_id: string
          start_time: string
        }
        Update: {
          court_id?: string
          created_at?: string
          created_by?: string | null
          date?: string
          end_time?: string
          id?: string
          player1_id?: string
          player2_id?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_player1_id_fkey"
            columns: ["player1_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_player2_id_fkey"
            columns: ["player2_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_court_allowed_for_user: {
        Args: { _court_id: string; _user_id: string }
        Returns: boolean
      }
      log_action: {
        Args: {
          _action_type: string
          _description?: string
          _entity_id?: string
          _entity_type: string
          _new_values?: Json
          _old_values?: Json
          _performed_by: string
          _performer_name: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "player" | "coach" | "super_coach"
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
      app_role: ["admin", "player", "coach", "super_coach"],
    },
  },
} as const
