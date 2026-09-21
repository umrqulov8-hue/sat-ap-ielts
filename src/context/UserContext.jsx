import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { clearCache } from '../lib/dataCache'

const defaultUser = {
  profile: null,
  profileLoading: false,
  refreshUser: () => {},
  isAdmin: false,
  isOwner: false,
  userRole: 'user',
}

const UserContext = createContext(defaultUser)
export const useUser = () => useContext(UserContext) || defaultUser

export function UserProvider({ children }) {
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(true)

  const fetchProfile = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        setProfile(null)
        setProfileLoading(false)
        return
      }
      const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle()
      if (data) setProfile(data)
    } catch {
      // ignore fetch errors
    } finally {
      setProfileLoading(false)
    }
  }, [])

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return
      if (!session?.user) {
        setProfile(null)
        setProfileLoading(false)
        return
      }
      supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle().then(({ data }) => {
        if (!mounted) return
        if (data) setProfile(data)
        setProfileLoading(false)
      })
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setProfile(null)
        clearCache()
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        fetchProfile()
      }
    })

    return () => {
      mounted = false
      subscription?.unsubscribe?.()
    }
  }, [fetchProfile])

  const isAdmin = profile?.role === 'admin' || profile?.role === 'owner'
  const isOwner = profile?.role === 'owner'
  const userRole = profile?.role || 'user'

  return (
    <UserContext.Provider value={{ profile, profileLoading, refreshUser: fetchProfile, isAdmin, isOwner, userRole }}>
      {children}
    </UserContext.Provider>
  )
}
