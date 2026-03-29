import React, { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import styles from './Navbar.module.css'

const roleLinks = {
  ADMIN: [
    { label: 'Dashboard', path: '/admin' },
    { label: 'Users', path: '/admin/users' },
    { label: 'Analytics', path: '/admin/analytics' },
    { label: 'Results', path: '/admin/results' },
  ],
  PROFESSOR: [
    { label: 'Dashboard', path: '/professor' },
    { label: 'Questions', path: '/professor/questions' },
    { label: 'Exams', path: '/professor/exams' },
    { label: 'Results', path: '/professor/results' },
  ],
  STUDENT: [
    { label: 'Dashboard', path: '/student' },
    { label: 'My Exams', path: '/student/exams' },
    { label: 'Results', path: '/student/results' },
  ],
}

export default function Navbar() {
  const { session, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [dropOpen, setDropOpen] = useState(false)
  const dropRef = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (!session) return null

  const links = roleLinks[session.role] || []
  const initials = (session.fullName || session.username).slice(0, 2).toUpperCase()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <nav className={styles.nav}>
      <div className={styles.inner}>
        <div className={styles.brand} onClick={() => navigate('/')}>
          <span className={styles.logo}>QM</span>
          <span className={styles.brandName}>QuizMaster</span>
        </div>

        <ul className={`${styles.links} ${menuOpen ? styles.open : ''}`}>
          {links.map(l => (
            <li key={l.path}>
              <button
                className={`${styles.link} ${location.pathname === l.path ? styles.active : ''}`}
                onClick={() => { navigate(l.path); setMenuOpen(false) }}
              >
                {l.label}
              </button>
            </li>
          ))}
        </ul>

        <div className={styles.right}>
          <div className={styles.roleBadge}>{session.role}</div>
          <div className={styles.avatarWrap} ref={dropRef}>
            <div className={styles.avatar} title={session.username} onClick={() => setDropOpen(o => !o)}>
              {initials}
            </div>
            {dropOpen && (
              <div className={styles.dropdown}>
                <div className={styles.dropHeader}>
                  <p className={styles.dropName}>{session.fullName || session.username}</p>
                  <p className={styles.dropEmail}>{session.email}</p>
                </div>
                <button className={styles.dropItem} onClick={() => { navigate('/profile'); setDropOpen(false) }}>
                  👤 My Profile
                </button>
                <div className={styles.dropDivider} />
                <button className={styles.dropItem + ' ' + styles.dropLogout} onClick={handleLogout}>
                  🚪 Sign out
                </button>
              </div>
            )}
          </div>
          <button className={styles.logoutBtn} onClick={handleLogout}>Sign out</button>
          <button className={styles.hamburger} onClick={() => setMenuOpen(o => !o)} aria-label="Menu">
            <span /><span /><span />
          </button>
        </div>
      </div>
    </nav>
  )
}
