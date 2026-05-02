import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import styles from './Navbar.module.css'

const roleLinks = {
  ADMIN: [
    { label: 'Dashboard', path: '/admin', icon: '📊' },
    { label: 'Users', path: '/admin/users', icon: '👥' },
    { label: 'Analytics', path: '/admin/analytics', icon: '📈' },
    { label: 'Results', path: '/admin/results', icon: '📄' },
  ],
  PROFESSOR: [
    { label: 'Dashboard', path: '/professor', icon: '🧭' },
    { label: 'Categories', path: '/professor/categories', icon: '🗂️' },
    { label: 'Questions', path: '/professor/questions', icon: '❓' },
    { label: 'Create PDF Exam', path: '/professor/create-exam-from-pdf', icon: '📘' },
    { label: 'Generate', path: '/professor/generate', icon: '✨' },
    { label: 'Exams', path: '/professor/exams', icon: '📝' },
    { label: 'Papers', path: '/professor/papers', icon: '🖨️' },
    { label: 'Results', path: '/professor/results', icon: '📊' },
  ],
  STUDENT: [
    { label: 'Dashboard', path: '/student', icon: '🏠' },
    { label: 'My Exams', path: '/student/exams', icon: '📚' },
    { label: 'Results', path: '/student/results', icon: '🏆' },
  ],
}

function getActiveLink(links, pathname) {
  const exact = links.find(link => pathname === link.path)
  if (exact) return exact
  if (pathname.startsWith('/student/exam/')) {
    return links.find(link => link.path === '/student/exams')
  }
  return links.find(link => pathname.startsWith(link.path))
}

export default function Navbar() {
  const { session, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  const links = roleLinks[session?.role] || []
  const activeLink = useMemo(() => getActiveLink(links, location.pathname), [links, location.pathname])
  const initials = (session?.fullName || session?.username || '?').slice(0, 2).toUpperCase()
  const displayName = session?.fullName || session?.username

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  if (!session) return null

  const isLinkActive = link => {
    if (location.pathname === link.path) return true
    if (location.pathname.startsWith(`${link.path}/`)) return true
    if (link.path === '/student/exams' && location.pathname.startsWith('/student/exam/')) return true
    return false
  }

  return (
    <>
      <div
        className={`${styles.backdrop} ${menuOpen ? styles.backdropShow : ''}`}
        onClick={() => setMenuOpen(false)}
        aria-hidden={!menuOpen}
      />

      <aside className={`${styles.sidebar} ${menuOpen ? styles.sidebarOpen : ''}`}>
        <button className={styles.brand} onClick={() => navigate('/')}>
          <span className={styles.logo}>QM</span>
          <span className={styles.brandText}>
            <strong>QuizMaster</strong>
            <small>Exam Platform</small>
          </span>
        </button>

        <div className={styles.rolePill}>{session.role}</div>

        <nav className={styles.links}>
          {links.map(link => (
            <button
              key={link.path}
              className={`${styles.link} ${isLinkActive(link) ? styles.active : ''}`}
              onClick={() => navigate(link.path)}
            >
              <span className={styles.linkIcon} aria-hidden>{link.icon}</span>
              <span>{link.label}</span>
            </button>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <button className={styles.profileBtn} onClick={() => navigate('/profile')}>
            <span aria-hidden>👤</span>
            <span>My Profile</span>
          </button>
          <button className={styles.logoutBtn} onClick={handleLogout}>
            <span aria-hidden>🚪</span>
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <header className={styles.topbar}>
        <div className={styles.topLeft}>
          <button className={styles.menuToggle} onClick={() => setMenuOpen(o => !o)} aria-label="Toggle menu">
            {menuOpen ? '✕' : '☰'}
          </button>
          <div>
            <p className={styles.pageLabel}>{activeLink?.label || 'QuizMaster'}</p>
            <p className={styles.pageSub}>Manage exams with confidence</p>
          </div>
        </div>

        <div className={styles.userWrap}>
          <div className={styles.userMeta}>
            <p className={styles.userName}>{displayName}</p>
            <p className={styles.userRole}>{session.role.toLowerCase()}</p>
          </div>
          <button className={styles.avatarBtn} onClick={() => navigate('/profile')} title="Open profile">
            {initials}
          </button>
        </div>
      </header>
    </>
  )
}
