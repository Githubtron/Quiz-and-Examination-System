import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Lock, UserRound } from 'lucide-react'
import styles from './AuthPage.module.css'

const ROLE_PRESETS = {
  ADMIN: { label: 'Admin', username: 'admin', password: 'admin123' },
  PROFESSOR: { label: 'Professor', username: 'professor', password: 'prof123' },
  STUDENT: { label: 'Student', username: 'student', password: 'student123' },
}

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [selectedRole, setSelectedRole] = useState('STUDENT')
  const [form, setForm] = useState({
    username: ROLE_PRESETS.STUDENT.username,
    password: ROLE_PRESETS.STUDENT.password,
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async e => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const session = await login(form.username, form.password)
      if (session.role === 'ADMIN') navigate('/admin')
      else if (session.role === 'PROFESSOR') navigate('/professor')
      else navigate('/student')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRoleSelect = role => {
    setSelectedRole(role)
    setForm({
      username: ROLE_PRESETS[role].username,
      password: ROLE_PRESETS[role].password,
    })
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <div className={styles.logo}>QM</div>
          <h1 className={styles.title}>Welcome back</h1>
          <p className={styles.sub}>Sign in to your QuizMaster account</p>
        </div>

        <div className={styles.roleToggle}>
          {Object.entries(ROLE_PRESETS).map(([role, meta]) => (
            <button
              key={role}
              type="button"
              className={`${styles.roleBtn} ${selectedRole === role ? styles.roleBtnActive : ''}`}
              onClick={() => handleRoleSelect(role)}
            >
              {meta.label}
            </button>
          ))}
        </div>

        {error && <div className={styles.error} role="alert">{error}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <div className={styles.inputWrap}>
              <span className={styles.inputIcon}><UserRound size={16} /></span>
              <input
                id="username"
                type="text"
                placeholder=" "
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                required
                autoFocus
              />
              <label htmlFor="username">Username</label>
            </div>
          </div>

          <div className={styles.field}>
            <div className={styles.inputWrap}>
              <span className={styles.inputIcon}><Lock size={16} /></span>
              <input
                id="password"
                type="password"
                placeholder=" "
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                required
              />
              <label htmlFor="password">Password</label>
            </div>
          </div>

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className={styles.demoLabel}>Tip: role toggle auto-fills demo credentials.</p>

        <p className={styles.switchLink}>
          Don't have an account? <Link to="/register">Create one</Link>
        </p>
      </div>
    </div>
  )
}
