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
  private: {
    Tables: {
      check_in_qr_token: {
        Row: {
          booking_date: string
          expires_at: string
          issued_at: string
          qr_token_id: string
          revoked_at: string | null
          scan_result:
            | Database["private"]["Enums"]["check_in_qr_scan_result"]
            | null
          scanned_at: string | null
          scanned_by_user_id: string | null
          time_block_id: number
          token_hash: string
          user_id: string
        }
        Insert: {
          booking_date: string
          expires_at: string
          issued_at?: string
          qr_token_id?: string
          revoked_at?: string | null
          scan_result?:
            | Database["private"]["Enums"]["check_in_qr_scan_result"]
            | null
          scanned_at?: string | null
          scanned_by_user_id?: string | null
          time_block_id: number
          token_hash: string
          user_id: string
        }
        Update: {
          booking_date?: string
          expires_at?: string
          issued_at?: string
          qr_token_id?: string
          revoked_at?: string | null
          scan_result?:
            | Database["private"]["Enums"]["check_in_qr_scan_result"]
            | null
          scanned_at?: string | null
          scanned_by_user_id?: string | null
          time_block_id?: number
          token_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      staff_block_admission_request: {
        Row: {
          booking_date: string
          expires_at: string
          requested_at: string
          staff_block_admission_request_id: string
          time_block_id: number
          user_id: string
        }
        Insert: {
          booking_date: string
          expires_at: string
          requested_at?: string
          staff_block_admission_request_id?: string
          time_block_id: number
          user_id: string
        }
        Update: {
          booking_date?: string
          expires_at?: string
          requested_at?: string
          staff_block_admission_request_id?: string
          time_block_id?: number
          user_id?: string
        }
        Relationships: []
      }
      user_body_measurement: {
        Row: {
          height_cm: number | null
          measured_at: string
          recorded_by_user_id: string
          source: Database["private"]["Enums"]["profile_data_source"]
          user_body_measurement_id: string
          user_id: string
          weight_kg: number | null
        }
        Insert: {
          height_cm?: number | null
          measured_at?: string
          recorded_by_user_id: string
          source: Database["private"]["Enums"]["profile_data_source"]
          user_body_measurement_id?: string
          user_id: string
          weight_kg?: number | null
        }
        Update: {
          height_cm?: number | null
          measured_at?: string
          recorded_by_user_id?: string
          source?: Database["private"]["Enums"]["profile_data_source"]
          user_body_measurement_id?: string
          user_id?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
      user_institutional_identity: {
        Row: {
          created_at: string
          institutional_username: string
          last_verified_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          institutional_username: string
          last_verified_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          institutional_username?: string
          last_verified_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_personal_profile_revision: {
        Row: {
          date_of_birth: string
          recorded_at: string
          recorded_by_user_id: string
          reported_sex: Database["private"]["Enums"]["reported_sex"]
          source: Database["private"]["Enums"]["profile_data_source"]
          user_id: string
          user_personal_profile_revision_id: string
        }
        Insert: {
          date_of_birth: string
          recorded_at?: string
          recorded_by_user_id: string
          reported_sex: Database["private"]["Enums"]["reported_sex"]
          source: Database["private"]["Enums"]["profile_data_source"]
          user_id: string
          user_personal_profile_revision_id?: string
        }
        Update: {
          date_of_birth?: string
          recorded_at?: string
          recorded_by_user_id?: string
          reported_sex?: Database["private"]["Enums"]["reported_sex"]
          source?: Database["private"]["Enums"]["profile_data_source"]
          user_id?: string
          user_personal_profile_revision_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_discipline_rules: {
        Args: {
          p_occurred_at: string
          p_source_event_id: string
          p_user_id: string
          p_violation_type: Database["public"]["Enums"]["discipline_violation_type"]
        }
        Returns: undefined
      }
      block_ends_at: {
        Args: { p_block: number; p_date: string }
        Returns: string
      }
      block_starts_at: {
        Args: { p_block: number; p_date: string }
        Returns: string
      }
      current_access_state: { Args: never; Returns: string }
      current_active_time_block: {
        Args: never
        Returns: {
          booking_date: string
          time_block_id: number
        }[]
      }
      current_check_in_qr_window: {
        Args: never
        Returns: {
          booking_date: string
          time_block_id: number
        }[]
      }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_profile_recording_source: {
        Args: { p_actor_user_id: string; p_target_user_id: string }
        Returns: Database["private"]["Enums"]["profile_data_source"]
      }
      get_time_block_closure_reason: {
        Args: { p_closure_date: string; p_time_block_id: number }
        Returns: string
      }
      is_active_current_user: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      is_time_block_closed: {
        Args: { p_closure_date: string; p_time_block_id: number }
        Returns: boolean
      }
      require_current_admin: { Args: { p_user_id: string }; Returns: undefined }
      require_current_staff: { Args: { p_user_id: string }; Returns: undefined }
      require_current_terms_user: {
        Args: { p_user_id: string }
        Returns: Database["public"]["Tables"]["app_user"]["Row"]
        SetofOptions: {
          from: "*"
          to: "app_user"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      require_open_current_check_in_window: {
        Args: never
        Returns: {
          block_starts_at: string
          booking_date: string
          expires_at: string
          time_block_id: number
        }[]
      }
    }
    Enums: {
      check_in_qr_scan_result:
        | "checked_in"
        | "already_present"
        | "no_current_booking"
      profile_data_source: "self_reported" | "admin_recorded"
      reported_sex: "masculino" | "femenino" | "otro" | "prefiero_no_decir"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      app_user: {
        Row: {
          accepted_terms_version: number | null
          allowed_time_block_id: number | null
          created_at: string
          disabled_at: string | null
          disabled_by_user_id: string | null
          disabled_reason: string | null
          identity_hmac: string
          role: Database["public"]["Enums"]["app_role"]
          terms_accepted_at: string | null
          theme_preference: string
          updated_at: string
          user_id: string
          user_name: string
        }
        Insert: {
          accepted_terms_version?: number | null
          allowed_time_block_id?: number | null
          created_at?: string
          disabled_at?: string | null
          disabled_by_user_id?: string | null
          disabled_reason?: string | null
          identity_hmac: string
          role?: Database["public"]["Enums"]["app_role"]
          terms_accepted_at?: string | null
          theme_preference?: string
          updated_at?: string
          user_id: string
          user_name: string
        }
        Update: {
          accepted_terms_version?: number | null
          allowed_time_block_id?: number | null
          created_at?: string
          disabled_at?: string | null
          disabled_by_user_id?: string | null
          disabled_reason?: string | null
          identity_hmac?: string
          role?: Database["public"]["Enums"]["app_role"]
          terms_accepted_at?: string | null
          theme_preference?: string
          updated_at?: string
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_user_allowed_time_block_id_fkey"
            columns: ["allowed_time_block_id"]
            isOneToOne: false
            referencedRelation: "time_block"
            referencedColumns: ["time_block_id"]
          },
          {
            foreignKeyName: "app_user_disabled_by_user_id_fkey"
            columns: ["disabled_by_user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["user_id"]
          },
        ]
      }
      booking: {
        Row: {
          absent_at: string | null
          admission_source: Database["public"]["Enums"]["booking_admission_source"]
          booked_at: string
          booking_date: string
          booking_id: string
          cancelled_at: string | null
          confirmed_at: string | null
          created_at: string
          is_overcapacity: boolean
          late_qr_authorized_at: string | null
          present_at: string | null
          qr_scanned_at: string | null
          status: Database["public"]["Enums"]["booking_status"]
          time_block_id: number
          updated_at: string
          user_id: string
        }
        Insert: {
          absent_at?: string | null
          admission_source?: Database["public"]["Enums"]["booking_admission_source"]
          booked_at?: string
          booking_date: string
          booking_id?: string
          cancelled_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          is_overcapacity?: boolean
          late_qr_authorized_at?: string | null
          present_at?: string | null
          qr_scanned_at?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          time_block_id: number
          updated_at?: string
          user_id: string
        }
        Update: {
          absent_at?: string | null
          admission_source?: Database["public"]["Enums"]["booking_admission_source"]
          booked_at?: string
          booking_date?: string
          booking_id?: string
          cancelled_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          is_overcapacity?: boolean
          late_qr_authorized_at?: string | null
          present_at?: string | null
          qr_scanned_at?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          time_block_id?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_time_block_id_fkey"
            columns: ["time_block_id"]
            isOneToOne: false
            referencedRelation: "time_block"
            referencedColumns: ["time_block_id"]
          },
          {
            foreignKeyName: "booking_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["user_id"]
          },
        ]
      }
      booking_event: {
        Row: {
          actor_user_id: string | null
          booking_event_id: string
          booking_id: string
          event_type: Database["public"]["Enums"]["booking_event_type"]
          metadata: Json
          occurred_at: string
        }
        Insert: {
          actor_user_id?: string | null
          booking_event_id?: string
          booking_id: string
          event_type: Database["public"]["Enums"]["booking_event_type"]
          metadata?: Json
          occurred_at?: string
        }
        Update: {
          actor_user_id?: string | null
          booking_event_id?: string
          booking_id?: string
          event_type?: Database["public"]["Enums"]["booking_event_type"]
          metadata?: Json
          occurred_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_event_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "booking_event_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking"
            referencedColumns: ["booking_id"]
          },
        ]
      }
      disciplinary_action: {
        Row: {
          action_kind: Database["public"]["Enums"]["discipline_action_kind"]
          applied_at: string
          disciplinary_action_id: string
          discipline_rule_id: string
          occurrence_count: number
          source_event_id: string
          user_id: string
          violation_type: Database["public"]["Enums"]["discipline_violation_type"]
        }
        Insert: {
          action_kind: Database["public"]["Enums"]["discipline_action_kind"]
          applied_at?: string
          disciplinary_action_id?: string
          discipline_rule_id: string
          occurrence_count: number
          source_event_id: string
          user_id: string
          violation_type: Database["public"]["Enums"]["discipline_violation_type"]
        }
        Update: {
          action_kind?: Database["public"]["Enums"]["discipline_action_kind"]
          applied_at?: string
          disciplinary_action_id?: string
          discipline_rule_id?: string
          occurrence_count?: number
          source_event_id?: string
          user_id?: string
          violation_type?: Database["public"]["Enums"]["discipline_violation_type"]
        }
        Relationships: [
          {
            foreignKeyName: "disciplinary_action_discipline_rule_id_fkey"
            columns: ["discipline_rule_id"]
            isOneToOne: false
            referencedRelation: "discipline_rule"
            referencedColumns: ["discipline_rule_id"]
          },
          {
            foreignKeyName: "disciplinary_action_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["user_id"]
          },
        ]
      }
      discipline_rule: {
        Row: {
          action_kind: Database["public"]["Enums"]["discipline_action_kind"]
          created_at: string
          created_by_user_id: string
          discipline_rule_id: string
          enabled: boolean
          occurrence_threshold: number
          updated_at: string
          updated_by_user_id: string
          violation_type: Database["public"]["Enums"]["discipline_violation_type"]
          window_days: number
        }
        Insert: {
          action_kind: Database["public"]["Enums"]["discipline_action_kind"]
          created_at?: string
          created_by_user_id: string
          discipline_rule_id?: string
          enabled?: boolean
          occurrence_threshold: number
          updated_at?: string
          updated_by_user_id: string
          violation_type: Database["public"]["Enums"]["discipline_violation_type"]
          window_days?: number
        }
        Update: {
          action_kind?: Database["public"]["Enums"]["discipline_action_kind"]
          created_at?: string
          created_by_user_id?: string
          discipline_rule_id?: string
          enabled?: boolean
          occurrence_threshold?: number
          updated_at?: string
          updated_by_user_id?: string
          violation_type?: Database["public"]["Enums"]["discipline_violation_type"]
          window_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "discipline_rule_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "discipline_rule_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["user_id"]
          },
        ]
      }
      full_day_closure_period: {
        Row: {
          closure_end_date: string
          closure_start_date: string
          created_at: string
          created_by_user_id: string
          full_day_closure_period_id: string
          reason: string
        }
        Insert: {
          closure_end_date: string
          closure_start_date: string
          created_at?: string
          created_by_user_id: string
          full_day_closure_period_id?: string
          reason: string
        }
        Update: {
          closure_end_date?: string
          closure_start_date?: string
          created_at?: string
          created_by_user_id?: string
          full_day_closure_period_id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "full_day_closure_period_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["user_id"]
          },
        ]
      }
      system_settings: {
        Row: {
          current_terms_version: number
          n_sessions_per_day: number
          overcapacity_max_above: number
          singleton: boolean
          standard_capacity: number
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          current_terms_version?: number
          n_sessions_per_day?: number
          overcapacity_max_above: number
          singleton?: boolean
          standard_capacity: number
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          current_terms_version?: number
          n_sessions_per_day?: number
          overcapacity_max_above?: number
          singleton?: boolean
          standard_capacity?: number
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_settings_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["user_id"]
          },
        ]
      }
      time_block: {
        Row: {
          display_order: number
          time_block_id: number
          time_block_t0: string
          time_block_t1: string
        }
        Insert: {
          display_order: number
          time_block_id: number
          time_block_t0: string
          time_block_t1: string
        }
        Update: {
          display_order?: number
          time_block_id?: number
          time_block_t0?: string
          time_block_t1?: string
        }
        Relationships: []
      }
      time_block_closure: {
        Row: {
          closure_date: string
          created_at: string
          created_by_user_id: string
          reason: string
          time_block_id: number
        }
        Insert: {
          closure_date: string
          created_at?: string
          created_by_user_id: string
          reason?: string
          time_block_id: number
        }
        Update: {
          closure_date?: string
          created_at?: string
          created_by_user_id?: string
          reason?: string
          time_block_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "time_block_closure_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "time_block_closure_time_block_id_fkey"
            columns: ["time_block_id"]
            isOneToOne: false
            referencedRelation: "time_block"
            referencedColumns: ["time_block_id"]
          },
        ]
      }
      user_warning: {
        Row: {
          booking_id: string | null
          created_at: string
          created_by_user_id: string | null
          user_id: string
          user_warning_id: string
          warning_type: Database["public"]["Enums"]["warning_type"]
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          user_id: string
          user_warning_id?: string
          warning_type: Database["public"]["Enums"]["warning_type"]
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          user_id?: string
          user_warning_id?: string
          warning_type?: Database["public"]["Enums"]["warning_type"]
        }
        Relationships: [
          {
            foreignKeyName: "user_warning_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "user_warning_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_warning_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["user_id"]
          },
        ]
      }
      weekly_time_block_closure: {
        Row: {
          created_at: string
          created_by_user_id: string
          iso_weekday: number
          reason: string
          time_block_id: number
        }
        Insert: {
          created_at?: string
          created_by_user_id: string
          iso_weekday: number
          reason?: string
          time_block_id: number
        }
        Update: {
          created_at?: string
          created_by_user_id?: string
          iso_weekday?: number
          reason?: string
          time_block_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "weekly_time_block_closure_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "weekly_time_block_closure_time_block_id_fkey"
            columns: ["time_block_id"]
            isOneToOne: false
            referencedRelation: "time_block"
            referencedColumns: ["time_block_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admit_current_staff_block_user: {
        Args: {
          p_actor_user_id: string
          p_admission_source: Database["public"]["Enums"]["booking_admission_source"]
          p_target_user_id: string
        }
        Returns: {
          absent_at: string | null
          admission_source: Database["public"]["Enums"]["booking_admission_source"]
          booked_at: string
          booking_date: string
          booking_id: string
          cancelled_at: string | null
          confirmed_at: string | null
          created_at: string
          is_overcapacity: boolean
          late_qr_authorized_at: string | null
          present_at: string | null
          qr_scanned_at: string | null
          status: Database["public"]["Enums"]["booking_status"]
          time_block_id: number
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "booking"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_booking: {
        Args: { p_booking_id: string }
        Returns: {
          absent_at: string | null
          admission_source: Database["public"]["Enums"]["booking_admission_source"]
          booked_at: string
          booking_date: string
          booking_id: string
          cancelled_at: string | null
          confirmed_at: string | null
          created_at: string
          is_overcapacity: boolean
          late_qr_authorized_at: string | null
          present_at: string | null
          qr_scanned_at: string | null
          status: Database["public"]["Enums"]["booking_status"]
          time_block_id: number
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "booking"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      confirm_booking: {
        Args: { p_booking_id: string }
        Returns: {
          absent_at: string | null
          admission_source: Database["public"]["Enums"]["booking_admission_source"]
          booked_at: string
          booking_date: string
          booking_id: string
          cancelled_at: string | null
          confirmed_at: string | null
          created_at: string
          is_overcapacity: boolean
          late_qr_authorized_at: string | null
          present_at: string | null
          qr_scanned_at: string | null
          status: Database["public"]["Enums"]["booking_status"]
          time_block_id: number
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "booking"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      consume_check_in_qr: {
        Args: { p_scanner_user_id: string; p_token_hash: string }
        Returns: {
          scanned_at: string
          state: string
        }[]
      }
      create_booking: {
        Args: { p_booking_date: string; p_time_block_id: number }
        Returns: {
          absent_at: string | null
          admission_source: Database["public"]["Enums"]["booking_admission_source"]
          booked_at: string
          booking_date: string
          booking_id: string
          cancelled_at: string | null
          confirmed_at: string | null
          created_at: string
          is_overcapacity: boolean
          late_qr_authorized_at: string | null
          present_at: string | null
          qr_scanned_at: string | null
          status: Database["public"]["Enums"]["booking_status"]
          time_block_id: number
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "booking"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_time_block_closure: {
        Args: { p_closure_date: string; p_time_block_id: number }
        Returns: {
          closure_date: string
          created_at: string
          created_by_user_id: string
          reason: string
          time_block_id: number
        }
        SetofOptions: {
          from: "*"
          to: "time_block_closure"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_weekly_time_block_closure: {
        Args: { p_iso_weekday: number; p_time_block_id: number }
        Returns: {
          created_at: string
          created_by_user_id: string
          iso_weekday: number
          reason: string
          time_block_id: number
        }
        SetofOptions: {
          from: "*"
          to: "weekly_time_block_closure"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      disable_admin_user: {
        Args: {
          p_actor_user_id: string
          p_reason: string
          p_target_user_id: string
        }
        Returns: {
          accepted_terms_version: number | null
          allowed_time_block_id: number | null
          created_at: string
          disabled_at: string | null
          disabled_by_user_id: string | null
          disabled_reason: string | null
          identity_hmac: string
          role: Database["public"]["Enums"]["app_role"]
          terms_accepted_at: string | null
          theme_preference: string
          updated_at: string
          user_id: string
          user_name: string
        }
        SetofOptions: {
          from: "*"
          to: "app_user"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      expire_staff_block_admission_requests: { Args: never; Returns: number }
      expire_unconfirmed_bookings: { Args: never; Returns: number }
      finalize_due_attendance: { Args: never; Returns: number }
      get_admin_booking_export: {
        Args: {
          p_actor_user_id: string
          p_end_date: string
          p_start_date: string
        }
        Returns: {
          absent_at: string
          admission_source: Database["public"]["Enums"]["booking_admission_source"]
          block_ends_at: string
          block_starts_at: string
          booked_at: string
          booking_date: string
          booking_status: Database["public"]["Enums"]["booking_status"]
          cancelled_at: string
          confirmed_at: string
          date_of_birth: string
          height_cm: number
          institutional_username: string
          is_overcapacity: boolean
          late_qr_authorized_at: string
          present_at: string
          qr_scanned_at: string
          reported_sex: string
          time_block_id: number
          user_name: string
          user_role: Database["public"]["Enums"]["app_role"]
          warning_types: string
          weight_kg: number
        }[]
      }
      get_admin_configuration: {
        Args: { p_actor_user_id: string }
        Returns: Json
      }
      get_admin_disciplinary_action_export: {
        Args: {
          p_actor_user_id: string
          p_end_date: string
          p_start_date: string
        }
        Returns: {
          action_kind: Database["public"]["Enums"]["discipline_action_kind"]
          applied_at: string
          date_of_birth: string
          height_cm: number
          institutional_username: string
          occurrence_count: number
          reported_sex: string
          user_name: string
          user_role: Database["public"]["Enums"]["app_role"]
          violation_type: Database["public"]["Enums"]["discipline_violation_type"]
          weight_kg: number
        }[]
      }
      get_admin_discipline_rules: {
        Args: { p_actor_user_id: string }
        Returns: {
          action_kind: Database["public"]["Enums"]["discipline_action_kind"]
          discipline_rule_id: string
          enabled: boolean
          occurrence_threshold: number
          violation_type: Database["public"]["Enums"]["discipline_violation_type"]
          window_days: number
        }[]
      }
      get_admin_standalone_warning_export: {
        Args: {
          p_actor_user_id: string
          p_end_date: string
          p_start_date: string
        }
        Returns: {
          date_of_birth: string
          height_cm: number
          institutional_username: string
          reported_sex: string
          user_name: string
          user_role: Database["public"]["Enums"]["app_role"]
          warning_created_at: string
          warning_type: Database["public"]["Enums"]["warning_type"]
          weight_kg: number
        }[]
      }
      get_booking_closure_reasons: {
        Args: {
          p_actor_user_id: string
          p_end_date: string
          p_start_date: string
        }
        Returns: {
          closure_date: string
          reason: string
          time_block_id: number
        }[]
      }
      get_booking_week_availability: {
        Args: { p_week_start: string }
        Returns: {
          booking_date: string
          current_booking_id: string
          current_booking_is_overcapacity: boolean
          current_booking_status: Database["public"]["Enums"]["booking_status"]
          standard_capacity: number
          standard_count: number
          time_block_id: number
          time_block_t0: string
          time_block_t1: string
        }[]
      }
      get_check_in_qr_status: {
        Args: { p_qr_token_id: string; p_user_id: string }
        Returns: {
          scanned_at: string
          state: string
        }[]
      }
      get_current_access_state: { Args: never; Returns: string }
      get_current_staff_block_candidates: {
        Args: { p_actor_user_id: string }
        Returns: {
          admission_source: Database["public"]["Enums"]["booking_admission_source"]
          booking_status: Database["public"]["Enums"]["booking_status"]
          is_overcapacity: boolean
          requested_at: string
          staff_block_admission_request_id: string
          user_id: string
          user_name: string
        }[]
      }
      get_current_staff_block_context: {
        Args: { p_actor_user_id: string }
        Returns: {
          block_starts_at: string
          booking_date: string
          expires_at: string
          overcapacity_count: number
          overcapacity_max_above: number
          standard_capacity: number
          standard_count: number
          time_block_id: number
        }[]
      }
      get_profile_monthly_attendance: {
        Args: {
          p_actor_user_id: string
          p_month_start: string
          p_target_user_id: string
        }
        Returns: {
          attendance_status: Database["public"]["Enums"]["booking_status"]
          booking_date: string
        }[]
      }
      get_profile_overview: {
        Args: { p_actor_user_id: string; p_target_user_id: string }
        Returns: {
          date_of_birth: string
          height_cm: number
          institutional_username: string
          reported_sex: string
          role: Database["public"]["Enums"]["app_role"]
          streak_weeks: number
          theme_preference: string
          user_name: string
          weight_kg: number
        }[]
      }
      has_accepted_current_terms: { Args: never; Returns: boolean }
      issue_check_in_qr: {
        Args: { p_token_hash: string; p_user_id: string }
        Returns: {
          booking_date: string
          expires_at: string
          qr_token_id: string
          state: string
          time_block_id: number
        }[]
      }
      reauthorize_current_staff_block_qr: {
        Args: { p_actor_user_id: string; p_target_user_id: string }
        Returns: {
          absent_at: string | null
          admission_source: Database["public"]["Enums"]["booking_admission_source"]
          booked_at: string
          booking_date: string
          booking_id: string
          cancelled_at: string | null
          confirmed_at: string | null
          created_at: string
          is_overcapacity: boolean
          late_qr_authorized_at: string | null
          present_at: string | null
          qr_scanned_at: string | null
          status: Database["public"]["Enums"]["booking_status"]
          time_block_id: number
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "booking"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_profile_data: {
        Args: {
          p_actor_user_id: string
          p_date_of_birth: string
          p_height_cm: number
          p_reported_sex: string
          p_target_user_id: string
          p_weight_kg: number
        }
        Returns: undefined
      }
      record_profile_data_from_payload: {
        Args: {
          p_actor_user_id: string
          p_profile_data: Json
          p_target_user_id: string
        }
        Returns: undefined
      }
      remove_admin_date_time_block_closure: {
        Args: {
          p_actor_user_id: string
          p_closure_date: string
          p_time_block_id: number
        }
        Returns: boolean
      }
      remove_admin_discipline_rule: {
        Args: { p_actor_user_id: string; p_discipline_rule_id: string }
        Returns: boolean
      }
      remove_admin_full_day_closure_period: {
        Args: { p_actor_user_id: string; p_full_day_closure_period_id: string }
        Returns: boolean
      }
      remove_admin_weekly_time_block_closure: {
        Args: {
          p_actor_user_id: string
          p_iso_weekday: number
          p_time_block_id: number
        }
        Returns: boolean
      }
      remove_time_block_closure: {
        Args: { p_closure_date: string; p_time_block_id: number }
        Returns: boolean
      }
      remove_weekly_time_block_closure: {
        Args: { p_iso_weekday: number; p_time_block_id: number }
        Returns: boolean
      }
      request_current_block_admission: {
        Args: { p_user_id: string }
        Returns: {
          booking_date: string
          expires_at: string
          time_block_id: number
        }[]
      }
      restore_admin_user: {
        Args: { p_actor_user_id: string; p_target_user_id: string }
        Returns: {
          accepted_terms_version: number | null
          allowed_time_block_id: number | null
          created_at: string
          disabled_at: string | null
          disabled_by_user_id: string | null
          disabled_reason: string | null
          identity_hmac: string
          role: Database["public"]["Enums"]["app_role"]
          terms_accepted_at: string | null
          theme_preference: string
          updated_at: string
          user_id: string
          user_name: string
        }
        SetofOptions: {
          from: "*"
          to: "app_user"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      search_admin_users: {
        Args: { p_actor_user_id: string; p_query: string }
        Returns: {
          disabled_at: string
          disabled_reason: string
          institutional_username: string
          user_id: string
          user_name: string
          user_role: Database["public"]["Enums"]["app_role"]
        }[]
      }
      search_current_staff_block_users: {
        Args: {
          p_actor_user_id: string
          p_institutional_username_prefix: string
        }
        Returns: {
          booking_status: Database["public"]["Enums"]["booking_status"]
          institutional_username: string
          user_id: string
          user_name: string
        }[]
      }
      update_admin_operational_settings: {
        Args: {
          p_actor_user_id: string
          p_n_sessions_per_day: number
          p_overcapacity_max_above: number
        }
        Returns: {
          current_terms_version: number
          n_sessions_per_day: number
          overcapacity_max_above: number
          singleton: boolean
          standard_capacity: number
          updated_at: string
          updated_by_user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "system_settings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_current_user_theme_preference: {
        Args: { p_actor_user_id: string; p_theme_preference: string }
        Returns: string
      }
      upsert_admin_date_time_block_closure: {
        Args: {
          p_actor_user_id: string
          p_closure_date: string
          p_reason: string
          p_time_block_id: number
        }
        Returns: {
          closure_date: string
          created_at: string
          created_by_user_id: string
          reason: string
          time_block_id: number
        }
        SetofOptions: {
          from: "*"
          to: "time_block_closure"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_admin_discipline_rule: {
        Args: {
          p_action_kind: Database["public"]["Enums"]["discipline_action_kind"]
          p_actor_user_id: string
          p_occurrence_threshold: number
          p_violation_type: Database["public"]["Enums"]["discipline_violation_type"]
          p_window_days: number
        }
        Returns: {
          action_kind: Database["public"]["Enums"]["discipline_action_kind"]
          created_at: string
          created_by_user_id: string
          discipline_rule_id: string
          enabled: boolean
          occurrence_threshold: number
          updated_at: string
          updated_by_user_id: string
          violation_type: Database["public"]["Enums"]["discipline_violation_type"]
          window_days: number
        }
        SetofOptions: {
          from: "*"
          to: "discipline_rule"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_admin_full_day_closure_period: {
        Args: {
          p_actor_user_id: string
          p_closure_end_date: string
          p_closure_start_date: string
          p_reason: string
        }
        Returns: {
          closure_end_date: string
          closure_start_date: string
          created_at: string
          created_by_user_id: string
          full_day_closure_period_id: string
          reason: string
        }
        SetofOptions: {
          from: "*"
          to: "full_day_closure_period"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_admin_weekly_time_block_closure: {
        Args: {
          p_actor_user_id: string
          p_iso_weekday: number
          p_reason: string
          p_time_block_id: number
        }
        Returns: {
          created_at: string
          created_by_user_id: string
          iso_weekday: number
          reason: string
          time_block_id: number
        }
        SetofOptions: {
          from: "*"
          to: "weekly_time_block_closure"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_institutional_identity: {
        Args: { p_institutional_username: string; p_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "student" | "u_staff" | "gym_staff" | "admin"
      booking_admission_source:
        | "self_service"
        | "staff_exception"
        | "staff_overcapacity"
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
        | "attendance_finalized"
      booking_status:
        | "reserved"
        | "confirmed"
        | "present"
        | "absent"
        | "cancelled"
      discipline_action_kind: "notice" | "disable"
      discipline_violation_type:
        | "absent"
        | "missed_confirmation"
        | "missed_qr"
        | "unbooked_attendance"
      warning_type: "missed_confirmation" | "missed_qr" | "unbooked_attendance"
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
  private: {
    Enums: {
      check_in_qr_scan_result: [
        "checked_in",
        "already_present",
        "no_current_booking",
      ],
      profile_data_source: ["self_reported", "admin_recorded"],
      reported_sex: ["masculino", "femenino", "otro", "prefiero_no_decir"],
    },
  },
  public: {
    Enums: {
      app_role: ["student", "u_staff", "gym_staff", "admin"],
      booking_admission_source: [
        "self_service",
        "staff_exception",
        "staff_overcapacity",
      ],
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
      booking_status: [
        "reserved",
        "confirmed",
        "present",
        "absent",
        "cancelled",
      ],
      discipline_action_kind: ["notice", "disable"],
      discipline_violation_type: [
        "absent",
        "missed_confirmation",
        "missed_qr",
        "unbooked_attendance",
      ],
      warning_type: ["missed_confirmation", "missed_qr", "unbooked_attendance"],
    },
  },
} as const
