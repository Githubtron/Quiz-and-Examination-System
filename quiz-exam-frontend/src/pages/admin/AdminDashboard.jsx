import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import StatCard from '../../components/StatCard'
import { mockExams, mockResults } from '../../api/mockData'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import styles from './AdminDashboard.module.css'

const COLORS = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ef4444']

export default function AdminDashboard() {
  const { session } = useAuth()
  const navigate = useNavigate()

  const activeExams = mockExams.filter(e => e.status === 'ACTIVE').length
  const avgScore = (mockResults.reduce((s, r) => s + r.percentage, 0) / mockResults.length).toFixed(1)
  const passCount = mockResults.filter(r => r.percentage >= 50).length

  const barData = mockResults.map(r => ({ name: r.studentName, score: r.percentage }))
  const pieData = [
    { name: '81-100%', value: mockResults.filter(r => r.percentage > 80).length },
    { name: '61-80%', value: mockResults.filter(r => r.percentage > 60 && r.percentage <= 80).length },
    { name: '41-60%', value: mockResults.filter(r => r.percentage > 40 && r.percentage <= 60).length },
    { name: '0-40%', value: mockResults.filter(r => r.percentage <= 40).length },
  ].filter(d => d.value > 0)

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Admin Dashboard</h1>
          <p className={styles.sub}>Welcome back, <strong>{session.username}</strong> — here's your system overview</p>
        </div>
      </div>

      <div className={styles.statsGrid}>
        <StatCard icon="📋" label="Total Exams" value={mockExams.length} color="primary" />
        <StatCard icon="✅" label="Active Exams" value={activeExams} color="success" />
        <StatCard icon="👥" label="Total Attempts" value={mockResults.length} color="secondary" />
        <StatCard icon="📈" label="Avg Score" value={`${avgScore}%`} color="warning" />
        <StatCard icon="🏆" label="Pass Rate" value={`${((passCount / mockResults.length) * 100).toFixed(0)}%`} color="success" />
      </div>

      <div className={styles.chartsRow}>
        <div className={styles.chartCard}>
          <h3 className={styles.chartTitle}>Student Scores</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
              <Tooltip formatter={v => `${v}%`} />
              <Bar dataKey="score" fill="#4f46e5" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
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
      </div>

      <div className={styles.quickActions}>
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
    </div>
  )
}
