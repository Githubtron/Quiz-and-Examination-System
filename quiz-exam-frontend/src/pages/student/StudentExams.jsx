import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { exams as examsApi } from '../../api/api'
import Badge from '../../components/Badge'
import styles from './StudentExams.module.css'

export default function StudentExams() {
  const [allExams, setAllExams] = useState([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    examsApi.list()
      .then(data => setAllExams(data || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const exams = allExams.filter(e => {
    if (filter !== 'ALL' && e.status !== filter) return false
    if (search && !e.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  if (loading) return <div className={styles.page}><p>Loading exams…</p></div>

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Available Exams</h1>
          <p className={styles.sub}>Browse and attempt exams assigned to you</p>
        </div>
      </div>

      {error && <p style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{error}</p>}

      <div className={styles.toolbar}>
        <input
          className={styles.search}
          placeholder="Search exams…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className={styles.filters}>
          {['ALL', 'ACTIVE', 'DRAFT'].map(f => (
            <button
              key={f}
              className={`${styles.filterBtn} ${filter === f ? styles.active : ''}`}
              onClick={() => setFilter(f)}
            >{f}</button>
          ))}
        </div>
      </div>

      {exams.length === 0 ? (
        <div className={styles.empty}><p>🔍 No exams found matching your criteria.</p></div>
      ) : (
        <div className={styles.grid}>
          {exams.map(exam => (
            <div key={exam.id} className={styles.card}>
              <div className={styles.cardTop}>
                <Badge variant={exam.status === 'ACTIVE' ? 'success' : 'warning'}>{exam.status}</Badge>
                <span className={styles.timer}>⏱ {exam.timeLimitMinutes} min</span>
              </div>
              <h3 className={styles.examTitle}>{exam.title}</h3>
              <p className={styles.examDesc}>{exam.description}</p>
              <div className={styles.meta}>
                <span>📋 {exam.totalQuestions ?? '?'} questions</span>
                <span>⭐ {exam.marksPerQuestion} marks each</span>
                {exam.negativeMarking > 0 && <span>➖ -{exam.negativeMarking} negative</span>}
              </div>
              {exam.startDatetime && (
                <p className={styles.dates}>
                  📅 {new Date(exam.startDatetime).toLocaleDateString()} – {new Date(exam.endDatetime).toLocaleDateString()}
                </p>
              )}
              <div className={styles.cardFooter}>
                {exam.status === 'ACTIVE' ? (
                  <Link to={`/student/exam/${exam.id}`} className={styles.startBtn}>Start Exam →</Link>
                ) : (
                  <span className={styles.unavailable}>Not available yet</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
