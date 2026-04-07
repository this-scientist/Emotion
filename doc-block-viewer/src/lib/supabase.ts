import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ── 类型定义 ──
export interface Profile {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface Folder {
  id: string
  user_id: string
  parent_id: string | null
  name: string
  color: string
  description: string | null
  created_at: string
  updated_at: string
  file_count?: number
}

export interface UserFile {
  id: string
  user_id: string
  folder_id: string | null
  file_name: string
  original_name: string
  file_content: Record<string, unknown> | null
  file_meta: Record<string, unknown> | null
  blocks_data: Record<string, unknown> | null
  mappings_data: Record<string, unknown> | null
  analysis_data: Record<string, unknown> | null
  created_at: string
  updated_at: string
}
