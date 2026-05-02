import React, { useState, useEffect } from 'react'
import { categories as categoriesApi, questions as questionsApi } from '../../api/api'
import Badge from '../../components/Badge'
import Modal from '../../components/Modal'
import styles from './ProfessorQuestions.module.css'

const diffBadge = { EASY: 'success', MEDIUM: 'warning', HARD: 'danger' }
const typeBadge = { MCQ: 'primary', AR: 'info', TF: 'default' }

const defaultForm = {
  text: '', difficulty: 'EASY', subject: '', topic: '', categoryId: '',
  correctIndex: 0, options: ['', '', '', ''],
  correctAnswer: true, assertion: '', reason: '', correctChoice: 0,
}

export default function ProfessorQuestions() {
  const [allQuestions, setAllQuestions] = useState([])
  const [categories, setCategories] = useState([])
  const [filter, setFilter] = useState({ type: '', difficulty: '', categoryId: '', keyword: '' })
  const [showModal, setShowModal] = useState(false)
  const [qType, setQType] = useState('MCQ')
  const [form, setForm] = useState(defaultForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    Promise.all([questionsApi.list(), categoriesApi.list()])
      .then(([questions, cats]) => {
        const categoryList = cats || []
        setAllQuestions(questions || [])
        setCategories(categoryList)
        if (categoryList.length > 0) {
          setForm(f => ({ ...f, categoryId: String(categoryList[0].id) }))
        }
      })
      .catch(e => setMsg(e.message))
      .finally(() => setLoading(false))
  }, [])

  const filtered = allQuestions.filter(q => {
    if (filter.type && q.type !== filter.type) return false
    if (filter.difficulty && q.difficulty !== filter.difficulty) return false
    if (filter.categoryId && String(q.category?.id) !== filter.categoryId) return false
    if (filter.keyword && !q.text.toLowerCase().includes(filter.keyword.toLowerCase())) return false
    return true
  })

  const handleAdd = async e => {
    e.preventDefault()
    setSaving(true)
    try {
      let saved
      if (qType === 'MCQ') {
        saved = await questionsApi.createMCQ({
          text: form.text,
          options: form.options,
          correctIndex: Number(form.correctIndex),
          difficulty: form.difficulty,
          subject: form.subject,
          topic: form.topic,
          categoryId: Number(form.categoryId),
        })
      } else if (qType === 'TF') {
        saved = await questionsApi.createTF({
          text: form.text,
          correctAnswer: form.correctAnswer,
          difficulty: form.difficulty,
          subject: form.subject,
          topic: form.topic,
          categoryId: Number(form.categoryId),
        })
      } else {
        saved = await questionsApi.createAR({
          assertion: form.assertion,
          reason: form.reason,
          correctChoice: Number(form.correctChoice),
          difficulty: form.difficulty,
          subject: form.subject,
          topic: form.topic,
          categoryId: Number(form.categoryId),
        })
      }
      setAllQuestions(qs => [...qs, saved])
      setShowModal(false)
      setForm({
        ...defaultForm,
        categoryId: categories.length > 0 ? String(categories[0].id) : '',
      })
      setMsg('Question added.')
    } catch (err) {
      setMsg(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this question?')) return
    try {
      await questionsApi.delete(id)
      setAllQuestions(qs => qs.filter(q => q.id !== id))
      setMsg('Question deleted.')
    } catch (err) {
      setMsg(err.message)
    }
  }

  if (loading) return <div className={styles.page}><p>Loading questions…</p></div>

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Question Bank</h1>
          <p className={styles.sub}>{allQuestions.length} questions</p>
        </div>
        <button className={styles.addBtn} onClick={() => setShowModal(true)} disabled={categories.length === 0}>
          + Add Question
        </button>
      </div>

      {categories.length === 0 && (
        <div className={styles.warn}>Create at least one category before adding questions.</div>
      )}

      {msg && <div className={styles.msg} onClick={() => setMsg('')}>{msg}</div>}

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
        <select value={filter.categoryId} onChange={e => setFilter(f => ({ ...f, categoryId: e.target.value }))}>
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input
          placeholder="Search keyword…"
          value={filter.keyword}
          onChange={e => setFilter(f => ({ ...f, keyword: e.target.value }))}
        />
      </div>

      <div className={styles.qGrid}>
        {filtered.map(q => (
          <div key={q.id} className={styles.qCard}>
            <div className={styles.qTop}>
              <Badge variant={typeBadge[q.type]}>{q.type}</Badge>
              <Badge variant={diffBadge[q.difficulty]}>{q.difficulty}</Badge>
              {q.category?.name && <span className={styles.categoryTag}>{q.category.name}</span>}
              {q.subject && <span className={styles.subject}>{q.subject}</span>}
              <button className={styles.deleteBtn} onClick={() => handleDelete(q.id)}>✕</button>
            </div>
            <p className={styles.qText}>{q.text}</p>
            {q.type === 'MCQ' && q.optionTexts && (
              <ul className={styles.options}>
                {q.optionTexts.map((o, i) => (
                  <li key={i} className={i === q.correctIndex ? styles.correct : ''}>
                    {String.fromCharCode(65 + i)}. {o}
                  </li>
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
            <label>Category</label>
            <select
              value={form.categoryId}
              onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}
              required
            >
              <option value="">Select category</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className={styles.field}>
            <label>Question Text</label>
            <textarea
              rows={3}
              value={form.text}
              onChange={e => setForm(f => ({ ...f, text: e.target.value }))}
              required={qType !== 'AR'}
            />
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
                  <input
                    value={o}
                    onChange={e => setForm(f => {
                      const opts = [...f.options]
                      opts[i] = e.target.value
                      return { ...f, options: opts }
                    })}
                    required
                  />
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
                <label>Correct Choice (0–3)</label>
                <select value={form.correctChoice} onChange={e => setForm(f => ({ ...f, correctChoice: e.target.value }))}>
                  {[0, 1, 2, 3].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </>
          )}

          <div className={styles.modalActions}>
            <button type="button" className={styles.cancelBtn} onClick={() => setShowModal(false)}>Cancel</button>
            <button type="submit" className={styles.submitBtn} disabled={saving || categories.length === 0}>
              {saving ? 'Saving…' : 'Add Question'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
