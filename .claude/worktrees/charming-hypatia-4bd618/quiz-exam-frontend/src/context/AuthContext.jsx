import React, { createContext, useContext, useState, useCallback } from 'react'
import { auth as authApi } from '../api/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    const saved = localStorage.getItem('qm_session')
    return saved ? JSON.parse(saved) : null
  })

  const login = useCallback(async (username, password) => {
    const data = await authApi.login(username, password)
    // data: { token, userId, username, role, email }
    const s = { token: data.token, userId: data.userId, username: data.username, role: data.role, email: data.email }
    setSession(s)
    localStorage.setItem('qm_session', JSON.stringify(s))
    return s
  }, [])

  const logout = useCallback(() => {
    setSession(null)
    localStorage.removeItem('qm_session')
  }, [])

  const register = useCallback(async (username, email, password, role) => {
    return authApi.register(username, email, password, role)
  }, [])

  const updateProfile = useCallback((updates) => {
    setSession(prev => {
      const updated = { ...prev, ...updates }
      localStorage.setItem('qm_session', JSON.stringify(updated))
      return updated
    })
  }, [])

  return (
    <AuthContext.Provider value={{ session, login, logout, register, updateProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
