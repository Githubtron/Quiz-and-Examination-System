import { useEffect, useState, useRef } from 'react'
import styles from './GenerateQuestions.module.css'
import { useAuth } from '../../context/AuthContext'

const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD']
const BASE = 'http://localhost:8080'

async function callGenerateAPI(file, count, token) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('count', count)
  const res = await fetch(`${BASE}/api/questions/generate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })
  if (!res.ok) {
    const e = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(e.error || 'Generation failed')
  }
  return res.json()
}

async function callSaveAPI(sourceDocument, categoryId, questions, token) {
  const res = await fetch(`${BASE}/api/questions/save-generated`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ sourceDocument, categoryId, questions }),
  })
  if (!res.ok) {
    const e = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(e.error || 'Save failed')
  }
  return res.json()
}

async function callCategoriesAPI(token) {
  const res = await fetch(`${BASE}/api/categories`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const e = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(e.error || 'Failed to load categories')
  }
  return res.json()
}

export default function GenerateQuestions() {
  const { session } = useAuth()
  const [file, setFile] = useState(null)
  const [count, setCount] = useState(5)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [categories, setCategories] = useState([])
  const [categoryId, setCategoryId] = useState('')
  const [sourceDoc, setSourceDoc] = useState('')
  const [questions, setQuestions] = useState([]) // { ...q, approved: bool, editing: bool }
  const [savedCount, setSavedCount] = useState(null)
  const fileRef = useRef()

  useEffect(() => {
    callCategoriesAPI(session?.token)
      .then(data => {
        const list = data || []
        setCategories(list)
        if (list.length > 0) setCategoryId(String(list[0].id))
      })
      .catch(e => setError(e.message))
  }, [session?.token])

  const handleFileChange = (e) => {
    const f = e.target.files[0]
    if (!f) return
    const ext = f.name.split('.').pop().toLowerCase()
    if (!['pdf', 'docx'].includes(ext)) {
      setError('Only PDF and DOCX files are supported.')
      return
    }
    setFile(f)
    setError('')
    setQuestions([])
    setSavedCount(null)
  }

  const handleGenerate = async () => {
    if (!file) { setError('Please select a file first.'); return }
    setLoading(true); setError(''); setQuestions([]); setSavedCount(null)
    try {
      const result = await callGenerateAPI(file, count, session?.token)
      setSourceDoc(result.filename)
      setQuestions(result.questions.map(q => ({ ...q, approved: false, editing: false })))
    } catch (e) {
      setError(e.message || 'Failed to generate questions.')
    } finally {
      setLoading(false)
    }
  }

  const toggleApprove = (i) => {
    setQuestions(qs => qs.map((q, idx) => idx === i ? { ...q, approved: !q.approved } : q))
  }

  const deleteQuestion = (i) => {
    setQuestions(qs => qs.filter((_, idx) => idx !== i))
  }

  const startEdit = (i) => {
    setQuestions(qs => qs.map((q, idx) => idx === i ? { ...q, editing: true } : q))
  }

  const updateField = (i, field, value) => {
    setQuestions(qs => qs.map((q, idx) => idx === i ? { ...q, [field]: value } : q))
  }

  const updateOption = (i, oi, value) => {
    setQuestions(qs => qs.map((q, idx) => {
      if (idx !== i) return q
      const options = [...q.options]; options[oi] = value
      return { ...q, options }
    }))
  }

  const saveEdit = (i) => {
    setQuestions(qs => qs.map((q, idx) => idx === i ? { ...q, editing: false } : q))
  }

  const approvedQuestions = questions.filter(q => q.approved)

  const handleSaveAll = async () => {
    if (approvedQuestions.length === 0) { setError('Approve at least one question before saving.'); return }
    if (!categoryId) { setError('Select a category before saving.'); return }
    setSaving(true); setError('')
    try {
      const result = await callSaveAPI(
        sourceDoc,
        Number(categoryId),
        approvedQuestions.map(({ approved, editing, ...q }) => q),
        session?.token
      )
      setSavedCount(result.saved)
      setQuestions(qs => qs.filter(q => !q.approved))
    } catch (e) {
      setError(e.message || 'Failed to save questions.')
    } finally {
      setSaving(false)
    }
  }

  const diffColor = { EASY: 'var(--success)', MEDIUM: '#f59e0b', HARD: 'var(--danger)' }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>AI Question Generator</h1>
          <p className={styles.sub}>Upload a PDF or DOCX document to auto-generate MCQ questions using AI</p>
        </div>
      </div>

      {/* Upload card */}
      <div className={styles.uploadCard}>
        <div
          className={`${styles.dropzone} ${file ? styles.hasFile : ''}`}
          onClick={() => fileRef.current.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) { fileRef.current.files = e.dataTransfer.files; handleFileChange({ target: { files: [f] } }) } }}
        >
          <input ref={fileRef} type="file" accept=".pdf,.docx" onChange={handleFileChange} hidden />
          {file ? (
            <div className={styles.fileInfo}>
              <span className={styles.fileIcon}>{file.name.endsWith('.pdf') ? '📄' : '📝'}</span>
              <div>
                <p className={styles.fileName}>{file.name}</p>
                <p className={styles.fileSize}>{(file.size / 1024).toFixed(1)} KB</p>
              </div>
              <button className={styles.clearBtn} onClick={e => { e.stopPropagation(); setFile(null); setQuestions([]); setSavedCount(null); fileRef.current.value = '' }}>✕</button>
            </div>
          ) : (
            <div className={styles.dropPrompt}>
              <span className={styles.uploadIcon}>☁️</span>
              <p>Drag & drop or <span className={styles.browseLink}>browse</span></p>
              <p className={styles.hint}>Supports PDF and DOCX · Max 20MB</p>
            </div>
          )}
        </div>

        <div className={styles.controls}>
          <label className={styles.countLabel}>
            Questions to generate:
            <select className={styles.countSelect} value={count} onChange={e => setCount(Number(e.target.value))}>
            {[3, 5, 8, 10, 15, 20, 30, 50].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className={styles.countLabel}>
            Category:
            <select className={styles.countSelect} value={categoryId} onChange={e => setCategoryId(e.target.value)}>
              {categories.length === 0 && <option value="">No categories</option>}
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <button className={styles.generateBtn} onClick={handleGenerate} disabled={loading || !file}>
            {loading ? <><span className={styles.spinner} /> Generating…</> : '✨ Generate Questions'}
          </button>
        </div>

        {error && <p className={styles.error}>⚠ {error}</p>}
      </div>

      {/* Results */}
      {questions.length > 0 && (
        <div className={styles.results}>
          <div className={styles.resultsHeader}>
            <div>
              <h2 className={styles.resultsTitle}>Generated Questions</h2>
              <p className={styles.resultsSub}>{questions.length} questions · {approvedQuestions.length} approved</p>
            </div>
            <div className={styles.resultActions}>
              <button className={styles.approveAllBtn}
                onClick={() => setQuestions(qs => qs.map(q => ({ ...q, approved: true })))}>
                ✓ Approve All
              </button>
              <button className={styles.saveBtn} onClick={handleSaveAll} disabled={saving || approvedQuestions.length === 0}>
                {saving ? <><span className={styles.spinner} /> Saving…</> : `💾 Save ${approvedQuestions.length} to Question Bank`}
              </button>
            </div>
          </div>

          <div className={styles.questionList}>
            {questions.map((q, i) => (
              <div key={i} className={`${styles.qCard} ${q.approved ? styles.qApproved : ''}`}>
                <div className={styles.qTop}>
                  <div className={styles.qMeta}>
                    <span className={styles.qNum}>Q{i + 1}</span>
                    <span className={styles.diffBadge} style={{ background: diffColor[q.difficulty] + '22', color: diffColor[q.difficulty] }}>{q.difficulty}</span>
                    {q.subject && <span className={styles.subjectTag}>{q.subject}</span>}
                    {q.topic && <span className={styles.topicTag}>{q.topic}</span>}
                  </div>
                  <div className={styles.qActions}>
                    {!q.editing && <button className={styles.editBtn} onClick={() => startEdit(i)}>✏ Edit</button>}
                    {q.editing && <button className={styles.saveEditBtn} onClick={() => saveEdit(i)}>✓ Done</button>}
                    <button className={`${styles.approveBtn} ${q.approved ? styles.approved : ''}`} onClick={() => toggleApprove(i)}>
                      {q.approved ? '✓ Approved' : 'Approve'}
                    </button>
                    <button className={styles.deleteBtn} onClick={() => deleteQuestion(i)}>🗑</button>
                  </div>
                </div>

                {q.editing ? (
                  <div className={styles.editForm}>
                    <textarea className={styles.editText} value={q.text} onChange={e => updateField(i, 'text', e.target.value)} rows={2} />
                    <div className={styles.editOptions}>
                      {q.options.map((opt, oi) => (
                        <div key={oi} className={styles.editOption}>
                          <span className={`${styles.optLabel} ${oi === q.correctIndex ? styles.correctOpt : ''}`}>{String.fromCharCode(65 + oi)}</span>
                          <input className={styles.optInput} value={opt} onChange={e => updateOption(i, oi, e.target.value)} />
                          <button className={styles.setCorrectBtn} onClick={() => updateField(i, 'correctIndex', oi)}
                            title="Set as correct answer">
                            {oi === q.correctIndex ? '✓' : '○'}
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className={styles.editMeta}>
                      <select value={q.difficulty} onChange={e => updateField(i, 'difficulty', e.target.value)}>
                        {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                      <input placeholder="Subject" value={q.subject || ''} onChange={e => updateField(i, 'subject', e.target.value)} />
                      <input placeholder="Topic" value={q.topic || ''} onChange={e => updateField(i, 'topic', e.target.value)} />
                    </div>
                  </div>
                ) : (
                  <>
                    <p className={styles.qText}>{q.text}</p>
                    <div className={styles.options}>
                      {q.options.map((opt, oi) => (
                        <div key={oi} className={`${styles.option} ${oi === q.correctIndex ? styles.correct : ''}`}>
                          <span className={styles.optLetter}>{String.fromCharCode(65 + oi)}</span>
                          <span>{opt}</span>
                          {oi === q.correctIndex && <span className={styles.correctMark}>✓</span>}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {savedCount !== null && (
        <div className={styles.successBanner}>
          ✅ {savedCount} question{savedCount !== 1 ? 's' : ''} saved to the question bank successfully!
        </div>
      )}
    </div>
  )
}
