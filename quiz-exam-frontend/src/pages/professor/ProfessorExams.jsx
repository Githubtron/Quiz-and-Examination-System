import React, { useState, useEffect } from 'react'
import { mockExams, mockQuestions } from '../../api/mockData'
import Badge from '../../components/Badge'
import Modal from '../../components/Modal'
import styles from './ProfessorExams.module.css'

// Auto-generate question paper from pool based on criteria
function autoGeneratePaper(criteria) {
  const { subject, easyCount, mediumCount, hardCount, types } = criteria
  const pool = mockQuestions.filter(q => {
    if (subject && q.subject !== subject) return false
    if (types.length > 0 && !types.includes(q.type)) return false
    return true
  })
  const pick = (diff, count) => {
    const bucket = pool.filter(q => q.difficulty === diff)
    const shuffled = [...bucket].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, count)
  }
  const selected = [
    ...pick('EASY', easyCount),
    ...pick('MEDIUM', mediumCount),
    ...pick('HARD', hardCount),
  ]
  return selected
}

// Derive live status from schedule
function liveStatus(exam) {
  if (exam.status === 'DRAFT') return 'DRAFT'
  const now = new Date()
  if (exam.startDatetime && new Date(exam.startDatetime) > now) return 'SCHEDULED'
  if (exam.endDatetime && new Date(exam.endDatetime) < now) return 'ENDED'
  return 'ACTIVE'
}

const STATUS_VARIANT = { ACTIVE: 'success', DRAFT: 'default', SCHEDULED: 'warning', ENDED: 'danger' }
const SUBJECTS = [...new Set(mockQuestions.map(q => q.subject))]

