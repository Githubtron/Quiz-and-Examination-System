import React, { useState } from 'react'
import { mockResults } from '../../api/mockData'
import { useAuth } from '../../context/AuthContext'
import Badge from '../../components/Badge'
import Modal from '../../components/Modal'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts'
import styles from './StudentResults.module.css'

const AR_CHOICES = [
  'Both A and R are true, and R is the correct explanation of A',
  'Both A and R are true, but R is not the correct explanation of A',
  'A is true but R is false',
  'A is false but R is true',
]

export default function StudentResults() {
  const { session } = useAuth()
  const [selected, setSelected] = useState(null)

  // Filter results for the current student
  const myResults = mockResults.filter(r => r.studentName === session?.username || r.studentId === session?.userId)

  const handleExportCSV = () => {
    const rows = [['Exam', 'Score', 'Max', 'Percentage', 'Status', 'Submitted']]
    myResults.forEach(r => rows.push([
      r.examTitle || `Exam #${r.examId}`,
      r.totalScore,
      r.maxScore,
      r.percentage + '%',
      r.percentage >= 50 ? 'PASS' : 'FAIL',
      new Date(r.submittedAt).toLocaleString()
    ]))
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'my-results.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const handleDownloadPDF = (r) => {
    const pass = r.percentage >= 50
    const breakdownRows = r.breakdown?.length
      ? r.breakdown.map((q, i) => `<tr>
          <td>${i + 1}</td>
          <td>${q.text}</td>
          <td>${q.type}</td>
          <td>${q.given !== undefined ? String(q.given) : 'Not answered'}</td>
          <td class="${q.correct ? 'correct' : 'wrong'}">${q.correct ? '✓ Correct' : '✗ Wrong'}</td>
        </tr>`).join('')
      : '<tr><td colspan="5" style="text-align:center;color:#94a3b8">No breakdown available</td></tr>'

    const printContent = `
      <html><head><title>Result — ${r.examTitle || 'Exam'}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 2rem; color: #0f172a; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #4f46e5; padding-bottom: 1rem; margin-bottom: 1.5rem; }
        h1 { font-size: 1.3rem; margin: 0 0 0.25rem; }
        .score { font-size: 2.5rem; font-weight: 900; color: #4f46e5; }
        .badge { display: inline-block; padding: 0.2rem 0.75rem; border-radius: 20px; font-weight: 700; font-size: 0.85rem; background: ${pass ? '#dcfce7' : '#fee2e2'}; color: ${pass ? '#166534' : '#991b1b'}; }
        .meta { font-size: 0.85rem; color: #64748b; margin-top: 0.25rem; }
        table { width: 100%; border-collapse: collapse; font-size: 0.82rem; margin-top: 1rem; }
        th { background: #4f46e5; color: #fff; padding: 0.5rem 0.75rem; text-align: left; }
        td { padding: 0.55rem 0.75rem; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
        tr:nth-child(even) td { background: #f8fafc; }
        .correct { color: #10b981; font-weight: 700; }
        .wrong { color: #ef4444; font-weight: 700; }
        .footer { margin-top: 2rem; font-size: 0.75rem; color: #94a3b8; text-align: right; }
      </style></head><body>
      <div class="header">
        <div>
          <h1>${r.examTitle || 'Exam'} — Result</h1>
          <div class="score">${r.totalScore} / ${r.maxScore}</div>
          <div class="meta">${r.percentage}% &nbsp; <span class="badge">${pass ? 'PASS' : 'FAIL'}</span></div>
        </div>
        <div class="meta" style="text-align:right">
          <div><strong>Student:</strong> ${r.studentName}</div>
          <div><strong>Submitted:</strong> ${new Date(r.submittedAt).toLocaleString()}</div>
          <div><strong>Generated:</strong> ${new Date().toLocaleString()}</div>
        </div>
      </div>
      <table>
        <thead><tr><th>#</th><th>Question</th><th>Type</th><th>Your Answer</th><th>Result</th></tr></thead>
        <tbody>${breakdownRows}</tbody>
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

  // Build radar data from actual results
  const subjectMap = {}
  myResults.forEach(r => {
    if (!r.breakdown?.length) return
    r.breakdown.forEach(q => {
      const subj = q.subject || 'General'
      if (!subjectMap[subj]) subjectMap[subj] = { correct: 0, total: 0 }
      subjectMap[subj].total++
      if (q.correct) subjectMap[subj].correct++
    })
  })
  const radarData = Object.entries(subjectMap).map(([subject, { correct, total }]) => ({
    subject, score: Math.round((correct / total) * 100)
  }))

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>My Results</h1>
          <p className={styles.sub}>{myResults.length} exam{myResults.length !== 1 ? 's' : ''} completed</p>
        </div>
        {myResults.length > 0 && (
          <button className={styles.exportBtn} onClick={handleExportCSV}>⬇ Export CSV</button>
        )}
      </div>

      {myResults.length === 0 ? (
        <div className={styles.empty}>
          <p>No results yet. Complete an exam to see your results here.</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {/* Results list */}
          <div className={styles.list}>
            {myResults.map(r => (
              <div key={r.id} className={`${styles.resultCard} ${selected?.id === r.id ? styles.active : ''}`}
                onClick={() => setSelected(r)}>
                <div className={styles.resultTop}>
                  <span className={styles.examName}>{r.examTitle || `Exam #${r.examId}`}</span>
                  <Badge variant={r.percentage >= 50 ? 'success' : 'danger'}>
                    {r.percentage >= 50 ? 'PASS' : 'FAIL'}
                  </Badge>
                </div>
                <div className={styles.scoreRow}>
                  <div className={styles.scoreCircle} style={{ '--pct': r.percentage }}>
                    <span>{r.percentage}%</span>
                  </div>
                  <div className={styles.scoreDetails}>
                    <p>{r.totalScore} / {r.maxScore} marks</p>
                    <p className={styles.date}>📅 {new Date(r.submittedAt).toLocaleString()}</p>
                  </div>
                </div>
                <div className={styles.pctBar}>
                  <div className={styles.pctFill}
                    style={{ width: `${r.percentage}%`, background: r.percentage >= 50 ? 'var(--success)' : 'var(--danger)' }} />
                </div>
                <div className={styles.cardActions}>
                  <button className={styles.reviewBtn} onClick={() => setSelected(r)}>View Details →</button>
                  <button className={styles.pdfBtn} onClick={(e) => { e.stopPropagation(); handleDownloadPDF(r) }}>🖨 PDF</button>
                </div>
              </div>
            ))}
          </div>

          {/* Radar chart */}
          {radarData.length > 0 && (
            <div className={styles.radarCard}>
              <h3 className={styles.cardTitle}>Subject Performance</h3>
              <ResponsiveContainer width="100%" height={260}>
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
                  <Radar dataKey="score" stroke="#4f46e5" fill="#4f46e5" fillOpacity={0.25} />
                  <Tooltip formatter={v => `${v}%`} />
                </RadarChart>
              </ResponsiveContainer>
              <div className={styles.legend}>
                {radarData.map(d => (
                  <div key={d.subject} className={styles.legendItem}>
                    <span className={styles.legendDot} />
                    <span>{d.subject}: <strong>{d.score}%</strong></span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detail modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Result Details" size="lg">
        {selected && (
          <div className={styles.detail}>
            <div className={styles.detailHeader}>
              <div>
                <p className={styles.detailExam}>{selected.examTitle || `Exam #${selected.examId}`}</p>
                <p className={styles.detailScore}>{selected.totalScore} / {selected.maxScore}</p>
                <p className={styles.detailPct}>{selected.percentage}% — <Badge variant={selected.percentage >= 50 ? 'success' : 'danger'}>{selected.percentage >= 50 ? 'PASS' : 'FAIL'}</Badge></p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                <p className={styles.detailDate}>Submitted: {new Date(selected.submittedAt).toLocaleString()}</p>
                <button className={styles.pdfBtn} onClick={() => handleDownloadPDF(selected)}>🖨 Download PDF</button>
              </div>
            </div>

            {selected.breakdown?.length > 0 ? (
              <>
                <h4 className={styles.breakdownTitle}>Question Breakdown</h4>
                <div className={styles.questions}>
                  {selected.breakdown.map((q, i) => (
                    <div key={q.id || i} className={`${styles.qItem} ${q.correct ? styles.correct : styles.wrong}`}>
                      <div className={styles.qHeader}>
                        <span className={styles.qNum}>Q{i + 1}</span>
                        <span className={styles.qType}>{q.type}</span>
                        <span className={styles.qResult}>{q.correct ? '✅ Correct' : '❌ Wrong'}</span>
                      </div>
                      <p className={styles.qText}>{q.text}</p>
                      <p className={styles.answer}>
                        Your answer: <strong>{q.given !== undefined ? String(q.given) : 'Not answered'}</strong>
                      </p>
                      {q.type === 'MCQ' && q.options && (
                        <div className={styles.options}>
                          {q.options.map((opt, oi) => (
                            <span key={oi} className={`${styles.opt} ${oi === q.correctIndex ? styles.correctOpt : ''}`}>
                              {oi === q.correctIndex ? '✓ ' : ''}{opt}
                            </span>
                          ))}
                        </div>
                      )}
                      {q.type === 'TF' && (
                        <p className={styles.answer}>Correct: <strong>{q.correctAnswer ? 'True' : 'False'}</strong></p>
                      )}
                      {q.type === 'AR' && (
                        <p className={styles.answer}>Correct: <strong>{AR_CHOICES[q.correctChoice]}</strong></p>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p style={{ color: '#94a3b8', textAlign: 'center', padding: '2rem' }}>No detailed breakdown available for this result.</p>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
