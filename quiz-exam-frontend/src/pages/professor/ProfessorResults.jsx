import React, { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine, Cell,
  PieChart, Pie, Legend,
  LineChart, Line,
} from 'recharts'
import { exams as examsApi, results as resultsApi, triggerDownload } from '../../api/api'
import Badge from '../../components/Badge'
import styles from './ProfessorResults.module.css'

const tooltipStyle = {
  background: '#1e293b',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  fontSize: 12,
}

const PF_COLORS   = ['#6c63ff', '#ef4444']
const DIST_COLORS = ['#ef4444', '#f59e0b', '#10b981', '#6c63ff', '#a855f7']

function buildAnalytics(list) {
  const total    = list.length
  const avg      = total ? list.reduce((s, r) => s + (r.percentage || 0), 0) / total : 0
  const pass     = list.filter(r => r.percentage >= 50).length
  const fail     = total - pass
  const highest  = total ? Math.max(...list.map(r => r.percentage || 0)) : 0
  const lowest   = total ? Math.min(...list.map(r => r.percentage || 0)) : 0
  const passRate = total ? (pass / total) * 100 : 0

  /* score distribution buckets */
  const buckets = [
    { name: '0–20%',   value: 0 },
    { name: '21–40%',  value: 0 },
    { name: '41–60%',  value: 0 },
    { name: '61–80%',  value: 0 },
    { name: '81–100%', value: 0 },
  ]
  list.forEach(r => {
    const p = r.percentage || 0
    if (p <= 20)       buckets[0].value++
    else if (p <= 40)  buckets[1].value++
    else if (p <= 60)  buckets[2].value++
    else if (p <= 80)  buckets[3].value++
    else               buckets[4].value++
  })

  /* per-attempt bars */
  const barData = list.map(r => ({
    name:  `#${r.attemptId}`,
    score: +(r.percentage || 0).toFixed(1),
  }))

  return {
    total, avg, pass, fail, highest, lowest, passRate,
    barData, buckets,
    passFail: [
      { name: 'Pass', value: pass },
      { name: 'Fail', value: fail },
    ],
  }
}

