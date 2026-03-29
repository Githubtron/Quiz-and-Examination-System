import React, { createContext, useContext, useState, useCallback } from 'react'

const AuthContext = createContext(null)

// Mock users for demo — replace with real API calls
const MOCK_USERS = [
  { id: 1, username: 'admin', password: 'admin123', role: 'ADMIN', email: 'admin@quizmaster.com' },
  { id: 2, username: 'professor', password: 'prof123', role: 'PROFESSOR', email: 'prof@quizmaster.com' },
  { id: 3, username: 'student', password: 'student123', role: 'STUDENT', email: 'student@quizmaster.com' },
]

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    const saved = localStorage.getItem('qm_session')
    return saved ? JSON.parse(saved) : null
  })

  const login = useCallback((username, password) => {
    const user = MOCK_USERS.find(u => u.username === username && u.password === password)
    if (!user) throw new Error('Invalid credentials')
    const s = { userId: user.id, username: user.username, role: user.role, email: user.email, token: crypto.randomUUID() }
    setSession(s)
    localStorage.setItem('qm_session', JSON.stringify(s))
    return s
  }, [])

  const logout = useCallback(() => {
    setSession(null)
    localStorage.removeItem('qm_session')
  }, [])

  const register = useCallback((username, email, password, role) => {
    if (!username || !email || !password) throw new Error('All fields are required')
    if (password.length < 8) throw new Error('Password must be at least 8 characters')
    return { username, email, role }
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
