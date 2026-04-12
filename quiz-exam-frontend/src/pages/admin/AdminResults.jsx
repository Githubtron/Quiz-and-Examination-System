import React, { useState, useEffect } from 'react'
import { results as resultsApi, triggerDownload } from '../../api/api'
import Badge from '../../components/Badge'
import styles from './AdminResults.module.css'

export default function AdminResults() {
  const [results, setResults] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')

  const load = () => {
    setLoading(true)
    resultsApi.all()
      .then(data => setResults(data || []))
      .catch(e => setMsg(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const filtered = results.filter(r =>
    !search ||
    String(r.attemptId).includes(search) ||
    String(r.id).includes(search)
  )

  const passCount = filtered.filter(r => r.percentage >= 50).length
  const failCount = filtered.length - passCount
  const avg = filtered.length
    ? (filtered.reduce((s, r) => s + r.percentage, 0) / filtered.length).toFixed(1)
    : 0

  const handleExportCSV = () => {
    const rows = [['ResultId', 'AttemptId', 'TotalScore', 'MaxScore', 'Percentage', 'Status']]
    filtered.forEach(r => rows.push([r.id, r.attemptId, r.totalScore, r.maxScore, r.percentage?.toFixed(1) + '%', r.percentage >= 50 ? 'PASS' : 'FAIL']))
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    triggerDownload(new Blob([csv], { type: 'text/csv' }), 'all-results.csv')
  }

  if (loading) return <div className={styles.page}><p>Loading results…</p></div>

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>All Results</h1>
          <p className={styles.sub}>
            {filtered.length} submissions &nbsp;·&nbsp; Avg: <strong>{avg}%</strong>
            &nbsp;·&nbsp; <span className={styles.passText}>✓ {passCount} passed</span>
            &nbsp;·&nbsp; <span className={styles.failText}>✗ {failCount} failed</span>
          </p>
        </div>
        <div className={styles.actions}>
          <button className={styles.refreshBtn} onClick={load}>↻ Refresh</button>
          <button className={styles.exportBtn} onClick={handleExportCSV}>⬇ Export CSV</button>
        </div>
      </div>

      {msg && <div className={styles.msg} onClick={() => setMsg('')}>{msg}</div>}

      <div className={styles.statsRow}>
        {[
          { label: 'Total Submissions', value: results.length, color: 'var(--primary)' },
          { label: 'Average Score', value: `${avg}%`, color: 'var(--primary)' },
          { label: 'Pass Rate', value: filtered.length ? `${Math.round((passCount / filtered.length) * 100)}%` : '—', color: 'var(--success)' },
          { label: 'Passed', value: passCount, color: 'var(--success)' },
          { label: 'Failed', value: failCount, color: 'var(--danger)' },
        ].map(s => (
          <div key={s.label} className={styles.statCard}>
            <span className={styles.statLabel}>{s.label}</span>
            <span className={styles.statValue} style={{ color: s.color }}>{s.value}</span>
          </div>
        ))}
      </div>

      <div className={styles.toolbar}>
        <input className={styles.search} placeholder="Search by result or attempt ID…"
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr><th>Result ID</th><th>Attempt ID</th><th>Score</th><th>Max</th><th>Percentage</th><th>Status</th></tr>
          </thead>
          <tbody>
            {filtered.length === 0
              ? <tr><td colSpan={6} className={styles.empty}>No results found.</td></tr>
              : filtered.map(r => (
                <tr key={r.id}>
                  <td>#{r.id}</td>
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
