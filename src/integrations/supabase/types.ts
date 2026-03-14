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
      algo_strategies: {
        Row: {
          backtest_result: Json | null
          created_at: string
          entry_conditions: Json
          exit_conditions: Json
          id: string
          instrument: string
          legs: Json
          name: string
          recurrence: string
          status: string
          telegram_alert: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          backtest_result?: Json | null
          created_at?: string
          entry_conditions?: Json
          exit_conditions?: Json
          id?: string
          instrument?: string
          legs?: Json
          name?: string
          recurrence?: string
          status?: string
          telegram_alert?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          backtest_result?: Json | null
          created_at?: string
          entry_conditions?: Json
          exit_conditions?: Json
          id?: string
          instrument?: string
          legs?: Json
          name?: string
          recurrence?: string
          status?: string
          telegram_alert?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      broker_credentials: {
        Row: {
          api_key: string
          broker: string
          created_at: string
          id: string
          imei: string
          is_connected: boolean
          last_connected_at: string | null
          password: string
          session_token: string | null
          totp_key: string
          updated_at: string
          user_code: string
          user_id: string
          vendor_code: string
        }
        Insert: {
          api_key: string
          broker?: string
          created_at?: string
          id?: string
          imei?: string
          is_connected?: boolean
          last_connected_at?: string | null
          password: string
          session_token?: string | null
          totp_key: string
          updated_at?: string
          user_code: string
          user_id: string
          vendor_code?: string
        }
        Update: {
          api_key?: string
          broker?: string
          created_at?: string
          id?: string
          imei?: string
          is_connected?: boolean
          last_connected_at?: string | null
          password?: string
          session_token?: string | null
          totp_key?: string
          updated_at?: string
          user_code?: string
          user_id?: string
          vendor_code?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      risk_settings: {
        Row: {
          created_at: string
          daily_loss_auto_shutdown: boolean
          daily_loss_limit: number
          futures_sl_pct: number
          id: string
          index_sl_pct: number
          kill_switch_activated_at: string | null
          kill_switch_active: boolean
          margin_alert_threshold_pct: number
          max_delta: number
          max_gamma: number
          max_index_exposure: number
          max_margin_utilization_pct: number
          max_positions_per_asset: number
          max_sector_concentration_pct: number
          max_stock_exposure: number
          max_theta: number
          max_vega: number
          stock_sl_pct: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_loss_auto_shutdown?: boolean
          daily_loss_limit?: number
          futures_sl_pct?: number
          id?: string
          index_sl_pct?: number
          kill_switch_activated_at?: string | null
          kill_switch_active?: boolean
          margin_alert_threshold_pct?: number
          max_delta?: number
          max_gamma?: number
          max_index_exposure?: number
          max_margin_utilization_pct?: number
          max_positions_per_asset?: number
          max_sector_concentration_pct?: number
          max_stock_exposure?: number
          max_theta?: number
          max_vega?: number
          stock_sl_pct?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          daily_loss_auto_shutdown?: boolean
          daily_loss_limit?: number
          futures_sl_pct?: number
          id?: string
          index_sl_pct?: number
          kill_switch_activated_at?: string | null
          kill_switch_active?: boolean
          margin_alert_threshold_pct?: number
          max_delta?: number
          max_gamma?: number
          max_index_exposure?: number
          max_margin_utilization_pct?: number
          max_positions_per_asset?: number
          max_sector_concentration_pct?: number
          max_stock_exposure?: number
          max_theta?: number
          max_vega?: number
          stock_sl_pct?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      scheduled_trades: {
        Row: {
          created_at: string
          id: string
          instrument: string
          is_active: boolean
          last_executed_at: string | null
          otm_percent: number | null
          premium_target: number | null
          quantity: number
          schedule_time: string
          selection_mode: string
          stop_loss_percent: number
          strategy_type: string
          telegram_alert: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          instrument?: string
          is_active?: boolean
          last_executed_at?: string | null
          otm_percent?: number | null
          premium_target?: number | null
          quantity?: number
          schedule_time?: string
          selection_mode?: string
          stop_loss_percent?: number
          strategy_type?: string
          telegram_alert?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          instrument?: string
          is_active?: boolean
          last_executed_at?: string | null
          otm_percent?: number | null
          premium_target?: number | null
          quantity?: number
          schedule_time?: string
          selection_mode?: string
          stop_loss_percent?: number
          strategy_type?: string
          telegram_alert?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trade_executions: {
        Row: {
          error_message: string | null
          executed_at: string
          id: string
          instrument: string
          legs: Json
          schedule_id: string | null
          status: string
          stop_loss_price: number | null
          strategy_type: string
          total_premium: number | null
          user_id: string
        }
        Insert: {
          error_message?: string | null
          executed_at?: string
          id?: string
          instrument: string
          legs?: Json
          schedule_id?: string | null
          status?: string
          stop_loss_price?: number | null
          strategy_type: string
          total_premium?: number | null
          user_id: string
        }
        Update: {
          error_message?: string | null
          executed_at?: string
          id?: string
          instrument?: string
          legs?: Json
          schedule_id?: string | null
          status?: string
          stop_loss_price?: number | null
          strategy_type?: string
          total_premium?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_executions_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "scheduled_trades"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
