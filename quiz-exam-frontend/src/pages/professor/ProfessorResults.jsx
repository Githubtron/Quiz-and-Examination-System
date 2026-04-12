import React, { useState, useEffect } from 'react'
import { exams as examsApi, results as resultsApi, triggerDownload } from '../../api/api'
import Badge from '../../components/Badge'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import styles from './ProfessorResults.module.css'

export default function ProfessorResults() {
  const [allExams, setAllExams] = useState([])
  const [examFilter, setExamFilter] = useState('all')
  const [results, setResults] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    examsApi.list()
      .then(data => setAllExams(data || []))
      .catch(e => setMsg(e.message))
  }, [])

  useEffect(() => {
    if (examFilter === 'all') {
      resultsApi.all()
        .then(data => setResults(data || []))
        .catch(e => setMsg(e.message))
        .finally(() => setLoading(false))
    } else {
      resultsApi.byExam(examFilter)
        .then(data => setResults(data || []))
        .catch(e => setMsg(e.message))
        .finally(() => setLoading(false))
    }
  }, [examFilter])

  const filtered = results.filter(r =>
    !search || String(r.attemptId).includes(search)
  )

  const avg = filtered.length
    ? (filtered.reduce((s, r) => s + r.percentage, 0) / filtered.length).toFixed(1)
    : 0
  const passCount = filtered.filter(r => r.percentage >= 50).length
  const failCount = filtered.length - passCount
  const highest = filtered.length ? Math.max(...filtered.map(r => r.percentage)) : 0
  const lowest = filtered.length ? Math.min(...filtered.map(r => r.percentage)) : 0

  const barData = filtered.map(r => ({ name: `#${r.attemptId}`, score: r.percentage }))

  const handleExportCSV = async () => {
    if (examFilter === 'all') {
      const rows = [['AttemptId', 'TotalScore', 'MaxScore', 'Percentage', 'Status']]
      filtered.forEach(r => rows.push([r.attemptId, r.totalScore, r.maxScore, r.percentage?.toFixed(1) + '%', r.percentage >= 50 ? 'PASS' : 'FAIL']))
      const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
      triggerDownload(new Blob([csv], { type: 'text/csv' }), 'results.csv')
    } else {
      try {
        const blob = await resultsApi.exportCsv(examFilter)
        triggerDownload(blob, `results-exam-${examFilter}.csv`)
      } catch (e) { setMsg(e.message) }
    }
  }

  const handleExportPDF = async () => {
    if (examFilter === 'all') {
      setMsg('Select a specific exam to export PDF.')
      return
    }
    try {
      const blob = await resultsApi.exportPdf(examFilter)
      triggerDownload(blob, `results-exam-${examFilter}.pdf`)
    } catch (e) { setMsg(e.message) }
  }

  if (loading) return <div className={styles.page}><p>Loading results…</p></div>

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Results &amp; Analytics</h1>
          <p className={styles.sub}>
            {filtered.length} submissions &nbsp;·&nbsp; Avg: <strong>{avg}%</strong>
            &nbsp;·&nbsp; <span className={styles.passText}>✓ {passCount} passed</span>
            &nbsp;·&nbsp; <span className={styles.failText}>✗ {failCount} failed</span>
          </p>
        </div>
        <div className={styles.actions}>
          <button className={styles.exportBtn} onClick={handleExportCSV}>⬇ CSV</button>
          <button className={styles.pdfBtn} onClick={handleExportPDF}>🖨 PDF</button>
        </div>
      </div>

      {msg && <div className={styles.msg} onClick={() => setMsg('')}>{msg}</div>}

      <div className={styles.statsRow}>
        {[
          { label: 'Total', value: filtered.length, color: 'var(--primary)' },
          { label: 'Average', value: `${avg}%`, color: 'var(--primary)' },
          { label: 'Pass Rate', value: filtered.length ? `${Math.round((passCount / filtered.length) * 100)}%` : '—', color: 'var(--success)' },
          { label: 'Highest', value: `${highest?.toFixed(1)}%`, color: 'var(--success)' },
          { label: 'Lowest', value: `${lowest?.toFixed(1)}%`, color: 'var(--danger)' },
        ].map(s => (
          <div key={s.label} className={styles.statCard}>
            <span className={styles.statLabel}>{s.label}</span>
            <span className={styles.statValue} style={{ color: s.color }}>{s.value}</span>
          </div>
        ))}
      </div>

      {barData.length > 0 && (
        <div className={styles.chartCard}>
          <h3 className={styles.chartTitle}>Score Overview</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip formatter={v => `${v?.toFixed(1)}%`} />
              <Bar dataKey="score" fill="#6c63ff" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className={styles.toolbar}>
        <input className={styles.search} placeholder="Search by attempt ID…"
          value={search} onChange={e => setSearch(e.target.value)} />
        <select className={styles.filter} value={examFilter} onChange={e => setExamFilter(e.target.value)}>
          <option value="all">All Exams</option>
          {allExams.map(ex => <option key={ex.id} value={ex.id}>{ex.title}</option>)}
        </select>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr><th>Attempt ID</th><th>Score</th><th>Max</th><th>Percentage</th><th>Status</th></tr>
          </thead>
          <tbody>
            {filtered.length === 0
              ? <tr><td colSpan={5} className={styles.empty}>No results found.</td></tr>
              : filtered.map(r => (
                <tr key={r.id}>
                  <td>#{r.attemptId}</td>
                  <td>{r.totalScore}</td>
                  <td>{r.maxScore}</td>
                  <td>
                    <div className={styles.pctBar}>
                      <div className={styles.pctFill} style={{ width: `${r.percentage}%`, background: r.percentage >= 50 ? 'var(--success)' : 'var(--danger)' }} />
                      <span>{r.percentage?.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td><Badge variant={r.percentage >= 50 ? 'success' : 'danger'}>{r.percentage >= 50 ? 'PASS' : 'FAIL'}</Badge></td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    </div>
  )
}
