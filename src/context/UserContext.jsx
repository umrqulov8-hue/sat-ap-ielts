import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { clearCache } from '../lib/dataCache'

const UserContext = createContext()
export const useUser = () => useContext(UserContext)

export function UserProvider({ children }) {
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(true)

  const fetchProfile = useCallback(async () => {
    setProfileLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { setProfile(null); setProfileLoading(false); return }
    const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle()
    if (data) setProfile(data)
    setProfileLoading(false)
  }, [])

  useEffect(() => { fetchProfile() }, [fetchProfile])

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setProfile(null)
        clearCache()
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  return (
    <UserContext.Provider value={{ profile, profileLoading, refreshUser: fetchProfile, isAdmin: profile?.role === 'admin' || profile?.role === 'owner', isOwner: profile?.role === 'owner', userRole: profile?.role || 'user' }}>
      {children}
    </UserContext.Provider>
  )
}
