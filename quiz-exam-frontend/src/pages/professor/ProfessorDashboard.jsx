import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { exams as examsApi, questions as questionsApi, results as resultsApi } from '../../api/api'
import StatCard from '../../components/StatCard'
import styles from './ProfessorDashboard.module.css'

export default function ProfessorDashboard() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [exams, setExams] = useState([])
  const [questionCount, setQuestionCount] = useState(0)
  const [resultCount, setResultCount] = useState(0)

  useEffect(() => {
    examsApi.list().then(data => setExams(data || [])).catch(() => {})
    questionsApi.list().then(data => setQuestionCount((data || []).length)).catch(() => {})
    resultsApi.all().then(data => setResultCount((data || []).length)).catch(() => {})
  }, [])

  const activeExams = exams.filter(e => e.status === 'ACTIVE')

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Professor Dashboard</h1>
          <p className={styles.sub}>Welcome, <strong>{session.username}</strong></p>
        </div>
      </div>

      <div className={styles.statsGrid}>
        <StatCard icon="📋" label="My Exams" value={exams.length} color="primary" />
        <StatCard icon="✅" label="Active Exams" value={activeExams.length} color="success" />
        <StatCard icon="❓" label="Questions" value={questionCount} color="secondary" />
        <StatCard icon="📊" label="Submissions" value={resultCount} color="warning" />
      </div>

      <div className={styles.twoCol}>
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Recent Exams</h3>
          <div className={styles.examList}>
            {exams.slice(0, 3).map(e => (
              <div key={e.id} className={styles.examItem}>
                <div>
                  <p className={styles.examName}>{e.title}</p>
                  <p className={styles.examMeta}>{e.timeLimitMinutes} min · {e.totalQuestions ?? 0} questions</p>
                </div>
                <span className={`${styles.statusDot} ${e.status === 'ACTIVE' ? styles.active : styles.draft}`}>
                  {e.status}
                </span>
              </div>
            ))}
            {exams.length === 0 && <p className={styles.empty}>No exams yet.</p>}
          </div>
          <button className={styles.viewAll} onClick={() => navigate('/professor/exams')}>View all exams →</button>
        </div>

        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Quick Actions</h3>
          <div className={styles.actionList}>
            {[
              { label: 'Manage Categories', icon: '🗂', path: '/professor/categories' },
              { label: 'Create New Question', icon: '➕', path: '/professor/questions' },
              { label: 'Generate from Document', icon: '✨', path: '/professor/generate' },
              { label: 'Create Exam from PDF', icon: '📄', path: '/professor/create-exam-from-pdf' },
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
