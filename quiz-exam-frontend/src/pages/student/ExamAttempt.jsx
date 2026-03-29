import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { mockExams, mockQuestions, saveResult } from '../../api/mockData'
import { useAuth } from '../../context/AuthContext'
import styles from './ExamAttempt.module.css'

const AR_CHOICES = [
  'Both A and R are true, and R is the correct explanation of A',
  'Both A and R are true, but R is not the correct explanation of A',
  'A is true but R is false',
  'A is false but R is true',
]

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

// Fisher-Yates shuffle — returns a new array
function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Shuffle MCQ options and remap correctIndex so scoring still works
function shuffleOptions(q) {
  if (q.type !== 'MCQ') return q
  const correctAnswer = q.options[q.correctIndex]
  const shuffled = shuffle(q.options)
  return { ...q, options: shuffled, correctIndex: shuffled.indexOf(correctAnswer) }
}

function scoreAttempt(questions, answers, marksPerQuestion = 1, negativeMarking = 0) {
  let score = 0
  const breakdown = questions.map(q => {
    const given = answers.get(q.id)
    let correct = false
    let attempted = given !== undefined
    if (q.type === 'MCQ') correct = attempted && parseInt(given) === q.correctIndex
    if (q.type === 'TF') correct = attempted && (given === 'true') === q.correctAnswer
    if (q.type === 'AR') correct = attempted && parseInt(given) === q.correctChoice
    return { ...q, given, correct, attempted }
  })
  breakdown.forEach(b => {
    if (b.correct) score += marksPerQuestion
    else if (b.attempted) score -= negativeMarking  // deduct only if answered wrong (not skipped)
  })
  return { score: Math.max(0, score), total: questions.length, maxScore: questions.length * marksPerQuestion, breakdown }
}

