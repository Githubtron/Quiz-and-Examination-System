import React, { useState } from 'react'
import { mockQuestions } from '../../api/mockData'
import Badge from '../../components/Badge'
import Modal from '../../components/Modal'
import styles from './ProfessorQuestions.module.css'

const diffBadge = { EASY: 'success', MEDIUM: 'warning', HARD: 'danger' }
const typeBadge = { MCQ: 'primary', AR: 'info', TF: 'default' }

export default function ProfessorQuestions() {
  const [questions, setQuestions] = useState(mockQuestions)
  const [filter, setFilter] = useState({ type: '', difficulty: '', keyword: '' })
  const [showModal, setShowModal] = useState(false)
  const [qType, setQType] = useState('MCQ')
  const [form, setForm] = useState({ text: '', difficulty: 'EASY', subject: '', topic: '', correctIndex: 0, options: ['', '', '', ''], correctAnswer: true, assertion: '', reason: '', correctChoice: 1 })

  const filtered = questions.filter(q => {
    if (filter.type && q.type !== filter.type) return false
    if (filter.difficulty && q.difficulty !== filter.difficulty) return false
    if (filter.keyword && !q.text.toLowerCase().includes(filter.keyword.toLowerCase())) return false
    return true
  })

  const handleAdd = e => {
    e.preventDefault()
    const base = { id: Date.now(), type: qType, text: form.text, difficulty: form.difficulty, subject: form.subject, topic: form.topic }
    let q = base
    if (qType === 'MCQ') q = { ...base, options: form.options, correctIndex: Number(form.correctIndex) }
    else if (qType === 'TF') q = { ...base, correctAnswer: form.correctAnswer }
    else q = { ...base, assertion: form.assertion, reason: form.reason, correctChoice: Number(form.correctChoice) }
    setQuestions(qs => [...qs, q])
    setShowModal(false)
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Question Bank</h1>
          <p className={styles.sub}>{questions.length} questions</p>
        </div>
        <button className={styles.addBtn} onClick={() => setShowModal(true)}>+ Add Question</button>
      </div>

      <div className={styles.filters}>
        <select value={filter.type} onChange={e => setFilter(f => ({ ...f, type: e.target.value }))}>
          <option value="">All Types</option>
          <option value="MCQ">MCQ</option>
          <option value="AR">Assertion-Reason</option>
          <option value="TF">True/False</option>
        </select>
        <select value={filter.difficulty} onChange={e => setFilter(f => ({ ...f, difficulty: e.target.value }))}>
          <option value="">All Difficulties</option>
          <option value="EASY">Easy</option>
          <option value="MEDIUM">Medium</option>
          <option value="HARD">Hard</option>
        </select>
        <input placeholder="Search keyword…" value={filter.keyword}
          onChange={e => setFilter(f => ({ ...f, keyword: e.target.value }))} />
      </div>

      <div className={styles.qGrid}>
        {filtered.map(q => (
          <div key={q.id} className={styles.qCard}>
            <div className={styles.qTop}>
              <Badge variant={typeBadge[q.type]}>{q.type}</Badge>
              <Badge variant={diffBadge[q.difficulty]}>{q.difficulty}</Badge>
              {q.subject && <span className={styles.subject}>{q.subject}</span>}
            </div>
            <p className={styles.qText}>{q.text}</p>
            {q.type === 'MCQ' && (
              <ul className={styles.options}>
                {q.options.map((o, i) => (
                  <li key={i} className={i === q.correctIndex ? styles.correct : ''}>{String.fromCharCode(65 + i)}. {o}</li>
                ))}
              </ul>
            )}
            {q.type === 'TF' && <p className={styles.answer}>Answer: <strong>{q.correctAnswer ? 'True' : 'False'}</strong></p>}
            {q.type === 'AR' && (
              <div className={styles.arDetail}>
                <p><strong>A:</strong> {q.assertion}</p>
                <p><strong>R:</strong> {q.reason}</p>
                <p className={styles.answer}>Choice: <strong>{q.correctChoice}</strong></p>
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && <p className={styles.empty}>No questions match your filters.</p>}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Question" size="lg">
        <form onSubmit={handleAdd} className={styles.form}>
          <div className={styles.formRow}>
            <div className={styles.field}>
              <label>Question Type</label>
              <select value={qType} onChange={e => setQType(e.target.value)}>
                <option value="MCQ">MCQ</option>
                <option value="TF">True/False</option>
                <option value="AR">Assertion-Reason</option>
              </select>
            </div>
            <div className={styles.field}>
              <label>Difficulty</label>
              <select value={form.difficulty} onChange={e => setForm(f => ({ ...f, difficulty: e.target.value }))}>
                <option value="EASY">Easy</option>
                <option value="MEDIUM">Medium</option>
                <option value="HARD">Hard</option>
              </select>
            </div>
          </div>
          <div className={styles.field}>
            <label>Question Text</label>
            <textarea rows={3} value={form.text} onChange={e => setForm(f => ({ ...f, text: e.target.value }))} required />
          </div>
          <div className={styles.formRow}>
            <div className={styles.field}>
              <label>Subject</label>
              <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} />
            </div>
            <div className={styles.field}>
              <label>Topic</label>
              <input value={form.topic} onChange={e => setForm(f => ({ ...f, topic: e.target.value }))} />
            </div>
          </div>

          {qType === 'MCQ' && (
            <>
              {form.options.map((o, i) => (
                <div key={i} className={styles.field}>
                  <label>Option {String.fromCharCode(65 + i)}</label>
                  <input value={o} onChange={e => setForm(f => { const opts = [...f.options]; opts[i] = e.target.value; return { ...f, options: opts } })} required />
                </div>
              ))}
              <div className={styles.field}>
                <label>Correct Option</label>
                <select value={form.correctIndex} onChange={e => setForm(f => ({ ...f, correctIndex: e.target.value }))}>
                  {['A', 'B', 'C', 'D'].map((l, i) => <option key={i} value={i}>{l}</option>)}
                </select>
              </div>
            </>
          )}

          {qType === 'TF' && (
            <div className={styles.field}>
              <label>Correct Answer</label>
              <select value={form.correctAnswer} onChange={e => setForm(f => ({ ...f, correctAnswer: e.target.value === 'true' }))}>
                <option value="true">True</option>
                <option value="false">False</option>
              </select>
            </div>
          )}

          {qType === 'AR' && (
            <>
              <div className={styles.field}>
                <label>Assertion</label>
                <textarea rows={2} value={form.assertion} onChange={e => setForm(f => ({ ...f, assertion: e.target.value }))} required />
              </div>
              <div className={styles.field}>
                <label>Reason</label>
                <textarea rows={2} value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} required />
              </div>
              <div className={styles.field}>
                <label>Correct Choice (1–5)</label>
                <select value={form.correctChoice} onChange={e => setForm(f => ({ ...f, correctChoice: e.target.value }))}>
                  {[1,2,3,4,5].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </>
          )}

          <div className={styles.modalActions}>
            <button type="button" className={styles.cancelBtn} onClick={() => setShowModal(false)}>Cancel</button>
            <button type="submit" className={styles.submitBtn}>Add Question</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
