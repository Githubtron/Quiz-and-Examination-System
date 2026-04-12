import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { exams as examsApi, results as resultsApi, users as usersApi } from '../../api/api'
import StatCard from '../../components/StatCard'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import styles from './AdminDashboard.module.css'

const COLORS = ['#6c63ff', '#00bcd4', '#10b981', '#f59e0b', '#ef4444']

function liveStatus(exam) {
  if (exam.status === 'DRAFT') return 'DRAFT'
  const now = new Date()
  if (exam.startDatetime && new Date(exam.startDatetime) > now) return 'SCHEDULED'
  if (exam.endDatetime && new Date(exam.endDatetime) < now) return 'ENDED'
  return 'ACTIVE'
}

export default function AdminDashboard() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [allExams, setAllExams] = useState([])
  const [allResults, setAllResults] = useState([])
  const [userCount, setUserCount] = useState(0)

  useEffect(() => {
    examsApi.list().then(data => setAllExams(data || [])).catch(() => {})
    resultsApi.all().then(data => setAllResults(data || [])).catch(() => {})
    usersApi.list().then(data => setUserCount((data || []).length)).catch(() => {})
  }, [])

  const activeExams = allExams.filter(e => e.status === 'ACTIVE').length
  const avgScore = allResults.length
    ? (allResults.reduce((s, r) => s + r.percentage, 0) / allResults.length).toFixed(1)
    : 0
  const passCount = allResults.filter(r => r.percentage >= 50).length

  const barData = allResults.slice(0, 10).map(r => ({ name: `#${r.attemptId}`, score: r.percentage }))
  const pieData = [
    { name: '81-100%', value: allResults.filter(r => r.percentage > 80).length },
    { name: '61-80%', value: allResults.filter(r => r.percentage > 60 && r.percentage <= 80).length },
    { name: '41-60%', value: allResults.filter(r => r.percentage > 40 && r.percentage <= 60).length },
    { name: '0-40%', value: allResults.filter(r => r.percentage <= 40).length },
  ].filter(d => d.value > 0)

  const recentActivity = [
    ...allResults.slice(-4).reverse().map(r => ({
      id: `attempt-${r.id}`,
      text: `Attempt #${r.attemptId} scored ${r.percentage?.toFixed(1)}%`,
      tone: r.percentage >= 50 ? 'success' : 'danger',
    })),
    ...allExams.slice(-3).reverse().map(e => ({
      id: `exam-${e.id}`,
      text: `"${e.title}" is currently ${liveStatus(e).toLowerCase()}`,
      tone: 'info',
    })),
  ].slice(0, 6)

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Admin Dashboard</h1>
          <p className={styles.sub}>Welcome back, <strong>{session.username}</strong> — here's your system overview</p>
        </div>
      </div>

      <div className={styles.statsGrid}>
        <StatCard icon="📋" label="Total Exams" value={allExams.length} color="primary" />
        <StatCard icon="✅" label="Active Exams" value={activeExams} color="success" />
        <StatCard icon="👥" label="Total Users" value={userCount} color="secondary" />
        <StatCard icon="📈" label="Avg Score" value={`${avgScore}%`} color="warning" />
        <StatCard icon="🏆" label="Pass Rate" value={allResults.length ? `${((passCount / allResults.length) * 100).toFixed(0)}%` : '—'} color="success" />
      </div>

      {(barData.length > 0 || pieData.length > 0) && (
        <div className={styles.chartsRow}>
          {barData.length > 0 && (
            <div className={styles.chartCard}>
              <h3 className={styles.chartTitle}>Recent Scores</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={barData}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={v => `${v?.toFixed(1)}%`} />
                  <Bar dataKey="score" fill="#6c63ff" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {pieData.length > 0 && (
            <div className={styles.chartCard}>
              <h3 className={styles.chartTitle}>Score Distribution</h3>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      <div className={styles.quickActions}>
        <div className={styles.sectionGrid}>
          <div className={styles.sectionCard}>
            <h3 className={styles.sectionTitle}>Quick Actions</h3>
            <div className={styles.actionGrid}>
              {[
                { label: 'Manage Users', icon: '👥', path: '/admin/users' },
                { label: 'View Analytics', icon: '📊', path: '/admin/analytics' },
                { label: 'All Results', icon: '📋', path: '/admin/results' },
              ].map(a => (
                <button key={a.path} className={styles.actionBtn} onClick={() => navigate(a.path)}>
                  <span className={styles.actionIcon}>{a.icon}</span>
                  <span>{a.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.sectionCard}>
            <h3 className={styles.sectionTitle}>Recent Activity</h3>
            <div className={styles.activityList}>
              {recentActivity.length === 0 && <p className={styles.empty}>No recent activity.</p>}
              {recentActivity.map(item => (
                <div key={item.id} className={styles.activityItem}>
                  <span className={`${styles.activityDot} ${styles[item.tone]}`} />
                  <p>{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
