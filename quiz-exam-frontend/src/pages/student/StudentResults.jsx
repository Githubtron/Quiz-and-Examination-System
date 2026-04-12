import React, { useState, useEffect } from 'react'
import { results as resultsApi, triggerDownload } from '../../api/api'
import Badge from '../../components/Badge'
import Modal from '../../components/Modal'
import styles from './StudentResults.module.css'

export default function StudentResults() {
  const [myResults, setMyResults] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    resultsApi.my()
      .then(data => setMyResults(data || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const handleExportCSV = () => {
    const rows = [['AttemptId', 'TotalScore', 'MaxScore', 'Percentage', 'Status']]
    myResults.forEach(r => rows.push([
      r.attemptId, r.totalScore, r.maxScore,
      r.percentage?.toFixed(1) + '%',
      r.percentage >= 50 ? 'PASS' : 'FAIL',
    ]))
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    triggerDownload(blob, 'my-results.csv')
  }

  const shareText = (result) => {
    if (!result) return ''
    return [
      `QuizMaster Result`,
      `Attempt: #${result.attemptId}`,
      `Score: ${result.totalScore}/${result.maxScore}`,
      `Percentage: ${result.percentage?.toFixed(1)}%`,
      `Status: ${result.percentage >= 50 ? 'PASS' : 'FAIL'}`,
    ].join('\n')
  }

  const handleShare = async (result) => {
    if (!result) return
    const text = shareText(result)
    try {
      if (navigator.share) {
        await navigator.share({ title: 'QuizMaster Result', text })
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(text)
      }
      setNotice('Result summary copied/shared successfully.')
    } catch {
      setNotice('Unable to share result right now.')
    }
  }

  if (loading) return <div className={styles.page}><p>Loading results…</p></div>

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>My Results</h1>
          <p className={styles.sub}>{myResults.length} exam{myResults.length !== 1 ? 's' : ''} completed</p>
        </div>
        {myResults.length > 0 && (
          <div className={styles.headerActions}>
            <button className={styles.exportBtn} onClick={handleExportCSV}>⬇ Download CSV</button>
            <button className={styles.shareBtn} onClick={() => handleShare(selected || myResults[0])}>🔗 Share</button>
          </div>
        )}
      </div>

      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
      {notice && <p className={styles.notice}>{notice}</p>}

      {myResults.length === 0 ? (
        <div className={styles.empty}>
          <p>No results yet. Complete an exam to see your results here.</p>
        </div>
      ) : (
        <div className={styles.list}>
          {myResults.map(r => (
            <div key={r.id} className={`${styles.resultCard} ${selected?.id === r.id ? styles.active : ''}`}
              onClick={() => setSelected(r)}>
              <div className={styles.resultTop}>
                <span className={styles.examName}>Attempt #{r.attemptId}</span>
                <Badge variant={r.percentage >= 50 ? 'success' : 'danger'}>
                  {r.percentage >= 50 ? 'PASS' : 'FAIL'}
                </Badge>
              </div>
              <div className={styles.scoreRow}>
                <div className={styles.scoreCircle} style={{ '--pct': r.percentage }}>
                  <span>{r.percentage?.toFixed(1)}%</span>
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
                <button className={styles.reviewBtn} onClick={() => setSelected(r)}>View Details →</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Result Details" size="lg">
        {selected && (
          <div className={styles.detail}>
            <p className={styles.detailScore}>{selected.totalScore} / {selected.maxScore}</p>
            <p className={styles.detailPct}>{selected.percentage?.toFixed(1)}% —{' '}
              <Badge variant={selected.percentage >= 50 ? 'success' : 'danger'}>
                {selected.percentage >= 50 ? 'PASS' : 'FAIL'}
              </Badge>
            </p>
            <div className={styles.detailActions}>
              <button className={styles.shareBtn} onClick={() => handleShare(selected)}>Share Result</button>
            </div>
            {selected.detailJson && (() => {
              try {
                const breakdown = JSON.parse(selected.detailJson)
                return (
                  <>
                    <h4 className={styles.breakdownTitle}>Question Breakdown</h4>
                    <div className={styles.questions}>
                      {breakdown.map((q, i) => (
                        <div key={i} className={`${styles.qItem} ${q.isCorrect ? styles.correct : styles.wrong}`}>
                          <div className={styles.qHeader}>
                            <span className={styles.qNum}>Q{i + 1}</span>
                            <span className={styles.qResult}>{q.isCorrect ? '✅ Correct' : '❌ Wrong'}</span>
                          </div>
                          <p className={styles.answer}>Your answer: <strong>{q.studentAnswer ?? 'Not answered'}</strong></p>
                          <p className={styles.answer}>Correct: <strong>{q.correctAnswer}</strong></p>
                        </div>
                      ))}
                    </div>
                  </>
                )
              } catch { return null }
            })()}
          </div>
        )}
      </Modal>
    </div>
  )
}