export default function ProfessorExams() {
  const [exams, setExams] = useState(mockExams)
  const [showModal, setShowModal] = useState(false)
  const [tab, setTab] = useState('manual') // 'manual' | 'auto'

  // Re-render every minute so liveStatus() stays current
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])
  const [form, setForm] = useState({
    title: '', description: '', timeLimitMinutes: 30,
    marksPerQuestion: 4, negativeMarking: 0, adaptive: false,
    startDatetime: '', endDatetime: '',
  })
  const [autoCriteria, setAutoCriteria] = useState({
    subject: '', easyCount: 2, mediumCount: 2, hardCount: 1,
    types: ['MCQ', 'TF', 'AR'],
  })
  const [preview, setPreview] = useState([])
  const [msg, setMsg] = useState('')

  const handleGenerate = () => {
    const qs = autoGeneratePaper(autoCriteria)
    setPreview(qs)
  }

  const handleCreate = e => {
    e.preventDefault()
    const selectedQs = tab === 'auto' ? preview : []
    const newExam = {
      id: Date.now(), ...form,
      status: form.startDatetime ? 'ACTIVE' : 'DRAFT',
      createdBy: 2,
      totalQuestions: tab === 'auto' ? selectedQs.length : 0,
      questionIds: selectedQs.map(q => q.id),
    }
    setExams(es => [...es, newExam])
    setMsg(tab === 'auto'
      ? `Exam created with ${selectedQs.length} auto-selected questions.`
      : 'Exam created as draft.')
    setShowModal(false)
    setPreview([])
    setTab('manual')
  }

  const handlePublish = id => {
    setExams(es => es.map(e => e.id === id ? { ...e, status: 'ACTIVE' } : e))
    setMsg('Exam published and now active.')
  }

  const handleDelete = id => {
    setExams(es => es.filter(e => e.id !== id))
    setMsg('Exam deleted.')
  }

  const toggleType = (t) => {
    setAutoCriteria(c => ({
      ...c,
      types: c.types.includes(t) ? c.types.filter(x => x !== t) : [...c.types, t]
    }))
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Exam Management</h1>
          <p className={styles.sub}>{exams.length} exams</p>
        </div>
        <button className={styles.addBtn} onClick={() => setShowModal(true)}>+ Create Exam</button>
      </div>

      {msg && <div className={styles.msg}>{msg}</div>}

      <div className={styles.examGrid}>
        {exams.map(e => {
          const status = liveStatus(e)
          return (
            <div key={e.id} className={styles.examCard}>
              <div className={styles.examTop}>
                <Badge variant={STATUS_VARIANT[status]}>{status}</Badge>
                {e.adaptive && <Badge variant="info">ADAPTIVE</Badge>}
                {e.questionIds?.length > 0 && <Badge variant="primary">AUTO-GENERATED</Badge>}
              </div>
              <h3 className={styles.examTitle}>{e.title}</h3>
              <p className={styles.examDesc}>{e.description}</p>
              <div className={styles.examMeta}>
                <span>⏱ {e.timeLimitMinutes} min</span>
                <span>📝 {e.totalQuestions} questions</span>
                <span>⭐ {e.marksPerQuestion} marks/q</span>
                {e.negativeMarking > 0 && <span>➖ -{e.negativeMarking} neg</span>}
              </div>
              {e.startDatetime && (
                <p className={styles.schedule}>
                  📅 {new Date(e.startDatetime).toLocaleString()} → {e.endDatetime ? new Date(e.endDatetime).toLocaleString() : '∞'}
                </p>
              )}
              <div className={styles.examActions}>
                {e.status === 'DRAFT' && (
                  <button className={styles.publishBtn} onClick={() => handlePublish(e.id)}>Publish</button>
                )}
                <button className={styles.deleteBtn} onClick={() => handleDelete(e.id)}>Delete</button>
              </div>
            </div>
          )
        })}
      </div>

      <Modal open={showModal} onClose={() => { setShowModal(false); setPreview([]) }} title="Create Exam" size="lg">
        {/* Tab switcher */}
        <div className={styles.tabs}>
          <button className={`${styles.tabBtn} ${tab === 'manual' ? styles.tabActive : ''}`} onClick={() => setTab('manual')}>
            ✏ Manual Setup
          </button>
          <button className={`${styles.tabBtn} ${tab === 'auto' ? styles.tabActive : ''}`} onClick={() => setTab('auto')}>
            ⚡ Auto-Generate Paper
          </button>
        </div>

        <form onSubmit={handleCreate} className={styles.form}>
          {/* Common fields */}
          <div className={styles.field}>
            <label>Exam Title</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
          </div>
          <div className={styles.field}>
            <label>Description</label>
            <textarea rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className={styles.formRow}>
            <div className={styles.field}>
              <label>Time Limit (min)</label>
              <input type="number" min={1} value={form.timeLimitMinutes} onChange={e => setForm(f => ({ ...f, timeLimitMinutes: Number(e.target.value) }))} required />
            </div>
            <div className={styles.field}>
              <label>Marks per Question</label>
              <input type="number" min={1} value={form.marksPerQuestion} onChange={e => setForm(f => ({ ...f, marksPerQuestion: Number(e.target.value) }))} required />
            </div>
            <div className={styles.field}>
              <label>Negative Marking</label>
              <input type="number" min={0} step={0.5} value={form.negativeMarking} onChange={e => setForm(f => ({ ...f, negativeMarking: Number(e.target.value) }))} />
            </div>
          </div>
          <div className={styles.formRow}>
            <div className={styles.field}>
              <label>Start Date/Time (auto-activates)</label>
              <input type="datetime-local" value={form.startDatetime} onChange={e => setForm(f => ({ ...f, startDatetime: e.target.value }))} />
            </div>
            <div className={styles.field}>
              <label>End Date/Time (auto-closes)</label>
              <input type="datetime-local" value={form.endDatetime} onChange={e => setForm(f => ({ ...f, endDatetime: e.target.value }))} />
            </div>
          </div>

          {/* Auto-generate section */}
          {tab === 'auto' && (
            <div className={styles.autoSection}>
              <h4 className={styles.autoTitle}>Question Paper Criteria</h4>
              <div className={styles.formRow}>
                <div className={styles.field}>
                  <label>Subject</label>
                  <select value={autoCriteria.subject} onChange={e => setAutoCriteria(c => ({ ...c, subject: e.target.value }))}>
                    <option value="">All subjects</option>
                    {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className={styles.field}>
                  <label>Easy questions</label>
                  <input type="number" min={0} value={autoCriteria.easyCount} onChange={e => setAutoCriteria(c => ({ ...c, easyCount: Number(e.target.value) }))} />
                </div>
                <div className={styles.field}>
                  <label>Medium questions</label>
                  <input type="number" min={0} value={autoCriteria.mediumCount} onChange={e => setAutoCriteria(c => ({ ...c, mediumCount: Number(e.target.value) }))} />
                </div>
                <div className={styles.field}>
                  <label>Hard questions</label>
                  <input type="number" min={0} value={autoCriteria.hardCount} onChange={e => setAutoCriteria(c => ({ ...c, hardCount: Number(e.target.value) }))} />
                </div>
              </div>
              <div className={styles.field}>
                <label>Question Types</label>
                <div className={styles.typeToggles}>
                  {['MCQ', 'TF', 'AR'].map(t => (
                    <button key={t} type="button"
                      className={`${styles.typeBtn} ${autoCriteria.types.includes(t) ? styles.typeActive : ''}`}
                      onClick={() => toggleType(t)}>{t}</button>
                  ))}
                </div>
              </div>
              <button type="button" className={styles.generateBtn} onClick={handleGenerate}>
                ⚡ Generate Preview
              </button>
              {preview.length > 0 && (
                <div className={styles.preview}>
                  <p className={styles.previewTitle}>Preview — {preview.length} questions selected</p>
                  {preview.map((q, i) => (
                    <div key={q.id} className={styles.previewItem}>
                      <span className={styles.previewNum}>Q{i + 1}</span>
                      <span className={styles.previewType}>{q.type}</span>
                      <span className={styles.previewDiff}>{q.difficulty}</span>
                      <span className={styles.previewText}>{q.text.slice(0, 60)}…</span>
                    </div>
                  ))}
                </div>
              )}
              {preview.length === 0 && <p className={styles.noPreview}>Click "Generate Preview" to auto-select questions.</p>}
            </div>
          )}

          <label className={styles.checkLabel}>
            <input type="checkbox" checked={form.adaptive} onChange={e => setForm(f => ({ ...f, adaptive: e.target.checked }))} />
            Enable Adaptive Exam
          </label>
          <div className={styles.modalActions}>
            <button type="button" className={styles.cancelBtn} onClick={() => { setShowModal(false); setPreview([]) }}>Cancel</button>
            <button type="submit" className={styles.submitBtn}
              disabled={tab === 'auto' && preview.length === 0}>
              {tab === 'auto' ? `Create with ${preview.length} Questions` : 'Create Exam'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
