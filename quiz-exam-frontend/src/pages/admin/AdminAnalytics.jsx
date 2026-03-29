import React from 'react'
import { mockResults, mockExams } from '../../api/mockData'
import StatCard from '../../components/StatCard'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts'
import styles from './AdminAnalytics.module.css'

const COLORS = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b']

export default function AdminAnalytics() {
  const scores = mockResults.map(r => r.percentage)
  const avg = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
  const highest = Math.max(...scores)
  const lowest = Math.min(...scores)
  const sorted = [...scores].sort((a, b) => a - b)
  const median = sorted.length % 2 === 0
    ? ((sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2).toFixed(1)
    : sorted[Math.floor(sorted.length / 2)].toFixed(1)

  const barData = mockResults.map(r => ({ name: r.studentName, score: r.percentage }))
  const lineData = mockResults.map((r, i) => ({ exam: `Exam ${i + 1}`, score: r.percentage }))
  const pieData = [
    { name: '81-100%', value: scores.filter(s => s > 80).length },
    { name: '61-80%', value: scores.filter(s => s > 60 && s <= 80).length },
    { name: '41-60%', value: scores.filter(s => s > 40 && s <= 60).length },
    { name: '0-40%', value: scores.filter(s => s <= 40).length },
  ].filter(d => d.value > 0)

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Analytics Dashboard</h1>
      <p className={styles.sub}>System-wide performance overview</p>

      <div className={styles.statsGrid}>
        <StatCard icon="📈" label="Average Score" value={`${avg}%`} color="primary" />
        <StatCard icon="🏆" label="Highest Score" value={`${highest}%`} color="success" />
        <StatCard icon="📉" label="Lowest Score" value={`${lowest}%`} color="danger" />
        <StatCard icon="📊" label="Median Score" value={`${median}%`} color="warning" />
      </div>

      <div className={styles.chartsGrid}>
        <div className={styles.chartCard}>
          <h3 className={styles.chartTitle}>Score by Student</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={barData}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip formatter={v => `${v}%`} />
              <Bar dataKey="score" fill="#4f46e5" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className={styles.chartCard}>
          <h3 className={styles.chartTitle}>Score Distribution</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className={`${styles.chartCard} ${styles.wide}`}>
          <h3 className={styles.chartTitle}>Score Trend</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={lineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="exam" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip formatter={v => `${v}%`} />
              <Line type="monotone" dataKey="score" stroke="#4f46e5" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
