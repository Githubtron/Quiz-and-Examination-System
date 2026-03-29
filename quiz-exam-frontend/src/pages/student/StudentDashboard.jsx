import React from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { mockExams, mockResults, mockNotifications } from '../../api/mockData'
import StatCard from '../../components/StatCard'
import Badge from '../../components/Badge'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import styles from './StudentDashboard.module.css'

export default function StudentDashboard() {
  const { session } = useAuth()

  const availableExams = mockExams.filter(e => e.status === 'ACTIVE')
  const myResults = mockResults.slice(0, 3)
  const unread = mockNotifications.filter(n => !n.isRead)

  const trendData = myResults.map(r => ({ name: r.studentName, score: r.percentage }))
  const avg = myResults.length
    ? (myResults.reduce((s, r) => s + r.percentage, 0) / myResults.length).toFixed(1)
    : 0

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
        <StatCard icon="📝" label="Available Exams" value={availableExams.length} color="primary" />
        <StatCard icon="✅" label="Completed" value={myResults.length} color="success" />
        <StatCard icon="📊" label="Avg Score" value={`${avg}%`} color="warning" />
        <StatCard icon="🔔" label="Notifications" value={unread.length} color="danger" />
      </div>

      <div className={styles.grid}>
        {/* Performance trend */}
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Performance Trend</h3>
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={trendData}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={v => `${v}%`} />
                <Line type="monotone" dataKey="score" stroke="#4f46e5" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className={styles.empty}>No results yet. Take an exam to see your trend.</p>
          )}
        </div>

        {/* Notifications */}
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Notifications</h3>
          {mockNotifications.length === 0 ? (
            <p className={styles.empty}>No notifications.</p>
          ) : (
            <ul className={styles.notifList}>
              {mockNotifications.map(n => (
                <li key={n.id} className={`${styles.notifItem} ${!n.isRead ? styles.unread : ''}`}>
                  <span className={styles.notifDot}>{!n.isRead ? '🔵' : '⚪'}</span>
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

      {/* Upcoming exams */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>Available Exams</h3>
          <Link to="/student/exams" className={styles.viewAll}>View all →</Link>
        </div>
        <div className={styles.examList}>
          {availableExams.map(exam => (
            <div key={exam.id} className={styles.examRow}>
              <div className={styles.examInfo}>
                <p className={styles.examName}>{exam.title}</p>
                <p className={styles.examMeta}>⏱ {exam.timeLimitMinutes} min &nbsp;|&nbsp; {exam.totalQuestions} questions</p>
              </div>
              <div className={styles.examActions}>
                <Badge variant="success">ACTIVE</Badge>
                <Link to={`/student/exam/${exam.id}`} className={styles.attemptBtn}>Start Exam</Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent results */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>Recent Results</h3>
          <Link to="/student/results" className={styles.viewAll}>View all →</Link>
        </div>
        {myResults.length === 0 ? (
          <p className={styles.empty}>No results yet.</p>
        ) : (
          <table className={styles.table}>
            <thead><tr><th>Exam</th><th>Score</th><th>Percentage</th><th>Status</th></tr></thead>
            <tbody>
              {myResults.map(r => (
                <tr key={r.id}>
                  <td>{r.studentName}</td>
                  <td>{r.totalScore}/{r.maxScore}</td>
                  <td>{r.percentage}%</td>
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
