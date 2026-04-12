import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { attempts as attemptsApi } from '../../api/api'
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

export default function ExamAttempt() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [exam, setExam] = useState(null)
  const [questions, setQuestions] = useState([])
  const [attemptId, setAttemptId] = useState(null)
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState(new Map())
  const [timeLeft, setTimeLeft] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [result, setResult] = useState(null)
  const [warnings, setWarnings] = useState(0)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const timerRef = useRef(null)

  // Load assigned paper and start/resume attempt
  useEffect(() => {
    async function init() {
      try {
        const startPayload = await attemptsApi.start(id)
        setExam(startPayload.exam)
        setQuestions(startPayload.questions || [])
        setTimeLeft((startPayload.exam?.timeLimitMinutes || 30) * 60)
        setAttemptId(startPayload.attemptId)
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [id])

  const submit = useCallback(async (auto = false) => {
    clearInterval(timerRef.current)
    if (!attemptId) return
    try {
      const answersObj = {}
      answers.forEach((val, qId) => { answersObj[String(qId)] = val })
      const res = await attemptsApi.submit(attemptId, answersObj)
      setResult({ ...res, auto })
      setSubmitted(true)
    } catch (e) {
      setError(e.message)
    }
  }, [attemptId, answers])

  // Countdown timer
  useEffect(() => {
    if (submitted || loading || !attemptId) return
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current); submit(true); return 0 }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [submitted, loading, attemptId, submit])

  // Tab-switch detection
  useEffect(() => {
    if (submitted || !attemptId) return
    const handleVisibility = () => {
      if (document.hidden) {
        if (attemptId) attemptsApi.tabSwitch(attemptId).catch(() => {})
        setWarnings(w => {
          const next = w + 1
          if (next >= 3) submit(true)
          return next
        })
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [submitted, attemptId, submit])

  if (loading) return <div className={styles.examPage}><p style={{ padding: '2rem' }}>Loading exam…</p></div>
  if (error) return (
    <div className={styles.notFound}>
      <h2>{error}</h2>
      <button onClick={() => navigate('/student/exams')}>Back to Exams</button>
    </div>
  )

  if (submitted && result) {
    const pct = Math.round(result.percentage ?? 0)
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
            <span className={styles.scoreNum}>{result.totalScore}</span>
            <span className={styles.scoreOf}>/ {result.maxScore}</span>
          </div>
          <p className={styles.pctText}>{pct}% — <strong>{pass ? 'PASS' : 'FAIL'}</strong></p>
          <div className={styles.resultActions}>
            <button className={styles.homeBtn} onClick={() => navigate('/student')}>Go to Dashboard</button>
            <button className={styles.resultsBtn} onClick={() => navigate('/student/results')}>View All Results</button>
          </div>
        </div>
      </div>
    )
  }

  if (questions.length === 0) return (
    <div className={styles.notFound}>
      <h2>This exam has no assigned questions right now.</h2>
      <button onClick={() => navigate('/student/exams')}>Back to Exams</button>
    </div>
  )

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
      <div className={styles.examHeader}>
        <div className={styles.examInfo}>
          <h2 className={styles.examTitle}>{exam?.title}</h2>
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
        <div className={styles.sidebar}>
          <p className={styles.sidebarTitle}>Questions</p>
          <div className={styles.navGrid}>
            {questions.map((qn, i) => (
              <button
                key={qn.id}
                className={`${styles.navBtn} ${i === current ? styles.navCurrent : ''} ${answers.has(qn.id) ? styles.navAnswered : ''}`}
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

        <div className={styles.questionPanel}>
          <div className={styles.qMeta}>
            <span className={styles.qNum}>Question {current + 1} of {questions.length}</span>
            <span className={styles.qType}>{q.type}</span>
            <span className={styles.qDiff}>{q.difficulty}</span>
          </div>

          <p className={styles.qText}>{q.text}</p>

          {q.type === 'MCQ' && (
            <div className={styles.options}>
              {q.optionTexts?.map((opt, oi) => (
                <label key={oi} className={`${styles.option} ${answered === String(oi) ? styles.selected : ''}`}>
                  <input
                    type="radio"
                    name={`q${q.id}`}
                    value={oi}
                    checked={answered === String(oi)}
                    onChange={() => setAnswers(prev => new Map(prev).set(q.id, String(oi)))}
                  />
                  <span className={styles.optLabel}>{String.fromCharCode(65 + oi)}. {opt}</span>
                </label>
              ))}
            </div>
          )}

          {q.type === 'TF' && (
            <div className={styles.options}>
              {(q.optionTexts?.length
                ? q.optionTexts.map(label => ({
                    value: label.toLowerCase() === 'true' ? 'true' : 'false',
                    label,
                  }))
                : [{ value: 'true', label: 'True' }, { value: 'false', label: 'False' }]
              ).map(opt => (
                <label key={opt.value + opt.label} className={`${styles.option} ${answered === opt.value ? styles.selected : ''}`}>
                  <input
                    type="radio"
                    name={`q${q.id}`}
                    value={opt.value}
                    checked={answered === opt.value}
                    onChange={() => setAnswers(prev => new Map(prev).set(q.id, opt.value))}
                  />
                  <span className={styles.optLabel}>{opt.label}</span>
                </label>
              ))}
            </div>
          )}

          {q.type === 'AR' && (
            <div className={styles.arSection}>
              <div className={styles.arBox}><strong>Assertion (A):</strong> {q.assertion}</div>
              <div className={styles.arBox}><strong>Reason (R):</strong> {q.reason}</div>
              <div className={styles.options}>
                {(q.optionTexts?.length ? q.optionTexts : AR_CHOICES).map((choice, ci) => (
                  <label key={ci} className={`${styles.option} ${answered === String(ci) ? styles.selected : ''}`}>
                    <input
                      type="radio"
                      name={`q${q.id}`}
                      value={ci}
                      checked={answered === String(ci)}
                      onChange={() => setAnswers(prev => new Map(prev).set(q.id, String(ci)))}
                    />
                    <span className={styles.optLabel}>{String.fromCharCode(65 + ci)}. {choice}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className={styles.navActions}>
            <button className={styles.navPrev} disabled={current === 0} onClick={() => setCurrent(c => c - 1)}>← Previous</button>
            <button
              className={styles.clearBtn}
              onClick={() => setAnswers(prev => { const m = new Map(prev); m.delete(q.id); return m })}
            >
              Clear
            </button>
            {current < questions.length - 1 ? (
              <button className={styles.navNext} onClick={() => setCurrent(c => c + 1)}>Next →</button>
            ) : (
              <button className={styles.submitBtn} onClick={() => setShowConfirm(true)}>Submit Exam</button>
            )}
          </div>
        </div>
      </div>

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
