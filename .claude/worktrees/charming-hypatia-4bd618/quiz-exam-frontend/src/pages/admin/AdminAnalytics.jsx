import React, { useState, useEffect } from 'react'
import { exams as examsApi, analytics } from '../../api/api'
import StatCard from '../../components/StatCard'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import styles from './AdminAnalytics.module.css'

const COLORS = ['#6c63ff', '#00bcd4', '#10b981', '#f59e0b', '#ef4444']

export default function AdminAnalytics() {
  const [allExams, setAllExams] = useState([])
  const [selectedExam, setSelectedExam] = useState('')
  const [stats, setStats] = useState(null)
  const [distribution, setDistribution] = useState({})
  const [hardest, setHardest] = useState([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    examsApi.list()
      .then(data => {
        setAllExams(data || [])
        if (data?.length > 0) setSelectedExam(String(data[0].id))
      })
      .catch(e => setMsg(e.message))
  }, [])

  useEffect(() => {
    if (!selectedExam) return
    setLoading(true)
    Promise.all([
      analytics.examStats(selectedExam),
      analytics.scoreDistribution(selectedExam),
      analytics.hardestQuestions(selectedExam, 5),
    ]).then(([s, dist, hard]) => {
      setStats(s)
      setDistribution(dist || {})
      setHardest(hard || [])
    }).catch(e => setMsg(e.message))
      .finally(() => setLoading(false))
  }, [selectedExam])

  const pieData = Object.entries(distribution).map(([name, value]) => ({ name, value: Number(value) })).filter(d => d.value > 0)
  const barData = hardest.map(q => ({ name: `Q${q.questionId}`, rate: q.incorrectRate?.toFixed(1) }))

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Analytics Dashboard</h1>
        <select value={selectedExam} onChange={e => setSelectedExam(e.target.value)} className={styles.examSelect}>
          {allExams.map(ex => <option key={ex.id} value={ex.id}>{ex.title}</option>)}
        </select>
      </div>

      {msg && <div className={styles.msg} onClick={() => setMsg('')}>{msg}</div>}

      {loading && <p>Loading analytics…</p>}

      {stats && (
        <div className={styles.statsGrid}>
          <StatCard icon="📈" label="Average Score" value={`${stats.averageScore?.toFixed(1)}%`} color="primary" />
          <StatCard icon="🏆" label="Highest Score" value={`${stats.highestScore?.toFixed(1)}%`} color="success" />
          <StatCard icon="📉" label="Lowest Score" value={`${stats.lowestScore?.toFixed(1)}%`} color="danger" />
          <StatCard icon="📊" label="Median Score" value={`${stats.medianScore?.toFixed(1)}%`} color="warning" />
          <StatCard icon="✅" label="Pass Rate" value={`${stats.passPercentage?.toFixed(1)}%`} color="success" />
          <StatCard icon="👥" label="Total Attempts" value={stats.totalAttempts} color="primary" />
        </div>
      )}

      <div className={styles.chartsGrid}>
        {pieData.length > 0 && (
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
        )}

        {barData.length > 0 && (
          <div className={styles.chartCard}>
            <h3 className={styles.chartTitle}>Hardest Questions (% incorrect)</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={barData}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={v => `${v}%`} />
                <Bar dataKey="rate" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {hardest.length > 0 && (
        <div className={styles.chartCard}>
          <h3 className={styles.chartTitle}>Hardest Questions Detail</h3>
          <table className={styles.table}>
            <thead><tr><th>Question</th><th>Total Answered</th><th>Incorrect</th><th>Incorrect Rate</th></tr></thead>
            <tbody>
              {hardest.map(q => (
                <tr key={q.questionId}>
                  <td>{q.questionText?.slice(0, 80)}{q.questionText?.length > 80 ? '…' : ''}</td>
                  <td>{q.totalAnswered}</td>
                  <td>{q.incorrectCount}</td>
                  <td>{q.incorrectRate?.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !stats && selectedExam && (
        <p className={styles.empty}>No data yet for this exam.</p>
      )}
    </div>
  )
}
