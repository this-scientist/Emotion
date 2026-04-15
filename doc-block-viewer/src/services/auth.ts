import { supabase } from '../lib/supabase'
import type { Database } from '../lib/supabase'

type Profile = Database['public']['Tables']['profiles']['Row']

export interface AuthState {
  user: Profile | null
  loading: boolean
  error: string | null
}

class AuthService {
  private currentUser: Profile | null = null

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return { success: false, error: error.message }
    }

    // Fetch user profile
    if (data.user) {
      const profile = await this.getProfile(data.user.id)
      this.currentUser = profile
    }

    return { success: true, user: this.currentUser }
  }

  async signUp(email: string, password: string, username: string, displayName?: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      return { success: false, error: error.message }
    }

    if (data.user) {
      // Create profile
      await this.createProfile(data.user.id, username, displayName)
      
      const profile = await this.getProfile(data.user.id)
      this.currentUser = profile
    }

    return { success: true, user: this.currentUser }
  }

  async signOut() {
    await supabase.auth.signOut()
    this.currentUser = null
  }

  async getCurrentUser(): Promise<Profile | null> {
    if (this.currentUser) {
      return this.currentUser
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return null
    }

    this.currentUser = await this.getProfile(user.id)
    return this.currentUser
  }

  private async getProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Error fetching profile:', error)
      return null
    }

    return data
  }

  private async createProfile(userId: string, username: string, displayName?: string) {
    const { error } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        username,
        display_name: displayName || username,
      })

    if (error) {
      console.error('Error creating profile:', error)
      throw error
    }
  }

  onAuthStateChange(callback: (user: Profile | null) => void) {
    return supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const profile = await this.getProfile(session.user.id)
        this.currentUser = profile
        callback(profile)
      } else if (event === 'SIGNED_OUT') {
        this.currentUser = null
        callback(null)
      }
    })
  }
}

export const authService = new AuthService()
