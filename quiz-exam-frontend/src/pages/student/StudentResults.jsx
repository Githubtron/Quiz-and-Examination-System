import React, { useState, useEffect, useRef } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, Legend,
  LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine,
  BarChart, Bar,
  ResponsiveContainer,
} from 'recharts'
import { results as resultsApi, triggerDownload } from '../../api/api'
import Badge from '../../components/Badge'
import Modal from '../../components/Modal'
import styles from './StudentResults.module.css'

const ACC_COLORS = ['#10b981', '#ef4444']
const PF_COLORS  = ['#6c63ff', '#f59e0b']

const tooltipStyle = {
  background: '#1e293b',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  fontSize: 12,
}

function buildAnalytics(list) {
  const total = list.length
  const avgScore = total > 0
    ? list.reduce((s, r) => s + (r.percentage || 0), 0) / total : 0
  const passCount = list.filter(r => r.percentage >= 50).length
  let totalCorrect = 0, totalWrong = 0
  list.forEach(r => {
    if (!r.detailJson) return
    try { JSON.parse(r.detailJson).forEach(q => q.isCorrect ? totalCorrect++ : totalWrong++) }
    catch {}
  })
  return {
    total, avgScore, passCount, failCount: total - passCount,
    passRate: total > 0 ? (passCount / total) * 100 : 0,
    totalCorrect, totalWrong,
    scoreTrend: list.map((r, i) => ({ name: `#${i + 1}`, score: +(r.percentage || 0).toFixed(1) })),
    examBars:   list.map(r => ({ name: `#${r.attemptId}`, score: +(r.percentage || 0).toFixed(1) })),
    correctWrong: [
      { name: 'Correct', value: totalCorrect },
      { name: 'Wrong',   value: totalWrong   },
    ],
    passFail: [
      { name: 'Pass', value: passCount },
      { name: 'Fail', value: total - passCount },
    ],
  }
}

function getBreakdownPie(result) {
  if (!result?.detailJson) return null
  try {
    const bd = JSON.parse(result.detailJson)
    const correct = bd.filter(q => q.isCorrect).length
    return [{ name: 'Correct', value: correct }, { name: 'Wrong', value: bd.length - correct }]
  } catch { return null }
}

