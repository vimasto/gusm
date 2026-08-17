export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4";
  };
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      app_user: {
        Row: {
          allowed_time_block_id: number | null;
          created_at: string;
          disabled_at: string | null;
          identity_hmac: string;
          role: Database["public"]["Enums"]["app_role"];
          updated_at: string;
          user_id: string;
          user_name: string;
        };
        Insert: {
          allowed_time_block_id?: number | null;
          created_at?: string;
          disabled_at?: string | null;
          identity_hmac: string;
          role?: Database["public"]["Enums"]["app_role"];
          updated_at?: string;
          user_id: string;
          user_name: string;
        };
        Update: {
          allowed_time_block_id?: number | null;
          created_at?: string;
          disabled_at?: string | null;
          identity_hmac?: string;
          role?: Database["public"]["Enums"]["app_role"];
          updated_at?: string;
          user_id?: string;
          user_name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "app_user_allowed_time_block_id_fkey";
            columns: ["allowed_time_block_id"];
            isOneToOne: false;
            referencedRelation: "time_block";
            referencedColumns: ["time_block_id"];
          },
        ];
      };
      booking: {
        Row: {
          absent_at: string | null;
          booked_at: string;
          booking_date: string;
          booking_id: string;
          cancelled_at: string | null;
          confirmed_at: string | null;
          created_at: string;
          is_overcapacity: boolean;
          present_at: string | null;
          qr_scanned_at: string | null;
          status: Database["public"]["Enums"]["booking_status"];
          time_block_id: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          absent_at?: string | null;
          booked_at?: string;
          booking_date: string;
          booking_id?: string;
          cancelled_at?: string | null;
          confirmed_at?: string | null;
          created_at?: string;
          is_overcapacity?: boolean;
          present_at?: string | null;
          qr_scanned_at?: string | null;
          status?: Database["public"]["Enums"]["booking_status"];
          time_block_id: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          absent_at?: string | null;
          booked_at?: string;
          booking_date?: string;
          booking_id?: string;
          cancelled_at?: string | null;
          confirmed_at?: string | null;
          created_at?: string;
          is_overcapacity?: boolean;
          present_at?: string | null;
          qr_scanned_at?: string | null;
          status?: Database["public"]["Enums"]["booking_status"];
          time_block_id?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "booking_time_block_id_fkey";
            columns: ["time_block_id"];
            isOneToOne: false;
            referencedRelation: "time_block";
            referencedColumns: ["time_block_id"];
          },
          {
            foreignKeyName: "booking_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "app_user";
            referencedColumns: ["user_id"];
          },
        ];
      };
      booking_event: {
        Row: {
          actor_user_id: string | null;
          booking_event_id: string;
          booking_id: string;
          event_type: Database["public"]["Enums"]["booking_event_type"];
          metadata: Json;
          occurred_at: string;
        };
        Insert: {
          actor_user_id?: string | null;
          booking_event_id?: string;
          booking_id: string;
          event_type: Database["public"]["Enums"]["booking_event_type"];
          metadata?: Json;
          occurred_at?: string;
        };
        Update: {
          actor_user_id?: string | null;
          booking_event_id?: string;
          booking_id?: string;
          event_type?: Database["public"]["Enums"]["booking_event_type"];
          metadata?: Json;
          occurred_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "booking_event_actor_user_id_fkey";
            columns: ["actor_user_id"];
            isOneToOne: false;
            referencedRelation: "app_user";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "booking_event_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "booking";
            referencedColumns: ["booking_id"];
          },
        ];
      };
      system_settings: {
        Row: {
          n_sessions_per_day: number;
          overcapacity_max_above: number;
          singleton: boolean;
          standard_capacity: number;
          updated_at: string;
          updated_by_user_id: string | null;
        };
        Insert: {
          n_sessions_per_day?: number;
          overcapacity_max_above: number;
          singleton?: boolean;
          standard_capacity: number;
          updated_at?: string;
          updated_by_user_id?: string | null;
        };
        Update: {
          n_sessions_per_day?: number;
          overcapacity_max_above?: number;
          singleton?: boolean;
          standard_capacity?: number;
          updated_at?: string;
          updated_by_user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "system_settings_updated_by_user_id_fkey";
            columns: ["updated_by_user_id"];
            isOneToOne: false;
            referencedRelation: "app_user";
            referencedColumns: ["user_id"];
          },
        ];
      };
      time_block: {
        Row: {
          display_order: number;
          time_block_id: number;
          time_block_t0: string;
          time_block_t1: string;
        };
        Insert: {
          display_order: number;
          time_block_id: number;
          time_block_t0: string;
          time_block_t1: string;
        };
        Update: {
          display_order?: number;
          time_block_id?: number;
          time_block_t0?: string;
          time_block_t1?: string;
        };
        Relationships: [];
      };
      time_block_closure: {
        Row: {
          closure_date: string;
          created_at: string;
          created_by_user_id: string;
          time_block_id: number;
        };
        Insert: {
          closure_date: string;
          created_at?: string;
          created_by_user_id: string;
          time_block_id: number;
        };
        Update: {
          closure_date?: string;
          created_at?: string;
          created_by_user_id?: string;
          time_block_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: "time_block_closure_created_by_user_id_fkey";
            columns: ["created_by_user_id"];
            isOneToOne: false;
            referencedRelation: "app_user";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "time_block_closure_time_block_id_fkey";
            columns: ["time_block_id"];
            isOneToOne: false;
            referencedRelation: "time_block";
            referencedColumns: ["time_block_id"];
          },
        ];
      };
      user_warning: {
        Row: {
          booking_id: string | null;
          created_at: string;
          created_by_user_id: string | null;
          user_id: string;
          user_warning_id: string;
          warning_type: Database["public"]["Enums"]["warning_type"];
        };
        Insert: {
          booking_id?: string | null;
          created_at?: string;
          created_by_user_id?: string | null;
          user_id: string;
          user_warning_id?: string;
          warning_type: Database["public"]["Enums"]["warning_type"];
        };
        Update: {
          booking_id?: string | null;
          created_at?: string;
          created_by_user_id?: string | null;
          user_id?: string;
          user_warning_id?: string;
          warning_type?: Database["public"]["Enums"]["warning_type"];
        };
        Relationships: [
          {
            foreignKeyName: "user_warning_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "booking";
            referencedColumns: ["booking_id"];
          },
          {
            foreignKeyName: "user_warning_created_by_user_id_fkey";
            columns: ["created_by_user_id"];
            isOneToOne: false;
            referencedRelation: "app_user";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "user_warning_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "app_user";
            referencedColumns: ["user_id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      cancel_booking: {
        Args: { p_booking_id: string };
        Returns: {
          absent_at: string | null;
          booked_at: string;
          booking_date: string;
          booking_id: string;
          cancelled_at: string | null;
          confirmed_at: string | null;
          created_at: string;
          is_overcapacity: boolean;
          present_at: string | null;
          qr_scanned_at: string | null;
          status: Database["public"]["Enums"]["booking_status"];
          time_block_id: number;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "booking";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      confirm_booking: {
        Args: { p_booking_id: string };
        Returns: {
          absent_at: string | null;
          booked_at: string;
          booking_date: string;
          booking_id: string;
          cancelled_at: string | null;
          confirmed_at: string | null;
          created_at: string;
          is_overcapacity: boolean;
          present_at: string | null;
          qr_scanned_at: string | null;
          status: Database["public"]["Enums"]["booking_status"];
          time_block_id: number;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "booking";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_booking: {
        Args: { p_booking_date: string; p_time_block_id: number };
        Returns: {
          absent_at: string | null;
          booked_at: string;
          booking_date: string;
          booking_id: string;
          cancelled_at: string | null;
          confirmed_at: string | null;
          created_at: string;
          is_overcapacity: boolean;
          present_at: string | null;
          qr_scanned_at: string | null;
          status: Database["public"]["Enums"]["booking_status"];
          time_block_id: number;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "booking";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_time_block_closure: {
        Args: { p_closure_date: string; p_time_block_id: number };
        Returns: {
          closure_date: string;
          created_at: string;
          created_by_user_id: string;
          time_block_id: number;
        };
        SetofOptions: {
          from: "*";
          to: "time_block_closure";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      expire_unconfirmed_bookings: { Args: never; Returns: number };
      finalize_due_attendance: { Args: never; Returns: number };
      remove_time_block_closure: {
        Args: { p_closure_date: string; p_time_block_id: number };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "student" | "u_staff" | "gym_staff" | "admin";
      booking_event_type:
        | "reserved"
        | "reactivated"
        | "cancelled"
        | "confirmed"
        | "expired_to_absent"
        | "qr_check_in"
        | "visual_check_in"
        | "visual_absence"
        | "authorization_consumed"
        | "attendance_finalized";
      booking_status: "reserved" | "confirmed" | "present" | "absent" | "cancelled";
      warning_type: "missed_confirmation" | "missed_qr" | "unbooked_attendance";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["student", "u_staff", "gym_staff", "admin"],
      booking_event_type: [
        "reserved",
        "reactivated",
        "cancelled",
        "confirmed",
        "expired_to_absent",
        "qr_check_in",
        "visual_check_in",
        "visual_absence",
        "authorization_consumed",
        "attendance_finalized",
      ],
      booking_status: ["reserved", "confirmed", "present", "absent", "cancelled"],
      warning_type: ["missed_confirmation", "missed_qr", "unbooked_attendance"],
    },
  },
} as const;
