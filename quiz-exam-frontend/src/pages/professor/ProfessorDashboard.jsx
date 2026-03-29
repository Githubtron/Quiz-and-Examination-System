import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import StatCard from '../../components/StatCard'
import { mockExams, mockQuestions, mockResults } from '../../api/mockData'
import styles from './ProfessorDashboard.module.css'

export default function ProfessorDashboard() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const activeExams = mockExams.filter(e => e.status === 'ACTIVE')

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Professor Dashboard</h1>
          <p className={styles.sub}>Welcome, <strong>{session.username}</strong></p>
        </div>
      </div>

      <div className={styles.statsGrid}>
        <StatCard icon="📋" label="My Exams" value={mockExams.length} color="primary" />
        <StatCard icon="✅" label="Active Exams" value={activeExams.length} color="success" />
        <StatCard icon="❓" label="Questions" value={mockQuestions.length} color="secondary" />
        <StatCard icon="📊" label="Submissions" value={mockResults.length} color="warning" />
      </div>

      <div className={styles.twoCol}>
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Recent Exams</h3>
          <div className={styles.examList}>
            {mockExams.slice(0, 3).map(e => (
              <div key={e.id} className={styles.examItem}>
                <div>
                  <p className={styles.examName}>{e.title}</p>
                  <p className={styles.examMeta}>{e.timeLimitMinutes} min · {e.totalQuestions} questions</p>
                </div>
                <span className={`${styles.statusDot} ${e.status === 'ACTIVE' ? styles.active : styles.draft}`}>
                  {e.status}
                </span>
              </div>
            ))}
          </div>
          <button className={styles.viewAll} onClick={() => navigate('/professor/exams')}>View all exams →</button>
        </div>

        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Quick Actions</h3>
          <div className={styles.actionList}>
            {[
              { label: 'Create New Question', icon: '➕', path: '/professor/questions' },
              { label: 'Create New Exam', icon: '📝', path: '/professor/exams' },
              { label: 'View Results', icon: '📊', path: '/professor/results' },
            ].map(a => (
              <button key={a.path} className={styles.actionItem} onClick={() => navigate(a.path)}>
                <span className={styles.actionIcon}>{a.icon}</span>
                <span>{a.label}</span>
                <span className={styles.arrow}>→</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