export default function ProfessorResults() {
  const [searchParams] = useSearchParams()
  const [allExams,    setAllExams]    = useState([])
  const [examFilter,  setExamFilter]  = useState(searchParams.get('exam') || 'all')
  const [results,     setResults]     = useState([])
  const [search,      setSearch]      = useState('')
  const [loading,     setLoading]     = useState(true)
  const [msg,         setMsg]         = useState('')
  const [pdfBusy,     setPdfBusy]     = useState(false)
  const reportRef = useRef(null)

  useEffect(() => {
    examsApi.list()
      .then(data => setAllExams(data || []))
      .catch(e => setMsg(e.message))
  }, [])

  useEffect(() => {
    setLoading(true)
    if (examFilter === 'all') {
      /* results.all() is admin-only — fetch per-exam in parallel instead */
      examsApi.list()
        .then(list =>
          Promise.all(
            (list || []).map(e =>
              resultsApi.byExam(e.id).catch(() => [])
            )
          )
        )
        .then(arrays => setResults(arrays.flat()))
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

  const a = buildAnalytics(filtered)

  /* ── CSV export ─────────────────────────────────────────────────────────── */
  const handleExportCSV = async () => {
    if (examFilter === 'all') {
      const rows = [['AttemptId', 'TotalScore', 'MaxScore', 'Percentage', 'Status']]
      filtered.forEach(r => rows.push([
        r.attemptId, r.totalScore, r.maxScore,
        (r.percentage || 0).toFixed(1) + '%',
        r.percentage >= 50 ? 'PASS' : 'FAIL',
      ]))
      const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
      triggerDownload(new Blob([csv], { type: 'text/csv' }), 'results.csv')
    } else {
      try {
        const blob = await resultsApi.exportCsv(examFilter)
        triggerDownload(blob, `results-exam-${examFilter}.csv`)
      } catch (e) { setMsg(e.message) }
    }
  }

  /* ── PDF report (frontend charts) ──────────────────────────────────────── */
  const handleDownloadPdf = async () => {
    if (!reportRef.current) return
    setPdfBusy(true)
    setMsg('')
    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import('jspdf'),
        import('html2canvas'),
      ])

      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#0f0f23',
        logging: false,
      })
      const imgData = canvas.toDataURL('image/png')
      const pdf     = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pdfW    = pdf.internal.pageSize.getWidth()
      const pdfH    = pdf.internal.pageSize.getHeight()

      /* dark background */
      pdf.setFillColor(15, 15, 35)
      pdf.rect(0, 0, pdfW, pdfH, 'F')

      /* accent bar */
      pdf.setFillColor(108, 99, 255)
      pdf.rect(0, 0, pdfW, 1.5, 'F')

      /* title */
      const examName = examFilter === 'all'
        ? 'All Exams'
        : (allExams.find(e => String(e.id) === String(examFilter))?.title || `Exam #${examFilter}`)

      pdf.setTextColor(180, 176, 255)
      pdf.setFontSize(17)
      pdf.setFont('helvetica', 'bold')
      pdf.text('QuizMaster — Results & Analytics', pdfW / 2, 13, { align: 'center' })

      pdf.setTextColor(100, 116, 139)
      pdf.setFontSize(9)
      pdf.setFont('helvetica', 'normal')
      pdf.text(`${examName}  ·  Generated ${new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })}`, pdfW / 2, 19, { align: 'center' })

      /* stat pills */
      const pills = [
        { label: 'Submissions', value: String(a.total)              },
        { label: 'Average',     value: `${a.avg.toFixed(1)}%`       },
        { label: 'Pass Rate',   value: `${a.passRate.toFixed(1)}%`  },
        { label: 'Highest',     value: `${a.highest.toFixed(1)}%`   },
        { label: 'Lowest',      value: `${a.lowest.toFixed(1)}%`    },
      ]
      const pillW = (pdfW - 10) / pills.length
      pills.forEach((p, i) => {
        const x = 5 + i * pillW
        pdf.setFillColor(30, 41, 59)
        pdf.roundedRect(x, 23, pillW - 2, 14, 2, 2, 'F')
        pdf.setTextColor(108, 99, 255)
        pdf.setFontSize(11)
        pdf.setFont('helvetica', 'bold')
        pdf.text(p.value, x + (pillW - 2) / 2, 31.5, { align: 'center' })
        pdf.setTextColor(100, 116, 139)
        pdf.setFontSize(6.5)
        pdf.setFont('helvetica', 'normal')
        pdf.text(p.label, x + (pillW - 2) / 2, 35.5, { align: 'center' })
      })

      /* chart image */
      const startY = 40
      const imgH   = (canvas.height * pdfW) / canvas.width
      const maxH   = pdfH - startY - 5
      if (imgH <= maxH) {
        pdf.addImage(imgData, 'PNG', 0, startY, pdfW, imgH)
      } else {
        const scale = maxH / imgH
        pdf.addImage(imgData, 'PNG', (pdfW - pdfW * scale) / 2, startY, pdfW * scale, maxH)
      }

      /* footer */
      pdf.setTextColor(55, 65, 81)
      pdf.setFontSize(7)
      pdf.text('QuizMaster Exam System', pdfW / 2, pdfH - 3, { align: 'center' })

      const slug = examFilter === 'all' ? 'all' : `exam-${examFilter}`
      pdf.save(`analytics-${slug}-${new Date().toISOString().slice(0, 10)}.pdf`)
      setMsg('PDF report downloaded!')
    } catch (e) {
      console.error(e)
      setMsg('PDF generation failed — please try again.')
    } finally {
      setPdfBusy(false)
    }
  }

  if (loading) return <div className={styles.page}><p>Loading results…</p></div>

  return (
    <div className={styles.page}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Results &amp; Analytics</h1>
          <p className={styles.sub}>
            {filtered.length} submissions &nbsp;·&nbsp; Avg: <strong>{a.avg.toFixed(1)}%</strong>
            &nbsp;·&nbsp; <span className={styles.passText}>✓ {a.pass} passed</span>
            &nbsp;·&nbsp; <span className={styles.failText}>✗ {a.fail} failed</span>
          </p>
        </div>
        <div className={styles.actions}>
          <button className={styles.exportBtn} onClick={handleExportCSV}>⬇ CSV</button>
          <button className={styles.pdfBtn} onClick={handleDownloadPdf} disabled={pdfBusy}>
            {pdfBusy ? '⏳ Generating…' : '📄 Download Report'}
          </button>
        </div>
      </div>

      {msg && <div className={styles.msg} onClick={() => setMsg('')}>{msg} <span style={{ float: 'right', opacity: 0.6 }}>✕</span></div>}

      {/* ── Analytics panel (captured for PDF) ──────────────────────────── */}
      {filtered.length > 0 && (
        <div ref={reportRef} className={styles.analytics}>

          {/* Stat cards */}
          <div className={styles.statsGrid}>
            {[
              { icon: '📋', label: 'Submissions', value: a.total,                      color: '#a5b4fc' },
              { icon: '📊', label: 'Average',     value: `${a.avg.toFixed(1)}%`,       color: '#a5b4fc' },
              { icon: '🏆', label: 'Pass Rate',   value: `${a.passRate.toFixed(1)}%`,  color: '#86efac' },
              { icon: '⬆',  label: 'Highest',     value: `${a.highest.toFixed(1)}%`,   color: '#86efac' },
              { icon: '⬇',  label: 'Lowest',      value: `${a.lowest.toFixed(1)}%`,    color: '#fca5a5' },
            ].map(s => (
              <div key={s.label} className={styles.statCard}>
                <span className={styles.statIcon}>{s.icon}</span>
                <span className={styles.statValue} style={{ color: s.color }}>{s.value}</span>
                <span className={styles.statLabel}>{s.label}</span>
              </div>
            ))}
          </div>

          {/* Charts grid */}
          <div className={styles.chartsGrid}>

            {/* Score overview bar — wide */}
            <div className={`${styles.chartCard} ${styles.span2}`}>
              <h3 className={styles.chartTitle}>Score Overview (per submission)</h3>
              <ResponsiveContainer width="100%" height={215}>
                <BarChart data={a.barData} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} tick={{ fill: '#94a3b8' }} />
                  <YAxis domain={[0, 100]} stroke="#64748b" fontSize={11} tick={{ fill: '#94a3b8' }} unit="%" />
                  <Tooltip formatter={v => [`${v}%`, 'Score']} contentStyle={tooltipStyle} />
                  <ReferenceLine y={50} stroke="#f59e0b" strokeDasharray="5 3"
                    label={{ value: 'Pass line', position: 'insideTopRight', fill: '#f59e0b', fontSize: 10 }} />
                  <Bar dataKey="score" radius={[5, 5, 0, 0]} maxBarSize={40}>
                    {a.barData.map((entry, i) => (
                      <Cell key={i} fill={entry.score >= 50 ? '#6c63ff' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Pass/Fail donut */}
            <div className={styles.chartCard}>
              <h3 className={styles.chartTitle}>Pass / Fail Split</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={a.passFail} cx="50%" cy="50%"
                    innerRadius={52} outerRadius={78} dataKey="value" paddingAngle={4}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}>
                    {a.passFail.map((_, i) => <Cell key={i} fill={PF_COLORS[i]} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [`${v}`, n]} contentStyle={tooltipStyle} />
                  <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Score distribution donut */}
            <div className={styles.chartCard}>
              <h3 className={styles.chartTitle}>Score Distribution</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={a.buckets} cx="50%" cy="50%"
                    innerRadius={45} outerRadius={75} dataKey="value" paddingAngle={3}
                    label={({ name, percent }) => percent > 0.04 ? `${(percent * 100).toFixed(0)}%` : ''}
                    labelLine={false}>
                    {a.buckets.map((_, i) => <Cell key={i} fill={DIST_COLORS[i]} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [`${v} students`, n]} contentStyle={tooltipStyle} />
                  <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

          </div>

          {/* Score trend line — only when >2 submissions */}
          {a.barData.length > 2 && (
            <div className={styles.chartCard}>
              <h3 className={styles.chartTitle}>Score Trend Across Submissions</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={a.barData} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} tick={{ fill: '#94a3b8' }} />
                  <YAxis domain={[0, 100]} stroke="#64748b" fontSize={11} tick={{ fill: '#94a3b8' }} unit="%" />
                  <Tooltip formatter={v => [`${v}%`, 'Score']} contentStyle={tooltipStyle} />
                  <ReferenceLine y={50} stroke="#f59e0b" strokeDasharray="5 3" />
                  <Line type="monotone" dataKey="score" stroke="#10b981" strokeWidth={2.5}
                    dot={{ r: 4, fill: '#10b981', strokeWidth: 0 }} activeDot={{ r: 7 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

        </div>
      )}

      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className={styles.toolbar}>
        <input className={styles.search} placeholder="Search by attempt ID…"
          value={search} onChange={e => setSearch(e.target.value)} />
        <select className={styles.filter} value={examFilter}
          onChange={e => setExamFilter(e.target.value)}>
          <option value="all">All Exams</option>
          {allExams.map(ex => <option key={ex.id} value={ex.id}>{ex.title}</option>)}
        </select>
      </div>

      {/* ── Results table ────────────────────────────────────────────────── */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Attempt ID</th>
              <th>Score</th>
              <th>Max</th>
              <th>Percentage</th>
              <th>Status</th>
            </tr>
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
                      <div className={styles.pctFill}
                        style={{ width: `${r.percentage}%`, background: r.percentage >= 50 ? 'var(--success)' : 'var(--danger)' }} />
                      <span>{(r.percentage || 0).toFixed(1)}%</span>
                    </div>
                  </td>
                  <td>
                    <Badge variant={r.percentage >= 50 ? 'success' : 'danger'}>
                      {r.percentage >= 50 ? 'PASS' : 'FAIL'}
                    </Badge>
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>

    </div>
  )
}
