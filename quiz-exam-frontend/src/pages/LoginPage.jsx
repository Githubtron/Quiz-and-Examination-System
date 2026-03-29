import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import styles from './AuthPage.module.css'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async e => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const session = login(form.username, form.password)
      if (session.role === 'ADMIN') navigate('/admin')
      else if (session.role === 'PROFESSOR') navigate('/professor')
      else navigate('/student')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fillDemo = (username, password) => setForm({ username, password })

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <div className={styles.logo}>QM</div>
          <h1 className={styles.title}>Welcome back</h1>
          <p className={styles.sub}>Sign in to your QuizMaster account</p>
        </div>

        {error && <div className={styles.error} role="alert">{error}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="username">Username</label>
            <input
              id="username" type="text" placeholder="Enter your username"
              value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              required autoFocus
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="password">Password</label>
            <input
              id="password" type="password" placeholder="Enter your password"
              value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              required
            />
          </div>
          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div className={styles.demos}>
          <p className={styles.demoLabel}>Quick demo login:</p>
          <div className={styles.demoRow}>
            <button onClick={() => fillDemo('admin', 'admin123')} className={styles.demoBtn}>Admin</button>
            <button onClick={() => fillDemo('professor', 'prof123')} className={styles.demoBtn}>Professor</button>
            <button onClick={() => fillDemo('student', 'student123')} className={styles.demoBtn}>Student</button>
          </div>
        </div>

        <p className={styles.switchLink}>
          Don't have an account? <Link to="/register">Create one</Link>
        </p>
      </div>
    </div>
  )
}
