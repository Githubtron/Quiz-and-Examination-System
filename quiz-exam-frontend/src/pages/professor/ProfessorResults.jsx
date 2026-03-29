import { useState, useEffect } from 'react'
import { mockResults } from '../../api/mockData'
import Badge from '../../components/Badge'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import styles from './ProfessorResults.module.css'

export default function ProfessorResults() {
  const [search, setSearch] = useState('')
  const [examFilter, setExamFilter] = useState('all')
  const [results, setResults] = useState([...mockResults])
  useEffect(() => { setResults([...mockResults]) }, [])

  // Unique exam titles for filter dropdown
  const examTitles = [...new Set(results.map(r => r.examTitle).filter(Boolean))]

  const filtered = results.filter(r => {
    if (search && !r.studentName.toLowerCase().includes(search.toLowerCase())) return false
    if (examFilter !== 'all' && r.examTitle !== examFilter) return false
    return true
  })

  const avg = filtered.length
    ? (filtered.reduce((s, r) => s + r.percentage, 0) / filtered.length).toFixed(1)
    : 0
  const passCount = filtered.filter(r => r.percentage >= 50).length
  const failCount = filtered.length - passCount
  const highest = filtered.length ? Math.max(...filtered.map(r => r.percentage)) : 0
  const lowest = filtered.length ? Math.min(...filtered.map(r => r.percentage)) : 0

  const barData = filtered.map(r => ({ name: r.studentName, score: r.percentage }))

  const handleDownloadPDF = () => {
    const printContent = `
      <html><head><title>Results Report</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 2rem; color: #0f172a; }
        h1 { font-size: 1.4rem; margin-bottom: 0.25rem; }
        .meta { color: #64748b; font-size: 0.85rem; margin-bottom: 1.5rem; }
        .stats { display: flex; gap: 1.5rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
        .stat { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.75rem 1.25rem; min-width: 120px; }
        .stat-label { font-size: 0.75rem; color: #64748b; text-transform: uppercase; letter-spacing: .05em; }
        .stat-value { font-size: 1.4rem; font-weight: 800; color: #0f172a; }
        .stat-value.pass { color: #10b981; }
        .stat-value.fail { color: #ef4444; }
        table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
        th { background: #4f46e5; color: #fff; padding: 0.6rem 0.75rem; text-align: left; }
        td { padding: 0.6rem 0.75rem; border-bottom: 1px solid #e2e8f0; }
        tr:nth-child(even) td { background: #f8fafc; }
        .pass { color: #10b981; font-weight: 700; }
        .fail { color: #ef4444; font-weight: 700; }
        .footer { margin-top: 2rem; font-size: 0.75rem; color: #94a3b8; text-align: right; }
      </style></head><body>
      <h1>Results &amp; Analytics Report${examFilter !== 'all' ? ` — ${examFilter}` : ''}</h1>
      <p class="meta">Generated: ${new Date().toLocaleString()}</p>
      <div class="stats">
        <div class="stat"><div class="stat-label">Total</div><div class="stat-value">${filtered.length}</div></div>
        <div class="stat"><div class="stat-label">Avg Score</div><div class="stat-value">${avg}%</div></div>
        <div class="stat"><div class="stat-label">Pass</div><div class="stat-value pass">${passCount}</div></div>
        <div class="stat"><div class="stat-label">Fail</div><div class="stat-value fail">${failCount}</div></div>
        <div class="stat"><div class="stat-label">Highest</div><div class="stat-value">${highest}%</div></div>
        <div class="stat"><div class="stat-label">Lowest</div><div class="stat-value">${lowest}%</div></div>
      </div>
      <table>
        <thead><tr><th>Student</th><th>Exam</th><th>Score</th><th>Max</th><th>Percentage</th><th>Status</th><th>Submitted</th></tr></thead>
        <tbody>
          ${filtered.map(r => `<tr>
            <td>${r.studentName}</td>
            <td>${r.examTitle || '-'}</td>
            <td>${r.totalScore}</td>
            <td>${r.maxScore}</td>
            <td>${r.percentage}%</td>
            <td class="${r.percentage >= 50 ? 'pass' : 'fail'}">${r.percentage >= 50 ? 'PASS' : 'FAIL'}</td>
            <td>${new Date(r.submittedAt).toLocaleString()}</td>
          </tr>`).join('')}
        </tbody>
      </table>
      <div class="footer">QuizMaster — Online Exam System</div>
      </body></html>
    `
    const win = window.open('', '_blank')
    win.document.write(printContent)
    win.document.close()
    win.focus()
    win.print()
    win.close()
  }

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
    const a = document.createElement('a'); a.href = url; a.download = 'results.csv'; a.click()
    URL.revokeObjectURL(url)
  }

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
          <button className={styles.refreshBtn} onClick={() => setResults([...mockResults])}>↻ Refresh</button>
          <button className={styles.exportBtn} onClick={handleExportCSV}>⬇ Export CSV</button>
          <button className={styles.pdfBtn} onClick={handleDownloadPDF}>🖨 Download PDF</button>
        </div>
      </div>

      <div className={styles.statsRow}>
        {[
          { label: 'Total Submissions', value: filtered.length, color: 'var(--primary)' },
          { label: 'Average Score', value: `${avg}%`, color: 'var(--primary)' },
          { label: 'Pass Rate', value: filtered.length ? `${Math.round((passCount / filtered.length) * 100)}%` : '—', color: 'var(--success)' },
          { label: 'Highest Score', value: `${highest}%`, color: 'var(--success)' },
          { label: 'Lowest Score', value: `${lowest}%`, color: 'var(--danger)' },
        ].map(s => (
          <div key={s.label} className={styles.statCard}>
            <span className={styles.statLabel}>{s.label}</span>
            <span className={styles.statValue} style={{ color: s.color }}>{s.value}</span>
          </div>
        ))}
      </div>

      <div className={styles.chartCard}>
        <h3 className={styles.chartTitle}>Score Overview</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={barData}>
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
            <Tooltip formatter={v => `${v}%`} />
            <Bar dataKey="score" fill="#4f46e5" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className={styles.toolbar}>
        <input className={styles.search} placeholder="Search student…"
          value={search} onChange={e => setSearch(e.target.value)} />
        <select className={styles.filter} value={examFilter} onChange={e => setExamFilter(e.target.value)}>
          <option value="all">All Exams</option>
          {examTitles.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
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
