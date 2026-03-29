import { useState } from 'react'
import { mockResults } from '../../api/mockData'
import Badge from '../../components/Badge'
import styles from './AdminResults.module.css'

export default function AdminResults() {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([...mockResults])

  const filtered = results.filter(r =>
    r.studentName.toLowerCase().includes(search.toLowerCase()) ||
    (r.examTitle || '').toLowerCase().includes(search.toLowerCase())
  )

  const passCount = filtered.filter(r => r.percentage >= 50).length
  const failCount = filtered.length - passCount
  const avg = filtered.length
    ? (filtered.reduce((s, r) => s + r.percentage, 0) / filtered.length).toFixed(1)
    : 0

  const handleExportCSV = () => {
    const rows = [['Student', 'Exam', 'Score', 'Max', 'Percentage', 'Status', 'Submitted']]
    filtered.forEach(r => rows.push([
      r.studentName,
      r.examTitle || '',
      r.totalScore,
      r.maxScore,
      r.percentage + '%',
      r.percentage >= 50 ? 'PASS' : 'FAIL',
      new Date(r.submittedAt).toLocaleString()
    ]))
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'all-results.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const handleDownloadPDF = () => {
    const rows = filtered.map(r => `<tr>
      <td>${r.studentName}</td><td>${r.examTitle || '-'}</td>
      <td>${r.totalScore}</td><td>${r.maxScore}</td><td>${r.percentage}%</td>
      <td class="${r.percentage >= 50 ? 'pass' : 'fail'}">${r.percentage >= 50 ? 'PASS' : 'FAIL'}</td>
      <td>${new Date(r.submittedAt).toLocaleString()}</td>
    </tr>`).join('')
    const html = `<html><head><title>All Results</title><style>
      body{font-family:Arial,sans-serif;padding:2rem;color:#0f172a}
      h1{font-size:1.4rem;margin-bottom:.25rem}
      .meta{color:#64748b;font-size:.85rem;margin-bottom:1.5rem}
      .stats{display:flex;gap:1.5rem;margin-bottom:1.5rem;flex-wrap:wrap}
      .stat{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:.75rem 1.25rem}
      .stat-label{font-size:.72rem;color:#64748b;text-transform:uppercase;letter-spacing:.05em}
      .stat-value{font-size:1.4rem;font-weight:800;color:#0f172a}
      .pass-v{color:#10b981}.fail-v{color:#ef4444}
      table{width:100%;border-collapse:collapse;font-size:.85rem}
      th{background:#4f46e5;color:#fff;padding:.6rem .75rem;text-align:left}
      td{padding:.6rem .75rem;border-bottom:1px solid #e2e8f0}
      tr:nth-child(even) td{background:#f8fafc}
      .pass{color:#10b981;font-weight:700}.fail{color:#ef4444;font-weight:700}
      .footer{margin-top:2rem;font-size:.75rem;color:#94a3b8;text-align:right}
    </style></head><body>
    <h1>All Results Report</h1>
    <p class="meta">Generated: ${new Date().toLocaleString()}</p>
    <div class="stats">
      <div class="stat"><div class="stat-label">Total</div><div class="stat-value">${filtered.length}</div></div>
      <div class="stat"><div class="stat-label">Avg Score</div><div class="stat-value">${avg}%</div></div>
      <div class="stat"><div class="stat-label">Passed</div><div class="stat-value pass-v">${passCount}</div></div>
      <div class="stat"><div class="stat-label">Failed</div><div class="stat-value fail-v">${failCount}</div></div>
    </div>
    <table><thead><tr><th>Student</th><th>Exam</th><th>Score</th><th>Max</th><th>%</th><th>Status</th><th>Submitted</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <div class="footer">QuizMaster — Online Exam System</div>
    </body></html>`
    const win = window.open('', '_blank')
    win.document.write(html)
    win.document.close()
    win.focus(); win.print(); win.close()
  }

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
          <button className={styles.refreshBtn} onClick={() => setResults([...mockResults])}>↻ Refresh</button>
          <button className={styles.exportBtn} onClick={handleExportCSV}>⬇ Export CSV</button>
          <button className={styles.pdfBtn} onClick={handleDownloadPDF}>🖨 Download PDF</button>
        </div>
      </div>

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
        <input className={styles.search} placeholder="Search by student or exam…"
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr><th>Student</th><th>Exam</th><th>Score</th><th>Max</th><th>Percentage</th><th>Status</th><th>Submitted</th></tr>
          </thead>
          <tbody>
            {filtered.length === 0
              ? <tr><td colSpan={7} className={styles.empty}>No results found.</td></tr>
              : filtered.map(r => (
                <tr key={r.id}>
                  <td><strong>{r.studentName}</strong></td>
                  <td>{r.examTitle || '—'}</td>
                  <td>{r.totalScore}</td>
                  <td>{r.maxScore}</td>
                  <td>
                    <div className={styles.pctBar}>
                      <div className={styles.pctFill} style={{ width: `${r.percentage}%`, background: r.percentage >= 50 ? 'var(--success)' : 'var(--danger)' }} />
                      <span>{r.percentage}%</span>
                    </div>
                  </td>
                  <td><Badge variant={r.percentage >= 50 ? 'success' : 'danger'}>{r.percentage >= 50 ? 'PASS' : 'FAIL'}</Badge></td>
                  <td>{new Date(r.submittedAt).toLocaleString()}</td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    </div>
  )
}
