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
      announcements: {
        Row: {
          active: boolean
          created_at: string
          id: string
          message: string
          variant: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          message: string
          variant?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          message?: string
          variant?: string
        }
        Relationships: []
      }
      app_config: {
        Row: {
          id: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          id: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          id?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      download_events: {
        Row: {
          created_at: string
          episode: number | null
          id: string
          media_type: string
          poster_path: string | null
          quality: string
          season: number | null
          status: string
          title: string
          tmdb_id: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          episode?: number | null
          id?: string
          media_type?: string
          poster_path?: string | null
          quality?: string
          season?: number | null
          status?: string
          title: string
          tmdb_id?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          episode?: number | null
          id?: string
          media_type?: string
          poster_path?: string | null
          quality?: string
          season?: number | null
          status?: string
          title?: string
          tmdb_id?: number | null
          user_id?: string
        }
        Relationships: []
      }
      download_purchases: {
        Row: {
          amount_kes: number
          created_at: string
          credits_granted: number
          expires_at: string | null
          id: string
          provider: string
          provider_ref: string | null
          status: string
          tier: string
          unlimited: boolean
          user_id: string
        }
        Insert: {
          amount_kes: number
          created_at?: string
          credits_granted?: number
          expires_at?: string | null
          id?: string
          provider?: string
          provider_ref?: string | null
          status?: string
          tier: string
          unlimited?: boolean
          user_id: string
        }
        Update: {
          amount_kes?: number
          created_at?: string
          credits_granted?: number
          expires_at?: string | null
          id?: string
          provider?: string
          provider_ref?: string | null
          status?: string
          tier?: string
          unlimited?: boolean
          user_id?: string
        }
        Relationships: []
      }
      error_logs: {
        Row: {
          created_at: string
          id: string
          message: string
          stack: string | null
          url: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          stack?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          stack?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      hero_overrides: {
        Row: {
          backdrop_path: string | null
          content_id: number
          content_type: string
          created_at: string
          id: string
          sort_order: number
          tagline: string | null
          title: string
        }
        Insert: {
          backdrop_path?: string | null
          content_id: number
          content_type: string
          created_at?: string
          id?: string
          sort_order?: number
          tagline?: string | null
          title: string
        }
        Update: {
          backdrop_path?: string | null
          content_id?: number
          content_type?: string
          created_at?: string
          id?: string
          sort_order?: number
          tagline?: string | null
          title?: string
        }
        Relationships: []
      }
      party_messages: {
        Row: {
          body: string
          created_at: string
          display_name: string
          id: string
          room_code: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          display_name: string
          id?: string
          room_code: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          display_name?: string
          id?: string
          room_code?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "party_messages_room_code_fkey"
            columns: ["room_code"]
            isOneToOne: false
            referencedRelation: "party_rooms"
            referencedColumns: ["code"]
          },
        ]
      }
      party_rooms: {
        Row: {
          code: string
          content_id: number
          content_type: string
          created_at: string
          episode_number: number | null
          host_id: string
          season_number: number | null
          server_id: string | null
          start_at: string | null
          sync_nonce: number
          title: string
          updated_at: string
        }
        Insert: {
          code: string
          content_id: number
          content_type: string
          created_at?: string
          episode_number?: number | null
          host_id: string
          season_number?: number | null
          server_id?: string | null
          start_at?: string | null
          sync_nonce?: number
          title: string
          updated_at?: string
        }
        Update: {
          code?: string
          content_id?: number
          content_type?: string
          created_at?: string
          episode_number?: number | null
          host_id?: string
          season_number?: number | null
          server_id?: string | null
          start_at?: string | null
          sync_nonce?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          preferences: Json
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          preferences?: Json
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          preferences?: Json
          updated_at?: string
        }
        Relationships: []
      }
      server_health: {
        Row: {
          category: string
          is_online: boolean
          last_checked: string
          latency_ms: number | null
          server_name: string
        }
        Insert: {
          category?: string
          is_online?: boolean
          last_checked?: string
          latency_ms?: number | null
          server_name: string
        }
        Update: {
          category?: string
          is_online?: boolean
          last_checked?: string
          latency_ms?: number | null
          server_name?: string
        }
        Relationships: []
      }
      user_progress: {
        Row: {
          backdrop_path: string | null
          duration_seconds: number
          episode: number | null
          episode_positions: Json
          fully_watched: boolean
          id: string
          media_type: string
          position_seconds: number
          poster_path: string | null
          progress_pct: number | null
          season: number | null
          title: string
          tmdb_id: number
          updated_at: string
          user_id: string
          watched_episodes: Json | null
        }
        Insert: {
          backdrop_path?: string | null
          duration_seconds?: number
          episode?: number | null
          episode_positions?: Json
          fully_watched?: boolean
          id?: string
          media_type: string
          position_seconds?: number
          poster_path?: string | null
          progress_pct?: number | null
          season?: number | null
          title: string
          tmdb_id: number
          updated_at?: string
          user_id: string
          watched_episodes?: Json | null
        }
        Update: {
          backdrop_path?: string | null
          duration_seconds?: number
          episode?: number | null
          episode_positions?: Json
          fully_watched?: boolean
          id?: string
          media_type?: string
          position_seconds?: number
          poster_path?: string | null
          progress_pct?: number | null
          season?: number | null
          title?: string
          tmdb_id?: number
          updated_at?: string
          user_id?: string
          watched_episodes?: Json | null
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
      user_watchlists: {
        Row: {
          created_at: string
          id: string
          media_type: string
          poster_path: string | null
          title: string
          tmdb_id: number
          user_id: string
          year: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          media_type: string
          poster_path?: string | null
          title: string
          tmdb_id: number
          user_id: string
          year?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          media_type?: string
          poster_path?: string | null
          title?: string
          tmdb_id?: number
          user_id?: string
          year?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_stats: { Args: never; Returns: Json }
      download_entitlement: { Args: never; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user" | "super_admin"
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
      app_role: ["admin", "user", "super_admin"],
    },
  },
} as const
