// src/lib/v2/database.types.ts
// Supabase database type definitions for v2 tables.
// These types are used by the Supabase client to properly type query results.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      app_config: {
        Row: {
          id: number;
          last_cron_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: number;
          last_cron_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: number;
          last_cron_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      ats_companies: {
        Row: {
          id: string;
          name: string;
          ats: string;
          slug: string;
          country: string;
          country_flag: string;
          city: string | null;
          pipeline_visa: boolean;
          pipeline_local: boolean;
          pipeline_global: boolean;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          ats: string;
          slug: string;
          country: string;
          country_flag: string;
          city?: string | null;
          pipeline_visa?: boolean;
          pipeline_local?: boolean;
          pipeline_global?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          ats?: string;
          slug?: string;
          country?: string;
          country_flag?: string;
          city?: string | null;
          pipeline_visa?: boolean;
          pipeline_local?: boolean;
          pipeline_global?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      ats_submissions: {
        Row: {
          id: string;
          company_name: string;
          ats_type: string;
          slug: string;
          country: string;
          country_flag: string;
          city: string | null;
          pipeline_visa: boolean;
          pipeline_local: boolean;
          pipeline_global: boolean;
          submitter_email: string | null;
          status: string;
          test_result: Json | null;
          submitted_at: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
        };
        Insert: {
          id?: string;
          company_name: string;
          ats_type: string;
          slug: string;
          country: string;
          country_flag: string;
          city?: string | null;
          pipeline_visa?: boolean;
          pipeline_local?: boolean;
          pipeline_global?: boolean;
          submitter_email?: string | null;
          status?: string;
          test_result?: Json | null;
          submitted_at?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
        };
        Update: {
          id?: string;
          company_name?: string;
          ats_type?: string;
          slug?: string;
          country?: string;
          country_flag?: string;
          city?: string | null;
          pipeline_visa?: boolean;
          pipeline_local?: boolean;
          pipeline_global?: boolean;
          submitter_email?: string | null;
          status?: string;
          test_result?: Json | null;
          submitted_at?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
        };
        Relationships: [];
      };
      cron_logs_v2: {
        Row: {
          id: string;
          run_at: string;
          total_fetched: number | null;
          duration_ms: number | null;
          errors: string[] | null;
          source_health: Json | null;
          trigger: string | null;
        };
        Insert: {
          id?: string;
          run_at?: string;
          total_fetched?: number | null;
          duration_ms?: number | null;
          errors?: string[] | null;
          source_health?: Json | null;
          trigger?: string | null;
        };
        Update: {
          id?: string;
          run_at?: string;
          total_fetched?: number | null;
          duration_ms?: number | null;
          errors?: string[] | null;
          source_health?: Json | null;
          trigger?: string | null;
        };
        Relationships: [];
      };
      default_settings: {
        Row: {
          id: number;
          expert_skills: string[];
          secondary_skills: string[];
          bonus_skills: string[];
          job_age_days: number;
          pipeline_visa: boolean;
          pipeline_local: boolean;
          pipeline_global: boolean;
          seniority_allow_mid: boolean;
          gemini_filter_prompt: string | null;
          scoring_weights: Json;
          score_denominator: number;
          excluded_keywords: string[];
          blacklisted_locations: string[];
          required_keywords: string[];
          updated_at: string;
        };
        Insert: {
          id?: number;
          expert_skills?: string[];
          secondary_skills?: string[];
          bonus_skills?: string[];
          job_age_days?: number;
          pipeline_visa?: boolean;
          pipeline_local?: boolean;
          pipeline_global?: boolean;
          seniority_allow_mid?: boolean;
          gemini_filter_prompt?: string | null;
          scoring_weights?: Json;
          score_denominator?: number;
          excluded_keywords?: string[];
          blacklisted_locations?: string[];
          required_keywords?: string[];
          updated_at?: string;
        };
        Update: {
          id?: number;
          expert_skills?: string[];
          secondary_skills?: string[];
          bonus_skills?: string[];
          job_age_days?: number;
          pipeline_visa?: boolean;
          pipeline_local?: boolean;
          pipeline_global?: boolean;
          seniority_allow_mid?: boolean;
          gemini_filter_prompt?: string | null;
          scoring_weights?: Json;
          score_denominator?: number;
          excluded_keywords?: string[];
          blacklisted_locations?: string[];
          required_keywords?: string[];
          updated_at?: string;
        };
        Relationships: [];
      };
      raw_jobs: {
        Row: {
          id: string;
          title: string;
          company: string;
          location: string;
          country: string;
          country_flag: string;
          url: string;
          description: string;
          posted_at: string | null;
          fetched_at: string;
          date_unknown: boolean;
          is_remote: boolean;
          salary: string | null;
          mode: string;
          visa_sponsorship: boolean;
          source_name: string | null;
          ats_type: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          title: string;
          company: string;
          location: string;
          country: string;
          country_flag: string;
          url: string;
          description: string;
          posted_at?: string | null;
          fetched_at?: string;
          date_unknown?: boolean;
          is_remote?: boolean;
          salary?: string | null;
          mode: string;
          visa_sponsorship?: boolean;
          source_name?: string | null;
          ats_type?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          company?: string;
          location?: string;
          country?: string;
          country_flag?: string;
          url?: string;
          description?: string;
          posted_at?: string | null;
          fetched_at?: string;
          date_unknown?: boolean;
          is_remote?: boolean;
          salary?: string | null;
          mode?: string;
          visa_sponsorship?: boolean;
          source_name?: string | null;
          ats_type?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      salary_reports: {
        Row: {
          id: string;
          user_id: string | null;
          role_title: string;
          years_experience: number;
          salary_egp: number | null;
          salary_usd: number | null;
          currency: string;
          employment_type: string | null;
          work_arrangement: string | null;
          pipeline: string | null;
          reported_at: string;
          reminder_sent_at: string | null;
          last_updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          role_title: string;
          years_experience: number;
          salary_egp?: number | null;
          salary_usd?: number | null;
          currency: string;
          employment_type?: string | null;
          work_arrangement?: string | null;
          pipeline?: string | null;
          reported_at?: string;
          reminder_sent_at?: string | null;
          last_updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          role_title?: string;
          years_experience?: number;
          salary_egp?: number | null;
          salary_usd?: number | null;
          currency?: string;
          employment_type?: string | null;
          work_arrangement?: string | null;
          pipeline?: string | null;
          reported_at?: string;
          reminder_sent_at?: string | null;
          last_updated_at?: string;
        };
        Relationships: [];
      };
      tracker_entries: {
        Row: {
          id: string;
          user_id: string;
          job_id: string;
          job_snapshot: Json;
          status: string;
          notes: string | null;
          applied_at: string | null;
          last_status_change: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          job_id: string;
          job_snapshot: Json;
          status?: string;
          notes?: string | null;
          applied_at?: string | null;
          last_status_change?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          job_id?: string;
          job_snapshot?: Json;
          status?: string;
          notes?: string | null;
          applied_at?: string | null;
          last_status_change?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_jobs_cache: {
        Row: {
          user_id: string;
          jobs: Json;
          cached_at: string;
          raw_pool_version: string | null;
          pipeline_log: Json | null;
        };
        Insert: {
          user_id: string;
          jobs?: Json;
          cached_at?: string;
          raw_pool_version?: string | null;
          pipeline_log?: Json | null;
        };
        Update: {
          user_id?: string;
          jobs?: Json;
          cached_at?: string;
          raw_pool_version?: string | null;
          pipeline_log?: Json | null;
        };
        Relationships: [];
      };
      user_profiles: {
        Row: {
          id: string;
          email: string;
          role: string;
          gemini_api_key: string | null;
          onboarding_complete: boolean;
          is_active: boolean;
          created_at: string;
          last_active_at: string | null;
        };
        Insert: {
          id: string;
          email: string;
          role?: string;
          gemini_api_key?: string | null;
          onboarding_complete?: boolean;
          is_active?: boolean;
          created_at?: string;
          last_active_at?: string | null;
        };
        Update: {
          id?: string;
          email?: string;
          role?: string;
          gemini_api_key?: string | null;
          onboarding_complete?: boolean;
          is_active?: boolean;
          created_at?: string;
          last_active_at?: string | null;
        };
        Relationships: [];
      };
      user_settings: {
        Row: {
          user_id: string;
          uses_defaults: boolean;
          expert_skills: string[] | null;
          secondary_skills: string[] | null;
          bonus_skills: string[] | null;
          job_age_days: number | null;
          pipeline_visa: boolean | null;
          pipeline_local: boolean | null;
          pipeline_global: boolean | null;
          seniority_allow_mid: boolean | null;
          gemini_filter_prompt: string | null;
          scoring_weights: Json | null;
          score_denominator: number | null;
          excluded_keywords: string[] | null;
          blacklisted_locations: string[] | null;
          required_keywords: string[] | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          uses_defaults?: boolean;
          expert_skills?: string[] | null;
          secondary_skills?: string[] | null;
          bonus_skills?: string[] | null;
          job_age_days?: number | null;
          pipeline_visa?: boolean | null;
          pipeline_local?: boolean | null;
          pipeline_global?: boolean | null;
          seniority_allow_mid?: boolean | null;
          gemini_filter_prompt?: string | null;
          scoring_weights?: Json | null;
          score_denominator?: number | null;
          excluded_keywords?: string[] | null;
          blacklisted_locations?: string[] | null;
          required_keywords?: string[] | null;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          uses_defaults?: boolean;
          expert_skills?: string[] | null;
          secondary_skills?: string[] | null;
          bonus_skills?: string[] | null;
          job_age_days?: number | null;
          pipeline_visa?: boolean | null;
          pipeline_local?: boolean | null;
          pipeline_global?: boolean | null;
          seniority_allow_mid?: boolean | null;
          gemini_filter_prompt?: string | null;
          scoring_weights?: Json | null;
          score_denominator?: number | null;
          excluded_keywords?: string[] | null;
          blacklisted_locations?: string[] | null;
          required_keywords?: string[] | null;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