export default function StudentResults() {
  const [myResults, setMyResults] = useState([])
  const [selected,  setSelected]  = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [notice,    setNotice]    = useState('')
  const [pdfBusy,   setPdfBusy]   = useState(false)
  const reportRef = useRef(null)

  useEffect(() => {
    resultsApi.my()
      .then(data => setMyResults(data || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const a = buildAnalytics(myResults)

  /* ── CSV ──────────────────────────────────────────────────────────────── */
  const handleExportCSV = () => {
    const rows = [['AttemptId', 'TotalScore', 'MaxScore', 'Percentage', 'Status']]
    myResults.forEach(r => rows.push([
      r.attemptId, r.totalScore, r.maxScore,
      (r.percentage || 0).toFixed(1) + '%',
      r.percentage >= 50 ? 'PASS' : 'FAIL',
    ]))
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    triggerDownload(new Blob([csv], { type: 'text/csv' }), 'my-results.csv')
  }

  /* ── Share ────────────────────────────────────────────────────────────── */
  const handleShare = async (result) => {
    if (!result) return
    const text = [
      'QuizMaster Result',
      `Attempt: #${result.attemptId}`,
      `Score: ${result.totalScore}/${result.maxScore}`,
      `Percentage: ${(result.percentage || 0).toFixed(1)}%`,
      `Status: ${result.percentage >= 50 ? 'PASS' : 'FAIL'}`,
    ].join('\n')
    try {
      if (navigator.share) await navigator.share({ title: 'QuizMaster Result', text })
      else if (navigator.clipboard) await navigator.clipboard.writeText(text)
      setNotice('Result summary copied/shared successfully.')
    } catch {
      setNotice('Unable to share right now.')
    }
  }

  /* ── PDF export ───────────────────────────────────────────────────────── */
  const handleDownloadPdf = async () => {
    if (!reportRef.current) return
    setPdfBusy(true)
    setNotice('')
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

      /* purple accent bar */
      pdf.setFillColor(108, 99, 255)
      pdf.rect(0, 0, pdfW, 1.5, 'F')

      /* title */
      pdf.setTextColor(180, 176, 255)
      pdf.setFontSize(18)
      pdf.setFont('helvetica', 'bold')
      pdf.text('QuizMaster — My Exam Report', pdfW / 2, 13, { align: 'center' })

      /* date */
      pdf.setTextColor(100, 116, 139)
      pdf.setFontSize(9)
      pdf.setFont('helvetica', 'normal')
      pdf.text(`Generated on ${new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })}`, pdfW / 2, 19, { align: 'center' })

      /* stat pills */
      const pills = [
        { label: 'Exams',     value: String(a.total) },
        { label: 'Avg Score', value: `${a.avgScore.toFixed(1)}%` },
        { label: 'Pass Rate', value: `${a.passRate.toFixed(1)}%` },
        { label: 'Correct',   value: String(a.totalCorrect) },
      ]
      const pillW = (pdfW - 10) / pills.length
      pills.forEach((p, i) => {
        const x = 5 + i * pillW
        pdf.setFillColor(30, 41, 59)
        pdf.roundedRect(x, 23, pillW - 2, 14, 2, 2, 'F')
        pdf.setTextColor(108, 99, 255)
        pdf.setFontSize(13)
        pdf.setFont('helvetica', 'bold')
        pdf.text(p.value, x + (pillW - 2) / 2, 32, { align: 'center' })
        pdf.setTextColor(100, 116, 139)
        pdf.setFontSize(7)
        pdf.setFont('helvetica', 'normal')
        pdf.text(p.label, x + (pillW - 2) / 2, 36, { align: 'center' })
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

      pdf.save(`exam-report-${new Date().toISOString().slice(0, 10)}.pdf`)
      setNotice('PDF report downloaded!')
    } catch (e) {
      console.error(e)
      setNotice('PDF generation failed — please try again.')
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
          <h1 className={styles.title}>My Results</h1>
          <p className={styles.sub}>{myResults.length} exam{myResults.length !== 1 ? 's' : ''} completed</p>
        </div>
        {myResults.length > 0 && (
          <div className={styles.headerActions}>
            <button className={styles.exportBtn} onClick={handleExportCSV}>⬇ CSV</button>
            <button className={styles.pdfBtn} onClick={handleDownloadPdf} disabled={pdfBusy}>
              {pdfBusy ? '⏳ Generating…' : '📄 Download Report'}
            </button>
            <button className={styles.shareBtn} onClick={() => handleShare(selected || myResults[0])}>🔗 Share</button>
          </div>
        )}
      </div>

      {error  && <p className={styles.err}>{error}</p>}
      {notice && <p className={styles.notice}>{notice}</p>}

      {/* ── Analytics (captured for PDF) ────────────────────────────────── */}
      {myResults.length > 0 && (
        <div ref={reportRef} className={styles.analytics}>

          {/* Stat cards */}
          <div className={styles.statsGrid}>
            {[
              { icon: '📚', value: a.total,                      label: 'Exams Taken'     },
              { icon: '📊', value: `${a.avgScore.toFixed(1)}%`,  label: 'Average Score'   },
              { icon: '🏆', value: `${a.passRate.toFixed(1)}%`,  label: 'Pass Rate'       },
              { icon: '🎯', value: a.totalCorrect,                label: 'Correct Answers' },
            ].map(s => (
              <div key={s.label} className={styles.statCard}>
                <span className={styles.statIcon}>{s.icon}</span>
                <span className={styles.statValue}>{s.value}</span>
                <span className={styles.statLabel}>{s.label}</span>
              </div>
            ))}
          </div>

          {/* Charts grid */}
          <div className={styles.chartsGrid}>

            {/* Score trend — spans 2 columns */}
            <div className={`${styles.chartCard} ${styles.span2}`}>
              <h3 className={styles.chartTitle}>Score Trend</h3>
              <ResponsiveContainer width="100%" height={210}>
                <LineChart data={a.scoreTrend} margin={{ top: 10, right: 24, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} tick={{ fill: '#94a3b8' }} />
                  <YAxis domain={[0, 100]} stroke="#64748b" fontSize={11} tick={{ fill: '#94a3b8' }} unit="%" />
                  <Tooltip formatter={v => [`${v}%`, 'Score']} contentStyle={tooltipStyle} />
                  <ReferenceLine y={50} stroke="#f59e0b" strokeDasharray="5 3"
                    label={{ value: 'Pass line', position: 'insideTopRight', fill: '#f59e0b', fontSize: 10 }} />
                  <Line type="monotone" dataKey="score" stroke="#6c63ff" strokeWidth={2.5}
                    dot={{ r: 5, fill: '#6c63ff', strokeWidth: 0 }} activeDot={{ r: 7, fill: '#a5b4fc' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Accuracy donut */}
            <div className={styles.chartCard}>
              <h3 className={styles.chartTitle}>Accuracy Breakdown</h3>
              {(a.totalCorrect + a.totalWrong) > 0 ? (
                <ResponsiveContainer width="100%" height={195}>
                  <PieChart>
                    <Pie data={a.correctWrong} cx="50%" cy="50%"
                      innerRadius={52} outerRadius={78} dataKey="value" paddingAngle={4}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}>
                      {a.correctWrong.map((_, i) => <Cell key={i} fill={ACC_COLORS[i]} />)}
                    </Pie>
                    <Tooltip formatter={(v, n) => [`${v} answers`, n]} contentStyle={tooltipStyle} />
                    <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className={styles.noData}>No detailed breakdown available</p>
              )}
            </div>

            {/* Pass/Fail donut */}
            <div className={styles.chartCard}>
              <h3 className={styles.chartTitle}>Pass / Fail Distribution</h3>
              <ResponsiveContainer width="100%" height={195}>
                <PieChart>
                  <Pie data={a.passFail} cx="50%" cy="50%"
                    innerRadius={52} outerRadius={78} dataKey="value" paddingAngle={4}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}>
                    {a.passFail.map((_, i) => <Cell key={i} fill={PF_COLORS[i]} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [`${v} exam${v !== 1 ? 's' : ''}`, n]} contentStyle={tooltipStyle} />
                  <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

          </div>

          {/* Per-exam bar chart — only when >1 attempt */}
          {a.examBars.length > 1 && (
            <div className={styles.chartCard}>
              <h3 className={styles.chartTitle}>Per-Exam Score Comparison</h3>
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={a.examBars} margin={{ top: 10, right: 24, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} tick={{ fill: '#94a3b8' }} />
                  <YAxis domain={[0, 100]} stroke="#64748b" fontSize={11} tick={{ fill: '#94a3b8' }} unit="%" />
                  <Tooltip formatter={v => [`${v}%`, 'Score']} contentStyle={tooltipStyle} />
                  <ReferenceLine y={50} stroke="#f59e0b" strokeDasharray="5 3" />
                  <Bar dataKey="score" radius={[6, 6, 0, 0]} maxBarSize={48}>
                    {a.examBars.map((entry, i) => (
                      <Cell key={i} fill={entry.score >= 50 ? '#6c63ff' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

        </div>
      )}

      {/* ── Result cards ─────────────────────────────────────────────────── */}
      {myResults.length === 0 ? (
        <div className={styles.empty}>
          <p>No results yet. Complete an exam to see your results here.</p>
        </div>
      ) : (
        <>
          <h2 className={styles.sectionTitle}>All Attempts</h2>
          <div className={styles.list}>
            {myResults.map(r => (
              <div key={r.id}
                className={`${styles.resultCard} ${selected?.id === r.id ? styles.active : ''}`}
                onClick={() => setSelected(r)}>
                <div className={styles.resultTop}>
                  <span className={styles.examName}>Attempt #{r.attemptId}</span>
                  <Badge variant={r.percentage >= 50 ? 'success' : 'danger'}>
                    {r.percentage >= 50 ? 'PASS' : 'FAIL'}
                  </Badge>
                </div>
                <div className={styles.scoreRow}>
                  <div className={styles.scoreCircle} style={{ '--pct': r.percentage }}>
                    <span>{(r.percentage || 0).toFixed(1)}%</span>
                  </div>
                  <div className={styles.scoreDetails}>
                    <p>{r.totalScore} / {r.maxScore} marks</p>
                  </div>
                </div>
                <div className={styles.pctBar}>
                  <div className={styles.pctFill}
                    style={{ width: `${r.percentage}%`, background: r.percentage >= 50 ? 'var(--success)' : 'var(--danger)' }} />
                </div>
                <div className={styles.cardActions}>
                  <button className={styles.reviewBtn}
                    onClick={e => { e.stopPropagation(); setSelected(r) }}>
                    View Details →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Detail modal ─────────────────────────────────────────────────── */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Result Details" size="lg">
        {selected && (() => {
          const pie = getBreakdownPie(selected)
          let breakdown = null
          try { breakdown = JSON.parse(selected.detailJson) } catch {}
          const correct = breakdown ? breakdown.filter(q => q.isCorrect).length : 0
          const wrong   = breakdown ? breakdown.length - correct : 0

          return (
            <div className={styles.detail}>
              <div className={styles.detailHeader}>
                <div className={styles.detailScoreBlock}>
                  <p className={styles.detailScore}>{selected.totalScore} / {selected.maxScore}</p>
                  <p className={styles.detailPct}>
                    {(selected.percentage || 0).toFixed(1)}%&nbsp;
                    <Badge variant={selected.percentage >= 50 ? 'success' : 'danger'}>
                      {selected.percentage >= 50 ? 'PASS' : 'FAIL'}
                    </Badge>
                  </p>
                  <button className={styles.shareBtn} style={{ marginTop: '0.5rem', width: 'fit-content' }}
                    onClick={() => handleShare(selected)}>
                    🔗 Share Result
                  </button>
                </div>

                {pie && (
                  <div className={styles.miniChartWrap}>
                    <PieChart width={130} height={130}>
                      <Pie data={pie} cx={60} cy={60} innerRadius={32} outerRadius={55}
                        dataKey="value" paddingAngle={4}>
                        <Cell fill="#10b981" />
                        <Cell fill="#ef4444" />
                      </Pie>
                      <Tooltip formatter={(v, n) => [v, n]}
                        contentStyle={{ ...tooltipStyle, fontSize: 11 }} />
                    </PieChart>
                    <div className={styles.miniLegend}>
                      <span style={{ color: '#10b981' }}>✓ {correct} correct</span>
                      <span style={{ color: '#ef4444' }}>✗ {wrong} wrong</span>
                    </div>
                  </div>
                )}
              </div>

              {breakdown && (
                <>
                  <h4 className={styles.breakdownTitle}>Question Breakdown</h4>
                  <div className={styles.questions}>
                    {breakdown.map((q, i) => (
                      <div key={i} className={`${styles.qItem} ${q.isCorrect ? styles.correct : styles.wrong}`}>
                        <div className={styles.qHeader}>
                          <span className={styles.qNum}>Q{i + 1}</span>
                          <span className={styles.qResult}>{q.isCorrect ? '✅ Correct' : '❌ Wrong'}</span>
                        </div>

                        {q.questionType === 'AR' ? (
                          <div className={styles.arSection}>
                            <p className={styles.arStatement}><span className={styles.arLabel}>Assertion:</span> {q.assertion}</p>
                            <p className={styles.arStatement}><span className={styles.arLabel}>Reason:</span> {q.reason}</p>
                          </div>
                        ) : (
                          <p className={styles.questionText}>{q.questionText}</p>
                        )}

                        {q.options && (
                          <div className={styles.optionsList}>
                            {q.options.map((opt, idx) => {
                              const correct = q.questionType === 'TF'
                                ? (idx === 0 && q.correctAnswer === 'true') || (idx === 1 && q.correctAnswer === 'false')
                                : String(idx) === String(q.correctAnswer)
                              const studentWrong = !q.isCorrect && q.studentAnswer != null && (
                                q.questionType === 'TF'
                                  ? (idx === 0 && q.studentAnswer === 'true') || (idx === 1 && q.studentAnswer === 'false')
                                  : String(idx) === String(q.studentAnswer)
                              )
                              return (
                                <div
                                  key={idx}
                                  className={`${styles.option} ${correct ? styles.optionCorrect : ''} ${studentWrong ? styles.optionWrong : ''}`}
                                >
                                  <span className={styles.optionLabel}>{String.fromCharCode(65 + idx)}.</span>
                                  <span>{opt}</span>
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {q.studentAnswer == null && (
                          <p className={styles.notAnswered}>Not answered</p>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )
        })()}
      </Modal>
    </div>
  )
}
