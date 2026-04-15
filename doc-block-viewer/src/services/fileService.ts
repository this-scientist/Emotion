import { supabase } from '../lib/supabase'
import type { Database } from '../lib/supabase'

type Folder = Database['public']['Tables']['folders']['Row']
type UserFile = Database['public']['Tables']['user_files']['Row']

export class FileService {
  async getFolders(userId: string): Promise<Folder[]> {
    const { data, error } = await supabase
      .from('folders')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching folders:', error)
      return []
    }

    return data || []
  }

  async createFolder(userId: string, name: string, parentId?: string | null, color?: string): Promise<Folder | null> {
    const { data, error } = await supabase
      .from('folders')
      .insert({
        user_id: userId,
        name,
        parent_id: parentId || null,
        color: color || '#6366F1',
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating folder:', error)
      return null
    }

    return data
  }

  async updateFolder(folderId: string, updates: Partial<Folder>): Promise<boolean> {
    const { error } = await supabase
      .from('folders')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', folderId)

    if (error) {
      console.error('Error updating folder:', error)
      return false
    }

    return true
  }

  async deleteFolder(folderId: string): Promise<boolean> {
    const { error } = await supabase
      .from('folders')
      .delete()
      .eq('id', folderId)

    if (error) {
      console.error('Error deleting folder:', error)
      return false
    }

    return true
  }

  async getFiles(userId: string, folderId?: string | null): Promise<UserFile[]> {
    let query = supabase
      .from('user_files')
      .select('*')
      .eq('user_id', userId)

    if (folderId !== undefined) {
      query = query.eq('folder_id', folderId)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching files:', error)
      return []
    }

    return data || []
  }

  async createFile(
    userId: string,
    fileName: string,
    originalName: string,
    content?: string,
    folderId?: string | null
  ): Promise<UserFile | null> {
    const { data, error } = await supabase
      .from('user_files')
      .insert({
        user_id: userId,
        folder_id: folderId || null,
        file_name: fileName,
        original_name: originalName,
        file_content: content || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating file:', error)
      return null
    }

    return data
  }

  async updateFile(
    fileId: string,
    updates: {
      blocks_data?: Record<string, unknown>
      mappings_data?: Record<string, unknown>
      analysis_data?: Record<string, unknown>
    }
  ): Promise<boolean> {
    const { error } = await supabase
      .from('user_files')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', fileId)

    if (error) {
      console.error('Error updating file:', error)
      return false
    }

    return true
  }

  async deleteFile(fileId: string): Promise<boolean> {
    const { error } = await supabase
      .from('user_files')
      .delete()
      .eq('id', fileId)

    if (error) {
      console.error('Error deleting file:', error)
      return false
    }

    return true
  }

  async getFileContent(fileId: string): Promise<UserFile | null> {
    const { data, error } = await supabase
      .from('user_files')
      .select('*')
      .eq('id', fileId)
      .single()

    if (error) {
      console.error('Error fetching file:', error)
      return null
    }

    return data
  }
}

export const fileService = new FileService()