export default function ExamAttempt() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { session } = useAuth()
  const exam = mockExams.find(e => e.id === parseInt(id))

  // Shuffle questions once on mount — stable via useMemo
  const questions = useMemo(() => {
    const pool = mockQuestions.slice(0, exam?.totalQuestions || mockQuestions.length)
    return shuffle(pool).map(shuffleOptions)
  }, [exam?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState(new Map())
  const [timeLeft, setTimeLeft] = useState((exam?.timeLimitMinutes || 30) * 60)
  const [submitted, setSubmitted] = useState(false)
  const [result, setResult] = useState(null)
  const [warnings, setWarnings] = useState(0)
  const [showConfirm, setShowConfirm] = useState(false)
  const timerRef = useRef(null)

  const submit = useCallback((auto = false) => {
    clearInterval(timerRef.current)
    const res = scoreAttempt(questions, answers, exam?.marksPerQuestion || 1, exam?.negativeMarking || 0)
    setResult({ ...res, auto })
    setSubmitted(true)
    // Persist to shared results store
    saveResult({
      examId: exam?.id,
      examTitle: exam?.title,
      studentId: session?.userId,
      studentName: session?.username || 'Student',
      score: res.score,
      total: res.maxScore,
      breakdown: res.breakdown,
    })
  }, [questions, answers, exam, session])

  const handleDownloadPDF = () => {
    if (!result) return
    const pct = Math.round((result.score / result.total) * 100)
    const pass = pct >= 50
    const printContent = `
      <html><head><title>Exam Result — ${exam.title}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 2rem; color: #0f172a; }
        .header { border-bottom: 2px solid #4f46e5; padding-bottom: 1rem; margin-bottom: 1.5rem; }
        h1 { font-size: 1.3rem; margin: 0 0 0.5rem; }
        .score { font-size: 2.5rem; font-weight: 900; color: #4f46e5; }
        .badge { display: inline-block; padding: 0.2rem 0.75rem; border-radius: 20px; font-weight: 700; font-size: 0.85rem; background: ${pass ? '#dcfce7' : '#fee2e2'}; color: ${pass ? '#166534' : '#991b1b'}; }
        .meta { font-size: 0.85rem; color: #64748b; margin: 0.25rem 0; }
        table { width: 100%; border-collapse: collapse; font-size: 0.82rem; margin-top: 1rem; }
        th { background: #4f46e5; color: #fff; padding: 0.5rem 0.75rem; text-align: left; }
        td { padding: 0.55rem 0.75rem; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
        tr:nth-child(even) td { background: #f8fafc; }
        .correct { color: #10b981; font-weight: 700; }
        .wrong { color: #ef4444; font-weight: 700; }
        .footer { margin-top: 2rem; font-size: 0.75rem; color: #94a3b8; text-align: right; }
      </style></head><body>
      <div class="header">
        <h1>${exam.title} — Result</h1>
        <div class="score">${result.score} / ${result.total}</div>
        <div class="meta">${pct}% &nbsp; <span class="badge">${pass ? 'PASS' : 'FAIL'}</span></div>
        <div class="meta">Generated: ${new Date().toLocaleString()}</div>
      </div>
      <table>
        <thead><tr><th>#</th><th>Question</th><th>Type</th><th>Your Answer</th><th>Result</th></tr></thead>
        <tbody>
          ${result.breakdown.map((q, i) => `<tr>
            <td>${i + 1}</td>
            <td>${q.text}</td>
            <td>${q.type}</td>
            <td>${q.given !== undefined ? String(q.given) : 'Not answered'}</td>
            <td class="${q.correct ? 'correct' : 'wrong'}">${q.correct ? '✓ Correct' : '✗ Wrong'}</td>
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

  // Countdown timer
  useEffect(() => {
    if (submitted) return
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current); submit(true); return 0 }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [submitted, submit])

  // Tab-switch detection
  useEffect(() => {
    if (submitted) return
    const handleVisibility = () => {
      if (document.hidden) {
        setWarnings(w => {
          const next = w + 1
          if (next >= 3) { submit(true) }
          return next
        })
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [submitted, submit])

  if (!exam) return (
    <div className={styles.notFound}>
      <h2>Exam not found</h2>
      <button onClick={() => navigate('/student/exams')}>Back to Exams</button>
    </div>
  )

  if (submitted && result) {
    const pct = Math.round((result.score / result.maxScore) * 100)
    const pass = pct >= 50
    return (
      <div className={styles.resultPage}>
        <div className={styles.resultCard}>
          <div className={`${styles.resultBadge} ${pass ? styles.pass : styles.fail}`}>
            {pass ? '🎉' : '😔'}
          </div>
          <h2 className={styles.resultTitle}>{pass ? 'Congratulations!' : 'Better luck next time'}</h2>
          {result.auto && <p className={styles.autoNote}>⚠ Exam was auto-submitted</p>}
          <div className={styles.scoreDisplay}>
            <span className={styles.scoreNum}>{result.score}</span>
            <span className={styles.scoreOf}>/ {result.maxScore}</span>
          </div>
          <p className={styles.pctText}>{pct}% — <strong>{pass ? 'PASS' : 'FAIL'}</strong></p>
          {exam?.negativeMarking > 0 && (
            <p className={styles.negNote}>⚠ Negative marking: -{exam.negativeMarking} per wrong answer</p>
          )}

          <div className={styles.breakdown}>
            <h3>Question Breakdown</h3>
            {result.breakdown.map((q, i) => (
              <div key={q.id} className={`${styles.bqItem} ${q.correct ? styles.bCorrect : styles.bWrong}`}>
                <div className={styles.bqHeader}>
                  <span>Q{i + 1} — {q.type}</span>
                  <span>{q.correct ? `✅ +${exam?.marksPerQuestion || 1}` : q.attempted ? `❌ -${exam?.negativeMarking || 0}` : '⬜ 0'}</span>
                </div>
                <p className={styles.bqText}>{q.text}</p>
                <p className={styles.bqAnswer}>
                  Your answer: <strong>{q.given !== undefined ? String(q.given) : 'Not answered'}</strong>
                </p>
              </div>
            ))}
          </div>

          <div className={styles.resultActions}>
            <button className={styles.homeBtn} onClick={() => navigate('/student')}>Go to Dashboard</button>
            <button className={styles.pdfBtn} onClick={handleDownloadPDF}>🖨 Download PDF</button>
            <button className={styles.resultsBtn} onClick={() => navigate('/student/results')}>View All Results</button>
          </div>
        </div>
      </div>
    )
  }

  const q = questions[current]
  const answered = answers.get(q?.id)
  const answeredCount = answers.size
  const urgent = timeLeft <= 60

  return (
    <div
      className={styles.examPage}
      onCopy={e => e.preventDefault()}
      onPaste={e => e.preventDefault()}
      onCut={e => e.preventDefault()}
    >
      {/* Header */}
      <div className={styles.examHeader}>
        <div className={styles.examInfo}>
          <h2 className={styles.examTitle}>{exam.title}</h2>
          <span className={styles.progress}>{answeredCount}/{questions.length} answered</span>
        </div>
        <div className={styles.headerRight}>
          {warnings > 0 && (
            <span className={styles.warnBadge}>⚠ {warnings} tab switch{warnings > 1 ? 'es' : ''}</span>
          )}
          <div className={`${styles.timer} ${urgent ? styles.urgent : ''}`}>
            ⏱ {formatTime(timeLeft)}
          </div>
        </div>
      </div>

      <div className={styles.body}>
        {/* Question nav sidebar */}
        <div className={styles.sidebar}>
          <p className={styles.sidebarTitle}>Questions</p>
          <div className={styles.navGrid}>
            {questions.map((qn, i) => (
              <button
                key={qn.id}
                className={`${styles.navBtn}
                  ${i === current ? styles.navCurrent : ''}
                  ${answers.has(qn.id) ? styles.navAnswered : ''}`}
                onClick={() => setCurrent(i)}
              >{i + 1}</button>
            ))}
          </div>
          <div className={styles.legend}>
            <span className={`${styles.dot} ${styles.dotAnswered}`} /> Answered
            <span className={`${styles.dot} ${styles.dotCurrent}`} /> Current
            <span className={`${styles.dot} ${styles.dotUnanswered}`} /> Unanswered
          </div>
        </div>

        {/* Question panel */}
        <div className={styles.questionPanel}>
          <div className={styles.qMeta}>
            <span className={styles.qNum}>Question {current + 1} of {questions.length}</span>
            <span className={styles.qType}>{q.type}</span>
            <span className={styles.qDiff}>{q.difficulty}</span>
          </div>

          <p className={styles.qText}>{q.text}</p>

          {/* MCQ */}
          {q.type === 'MCQ' && (
            <div className={styles.options}>
              {q.options.map((opt, oi) => (
                <label key={oi} className={`${styles.option} ${answered === String(oi) ? styles.selected : ''}`}>
                  <input
                    type="radio" name={`q${q.id}`} value={oi}
                    checked={answered === String(oi)}
                    onChange={() => setAnswers(prev => new Map(prev).set(q.id, String(oi)))}
                  />
                  <span className={styles.optLabel}>{String.fromCharCode(65 + oi)}. {opt}</span>
                </label>
              ))}
            </div>
          )}

          {/* True/False */}
          {q.type === 'TF' && (
            <div className={styles.options}>
              {['true', 'false'].map(val => (
                <label key={val} className={`${styles.option} ${answered === val ? styles.selected : ''}`}>
                  <input
                    type="radio" name={`q${q.id}`} value={val}
                    checked={answered === val}
                    onChange={() => setAnswers(prev => new Map(prev).set(q.id, val))}
                  />
                  <span className={styles.optLabel}>{val === 'true' ? 'True' : 'False'}</span>
                </label>
              ))}
            </div>
          )}

          {/* Assertion-Reason */}
          {q.type === 'AR' && (
            <div className={styles.arSection}>
              <div className={styles.arBox}>
                <strong>Assertion (A):</strong> {q.assertion}
              </div>
              <div className={styles.arBox}>
                <strong>Reason (R):</strong> {q.reason}
              </div>
              <div className={styles.options}>
                {AR_CHOICES.map((choice, ci) => (
                  <label key={ci} className={`${styles.option} ${answered === String(ci) ? styles.selected : ''}`}>
                    <input
                      type="radio" name={`q${q.id}`} value={ci}
                      checked={answered === String(ci)}
                      onChange={() => setAnswers(prev => new Map(prev).set(q.id, String(ci)))}
                    />
                    <span className={styles.optLabel}>{String.fromCharCode(65 + ci)}. {choice}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className={styles.navActions}>
            <button
              className={styles.navPrev}
              disabled={current === 0}
              onClick={() => setCurrent(c => c - 1)}
            >← Previous</button>
            <button
              className={styles.clearBtn}
              onClick={() => setAnswers(prev => { const m = new Map(prev); m.delete(q.id); return m })}
            >Clear</button>
            {current < questions.length - 1 ? (
              <button className={styles.navNext} onClick={() => setCurrent(c => c + 1)}>Next →</button>
            ) : (
              <button className={styles.submitBtn} onClick={() => setShowConfirm(true)}>Submit Exam</button>
            )}
          </div>
        </div>
      </div>

      {/* Confirm submit dialog */}
      {showConfirm && (
        <div className={styles.overlay}>
          <div className={styles.confirmBox}>
            <h3>Submit Exam?</h3>
            <p>You have answered <strong>{answeredCount}</strong> of <strong>{questions.length}</strong> questions.</p>
            {answeredCount < questions.length && (
              <p className={styles.warnText}>⚠ {questions.length - answeredCount} question(s) unanswered.</p>
            )}
            <div className={styles.confirmActions}>
              <button className={styles.cancelBtn} onClick={() => setShowConfirm(false)}>Cancel</button>
              <button className={styles.confirmBtn} onClick={() => { setShowConfirm(false); submit(false) }}>Submit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
