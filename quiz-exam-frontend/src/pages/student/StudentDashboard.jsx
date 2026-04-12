import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { exams as examsApi, results as resultsApi, notifications as notifApi, analytics } from '../../api/api'
import StatCard from '../../components/StatCard'
import Badge from '../../components/Badge'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import styles from './StudentDashboard.module.css'

export default function StudentDashboard() {
  const { session } = useAuth()
  const [activeExams, setActiveExams] = useState([])
  const [myResults, setMyResults] = useState([])
  const [notifs, setNotifs] = useState([])
  const [trendData, setTrendData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      examsApi.listActive(),
      resultsApi.my(),
      notifApi.list(),
    ]).then(([exs, res, ns]) => {
      setActiveExams(exs || [])
      setMyResults(res || [])
      setNotifs(ns || [])
      // Build trend from student progress
      if (session?.userId) {
        analytics.studentProgress(session.userId)
          .then(prog => setTrendData((prog || []).map((p, i) => ({ name: `Exam ${i + 1}`, score: p.percentage }))))
          .catch(() => {})
      }
    }).catch(() => {}).finally(() => setLoading(false))
  }, [session?.userId])

  const unread = notifs.filter(n => !n.read)
  const avg = myResults.length
    ? (myResults.reduce((s, r) => s + r.percentage, 0) / myResults.length).toFixed(1)
    : 0

  const handleMarkRead = async (id) => {
    await notifApi.markRead(id)
    setNotifs(ns => ns.map(n => n.id === id ? { ...n, read: true } : n))
  }

  if (loading) return <div className={styles.page}><p>Loading…</p></div>

  return (
    <div className={styles.page}>
      <div className={styles.welcome}>
        <div>
          <h1 className={styles.title}>Welcome back, {session?.username} 👋</h1>
          <p className={styles.sub}>Here's your learning overview</p>
        </div>
        <Link to="/student/exams" className={styles.startBtn}>Browse Exams →</Link>
      </div>

      <div className={styles.stats}>
        <StatCard icon="📝" label="Available Exams" value={activeExams.length} color="primary" />
        <StatCard icon="✅" label="Completed" value={myResults.length} color="success" />
        <StatCard icon="📊" label="Avg Score" value={`${avg}%`} color="warning" />
        <StatCard icon="🔔" label="Notifications" value={unread.length} color="danger" />
      </div>

      <div className={styles.grid}>
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Performance Trend</h3>
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={trendData}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={v => `${v}%`} />
                <Line type="monotone" dataKey="score" stroke="#6c63ff" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className={styles.empty}>No results yet. Take an exam to see your trend.</p>
          )}
        </div>

        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Notifications</h3>
          {notifs.length === 0 ? (
            <p className={styles.empty}>No notifications.</p>
          ) : (
            <ul className={styles.notifList}>
              {notifs.map(n => (
                <li key={n.id} className={`${styles.notifItem} ${!n.read ? styles.unread : ''}`}
                  onClick={() => !n.read && handleMarkRead(n.id)} style={{ cursor: !n.read ? 'pointer' : 'default' }}>
                  <span className={styles.notifDot}>{!n.read ? '🔵' : '⚪'}</span>
                  <div>
                    <p className={styles.notifMsg}>{n.message}</p>
                    <p className={styles.notifTime}>{n.createdAt}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>Available Exams</h3>
          <Link to="/student/exams" className={styles.viewAll}>View all →</Link>
        </div>
        <div className={styles.examList}>
          {activeExams.slice(0, 5).map(exam => (
            <div key={exam.id} className={styles.examRow}>
              <div className={styles.examInfo}>
                <p className={styles.examName}>{exam.title}</p>
                <p className={styles.examMeta}>⏱ {exam.timeLimitMinutes} min &nbsp;|&nbsp; {exam.totalQuestions ?? '?'} questions</p>
              </div>
              <div className={styles.examActions}>
                <Badge variant="success">ACTIVE</Badge>
                <Link to={`/student/exam/${exam.id}`} className={styles.attemptBtn}>Start Exam</Link>
              </div>
            </div>
          ))}
          {activeExams.length === 0 && <p className={styles.empty}>No active exams right now.</p>}
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>Recent Results</h3>
          <Link to="/student/results" className={styles.viewAll}>View all →</Link>
        </div>
        {myResults.length === 0 ? (
          <p className={styles.empty}>No results yet.</p>
        ) : (
          <table className={styles.table}>
            <thead><tr><th>Attempt</th><th>Score</th><th>Percentage</th><th>Status</th></tr></thead>
            <tbody>
              {myResults.slice(0, 5).map(r => (
                <tr key={r.id}>
                  <td>Attempt #{r.attemptId}</td>
                  <td>{r.totalScore}/{r.maxScore}</td>
                  <td>{r.percentage?.toFixed(1)}%</td>
                  <td><Badge variant={r.percentage >= 50 ? 'success' : 'danger'}>{r.percentage >= 50 ? 'PASS' : 'FAIL'}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
