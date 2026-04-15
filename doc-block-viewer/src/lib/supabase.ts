import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables. Please check your .env file.')
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '')

// Database types
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string | null
          display_name: string | null
          avatar_url: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id: string
          username?: string | null
          display_name?: string | null
          avatar_url?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          username?: string | null
          display_name?: string | null
          avatar_url?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      folders: {
        Row: {
          id: string
          user_id: string
          parent_id: string | null
          name: string
          color: string | null
          description: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          parent_id?: string | null
          name: string
          color?: string | null
          description?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          parent_id?: string | null
          name?: string
          color?: string | null
          description?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      user_files: {
        Row: {
          id: string
          user_id: string
          folder_id: string | null
          file_name: string
          original_name: string
          file_content: string | null
          file_meta: Record<string, unknown> | null
          blocks_data: Record<string, unknown> | null
          mappings_data: Record<string, unknown> | null
          analysis_data: Record<string, unknown> | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          folder_id?: string | null
          file_name: string
          original_name: string
          file_content?: string | null
          file_meta?: Record<string, unknown> | null
          blocks_data?: Record<string, unknown> | null
          mappings_data?: Record<string, unknown> | null
          analysis_data?: Record<string, unknown> | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          folder_id?: string | null
          file_name?: string
          original_name?: string
          file_content?: string | null
          file_meta?: Record<string, unknown> | null
          blocks_data?: Record<string, unknown> | null
          mappings_data?: Record<string, unknown> | null
          analysis_data?: Record<string, unknown> | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
    }
  }
}
