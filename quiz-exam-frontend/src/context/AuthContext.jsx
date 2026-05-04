import React, { createContext, useContext, useState, useCallback } from 'react'
import { auth as authApi } from '../api/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    const saved = localStorage.getItem('qm_session')
    return saved ? JSON.parse(saved) : null
  })

  const persist = (data) => {
    const s = { token: data.token, userId: data.userId, username: data.username, role: data.role, email: data.email }
    setSession(s)
    localStorage.setItem('qm_session', JSON.stringify(s))
    return s
  }

  const login = useCallback(async (username, password) => {
    const data = await authApi.login(username, password)
    return persist(data)
  }, [])

  // Firebase auth: exchange Firebase ID token for a backend JWT
  const firebaseLogin = useCallback(async (idToken) => {
    const data = await authApi.firebaseLogin(idToken)
    return persist(data)
  }, [])

  // Demo login: bypasses Firebase/backend entirely — for presentations only
  const demoLogin = useCallback((role) => {
    const demos = {
      STUDENT: {
        token:    'demo-token-student-abc123xyz',
        userId:   'demo-student-001',
        username: 'alex_demo',
        role:     'STUDENT',
        email:    'alex.student@demo.quizmaster.app',
      },
      PROFESSOR: {
        token:    'demo-token-professor-xyz789abc',
        userId:   'demo-professor-001',
        username: 'dr_demo',
        role:     'PROFESSOR',
        email:    'dr.smith@demo.quizmaster.app',
      },
    }
    return persist(demos[role])
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
    <AuthContext.Provider value={{ session, login, firebaseLogin, demoLogin, logout, register, updateProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
