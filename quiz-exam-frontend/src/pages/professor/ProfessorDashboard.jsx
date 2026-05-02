import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { exams as examsApi, questions as questionsApi, results as resultsApi } from '../../api/api'
import StatCard from '../../components/StatCard'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell,
} from 'recharts'
import styles from './ProfessorDashboard.module.css'

const tooltipStyle = {
  background: '#1e293b',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  fontSize: 12,
}

export default function ProfessorDashboard() {
  const { session } = useAuth()
  const navigate    = useNavigate()

  const [exams,         setExams]         = useState([])
  const [questionCount, setQuestionCount] = useState(0)
  const [attemptData,   setAttemptData]   = useState({}) // examId → { count, avg, passRate }

  useEffect(() => {
    questionsApi.list().then(d => setQuestionCount((d || []).length)).catch(() => {})

    examsApi.list()
      .then(list => {
        setExams(list || [])
        /* fetch results for every exam in parallel */
        return Promise.all(
          (list || []).map(e =>
            resultsApi.byExam(e.id)
              .then(res => ({ examId: e.id, results: res || [] }))
              .catch(() => ({ examId: e.id, results: [] }))
          )
        )
      })
      .then(perExam => {
        const map = {}
        perExam.forEach(({ examId, results }) => {
          const count = results.length
          const avg   = count ? results.reduce((s, r) => s + (r.percentage || 0), 0) / count : 0
          const pass  = results.filter(r => r.percentage >= 50).length
          map[examId] = { count, avg, passRate: count ? (pass / count) * 100 : 0 }
        })
        setAttemptData(map)
      })
      .catch(() => {})
  }, [])

  const activeExams      = exams.filter(e => e.status === 'ACTIVE')
  const totalSubmissions = Object.values(attemptData).reduce((s, d) => s + d.count, 0)
  const overallAvg       = totalSubmissions
    ? Object.entries(attemptData).reduce((s, [, d]) => s + d.avg * d.count, 0) / totalSubmissions
    : 0

  /* bar chart: top exams by submission count */
  const activityBars = exams
    .map(e => ({
      name:  e.title.length > 18 ? e.title.slice(0, 16) + '…' : e.title,
      count: attemptData[e.id]?.count || 0,
      avg:   attemptData[e.id]?.avg   || 0,
      id:    e.id,
    }))
    .filter(d => d.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Professor Dashboard</h1>
          <p className={styles.sub}>Welcome, <strong>{session.username}</strong></p>
        </div>
      </div>

      {/* ── Stat cards ──────────────────────────────────────────────────── */}
      <div className={styles.statsGrid}>
        <StatCard icon="📋" label="My Exams"       value={exams.length}         color="primary"   />
        <StatCard icon="✅" label="Active Exams"   value={activeExams.length}   color="success"   />
        <StatCard icon="❓" label="Questions"       value={questionCount}        color="secondary" />
        <StatCard icon="📊" label="Submissions"     value={totalSubmissions}     color="warning"   />
        <StatCard icon="📈" label="Overall Avg"    value={`${overallAvg.toFixed(1)}%`} color="primary" />
      </div>

      {/* ── Exam Activity chart ──────────────────────────────────────────── */}
      {activityBars.length > 0 && (
        <div className={styles.activityCard}>
          <h3 className={styles.cardTitle}>Exam Attempt Activity</h3>
          <p className={styles.cardSub}>Submissions per exam (click a bar to view results)</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={activityBars} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}
              onClick={d => d?.activePayload && navigate(`/professor/results?exam=${d.activePayload[0].payload.id}`)}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
              <XAxis dataKey="name" stroke="#64748b" fontSize={11} tick={{ fill: '#94a3b8' }} />
              <YAxis stroke="#64748b" fontSize={11} tick={{ fill: '#94a3b8' }} allowDecimals={false} />
              <Tooltip
                formatter={(v, name) => [name === 'count' ? `${v} submissions` : `${v.toFixed(1)}%`, name === 'count' ? 'Submissions' : 'Avg Score']}
                contentStyle={tooltipStyle}
                cursor={{ fill: 'rgba(108,99,255,0.08)' }}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={44} style={{ cursor: 'pointer' }}>
                {activityBars.map((entry, i) => (
                  <Cell key={i} fill={entry.avg >= 50 ? '#6c63ff' : '#f59e0b'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className={styles.chartHint}>Purple = class avg ≥ 50% &nbsp;·&nbsp; Amber = class avg &lt; 50%</p>
        </div>
      )}

      {/* ── Two-column: recent exams + quick actions ──────────────────── */}
      <div className={styles.twoCol}>
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Recent Exams</h3>
          <div className={styles.examList}>
            {exams.slice(0, 5).map(e => {
              const data = attemptData[e.id] || { count: 0, avg: 0 }
              return (
                <div key={e.id} className={styles.examItem}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className={styles.examName}>{e.title}</p>
                    <p className={styles.examMeta}>{e.timeLimitMinutes} min · {e.totalQuestions ?? 0} questions</p>
                  </div>
                  <div className={styles.examItemRight}>
                    <span className={`${styles.statusDot} ${e.status === 'ACTIVE' ? styles.active : styles.draft}`}>
                      {e.status}
                    </span>
                    {data.count > 0 && (
                      <span className={styles.attemptPill}
                        onClick={() => navigate(`/professor/results?exam=${e.id}`)}
                        title="View results">
                        👥 {data.count} &nbsp;·&nbsp; {data.avg.toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
            {exams.length === 0 && <p className={styles.empty}>No exams yet.</p>}
          </div>
          <button className={styles.viewAll} onClick={() => navigate('/professor/exams')}>View all exams →</button>
        </div>

        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Quick Actions</h3>
          <div className={styles.actionList}>
            {[
              { label: 'Manage Categories',      icon: '🗂', path: '/professor/categories'           },
              { label: 'Create New Question',     icon: '➕', path: '/professor/questions'             },
              { label: 'Generate from Document',  icon: '✨', path: '/professor/generate'              },
              { label: 'Create Exam from PDF',    icon: '📄', path: '/professor/create-exam-from-pdf' },
              { label: 'Create New Exam',         icon: '📝', path: '/professor/exams'                },
              { label: 'View Results',            icon: '📊', path: '/professor/results'              },
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
