import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Lock, Mail, UserRound } from 'lucide-react'
import styles from './AuthPage.module.css'

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', email: '', password: '', role: 'STUDENT' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async e => {
    e.preventDefault()
    setError('')
    try {
      await register(form.username, form.email, form.password, form.role)
      setSuccess(true)
      setTimeout(() => navigate('/login'), 1500)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <div className={styles.logo}>QM</div>
          <h1 className={styles.title}>Create account</h1>
          <p className={styles.sub}>Join QuizMaster today</p>
        </div>

        {error && <div className={styles.error} role="alert">{error}</div>}
        {success && <div className={styles.successMsg}>Account created! Redirecting…</div>}

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
              />
              <label htmlFor="username">Username</label>
            </div>
          </div>

          <div className={styles.field}>
            <div className={styles.inputWrap}>
              <span className={styles.inputIcon}><Mail size={16} /></span>
              <input
                id="email"
                type="email"
                placeholder=" "
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                required
              />
              <label htmlFor="email">Email</label>
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
              <label htmlFor="password">Password <span className={styles.hint}>(min 8 chars)</span></label>
            </div>
          </div>

          <div className={styles.field}>
            <div className={styles.inputWrap}>
              <select id="role" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                <option value="STUDENT">Student</option>
                <option value="PROFESSOR">Professor</option>
              </select>
              <label htmlFor="role">Role</label>
            </div>
          </div>

          <button type="submit" className={styles.submitBtn}>Create Account</button>
        </form>

        <p className={styles.switchLink}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
