import { useEffect, useRef, useState } from 'react'
import { categories as categoriesApi, exams as examsApi, questions as questionsApi } from '../../api/api'
import styles from './CreateExamFromPdf.module.css'

const TOTAL_QUESTION_OPTIONS = [5, 10, 15, 20]
const DIFFICULTY_OPTIONS = ['EASY', 'MEDIUM', 'HARD', 'MIXED']

function extractTitleFromFilename(filename) {
  if (!filename) return ''
  const dot = filename.lastIndexOf('.')
  return dot > 0 ? filename.slice(0, dot) : filename
}

export default function CreateExamFromPdf() {
  const [file, setFile] = useState(null)
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [createdExam, setCreatedExam] = useState(null)
  const [detectedCategory, setDetectedCategory] = useState(null)
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [questions, setQuestions] = useState([])
  const fileRef = useRef(null)

  const [form, setForm] = useState({
    examTitle: '',
    duration: 30,
    totalQuestions: 10,
    difficulty: 'MIXED',
    startDatetime: '',
    endDatetime: '',
  })

  useEffect(() => {
    categoriesApi.list()
      .then(list => setCategories(list || []))
      .catch(() => {})
  }, [])

  const handleFileChange = (event) => {
    const picked = event.target.files?.[0]
    if (!picked) return
    if (!picked.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF files are supported.')
      return
    }
    setFile(picked)
    setError('')
    setMessage('')
    setCreatedExam(null)
    setQuestions([])
    setDetectedCategory(null)
    setSelectedCategoryId('')
    setForm(prev => ({ ...prev, examTitle: extractTitleFromFilename(picked.name) }))
  }

  const handleGenerateExam = async () => {
    if (!file) {
      setError('Please upload a PDF first.')
      return
    }

    setLoading(true)
    setError('')
    setMessage('')

    try {
      const payload = new FormData()
      payload.append('file', file)
      payload.append('title', form.examTitle || extractTitleFromFilename(file.name))
      payload.append('duration', String(form.duration))
      payload.append('questionCount', String(form.totalQuestions))
      payload.append('difficulty', form.difficulty)

      const result = await examsApi.createFromPdf(payload)
      const exam = result.exam
      const category = result.detectedCategory

      setCreatedExam(exam)
      setDetectedCategory(category || null)
      setSelectedCategoryId(category ? String(category.id) : '')
      if (category) {
        setCategories(prev => prev.some(existing => existing.id === category.id) ? prev : [...prev, category])
      }
      setQuestions((result.questions || []).map(q => ({ ...q, approved: true, editing: false })))
      setForm(prev => ({
        ...prev,
        examTitle: exam.title,
        duration: exam.timeLimitMinutes,
        startDatetime: exam.startDatetime ? exam.startDatetime.slice(0, 16) : '',
        endDatetime: exam.endDatetime ? exam.endDatetime.slice(0, 16) : '',
      }))
      setMessage('Exam generated and saved as draft.')
    } catch (e) {
      setError(e.message || 'Failed to generate exam from PDF.')
    } finally {
      setLoading(false)
    }
  }

  const updateQuestionField = (index, key, value) => {
    setQuestions(prev => prev.map((q, i) => (i === index ? { ...q, [key]: value } : q)))
  }

  const updateQuestionOption = (index, optionIndex, value) => {
    setQuestions(prev => prev.map((q, i) => {
      if (i !== index) return q
      const nextOptions = [...q.options]
      nextOptions[optionIndex] = value
      return { ...q, options: nextOptions }
    }))
  }

  const saveQuestionEdit = async (index) => {
    const q = questions[index]
    if (!q) return
    if (!selectedCategoryId) {
      setError('Select a category before saving question edits.')
      return
    }
    try {
      await questionsApi.updateMCQ(q.id, {
        text: q.question,
        options: q.options,
        correctIndex: q.correctIndex,
        difficulty: q.difficulty,
        subject: detectedCategory?.name || '',
        topic: q.topic,
        explanation: q.explanation,
        categoryId: Number(selectedCategoryId),
      })
      updateQuestionField(index, 'editing', false)
      setMessage('Question updated.')
      setError('')
    } catch (e) {
      setError(e.message || 'Failed to update question.')
    }
  }

  const deleteQuestion = async (index) => {
    const q = questions[index]
    if (!q) return
    try {
      await questionsApi.delete(q.id)
      setQuestions(prev => prev.filter((_, i) => i !== index))
      setMessage('Question deleted.')
      setError('')
    } catch (e) {
      setError(e.message || 'Failed to delete question.')
    }
  }

  const applyCategoryOverride = async () => {
    if (!createdExam || !selectedCategoryId) return
    try {
      const result = await examsApi.updateAutoCategory(createdExam.id, Number(selectedCategoryId))
      setCreatedExam(result.exam)
      if (result.category) setDetectedCategory(result.category)
      setMessage('Category updated for generated questions.')
      setError('')
    } catch (e) {
      setError(e.message || 'Failed to update category.')
    }
  }

  const saveDraft = async () => {
    if (!createdExam) return null
    const approvedIds = questions.filter(q => q.approved).map(q => q.id)
    if (approvedIds.length === 0) {
      setError('Approve at least one question before saving.')
      return null
    }

    setSaving(true)
    try {
      const updated = await examsApi.update(createdExam.id, {
        title: form.examTitle,
        description: `Auto-generated from PDF: ${createdExam.sourcePdf || file?.name || 'document.pdf'}`,
        timeLimitMinutes: Number(form.duration),
        marksPerQuestion: createdExam.marksPerQuestion || 1,
        negativeMarking: createdExam.negativeMarking || 0,
        adaptive: false,
        startDatetime: form.startDatetime || null,
        endDatetime: form.endDatetime || null,
        questionIds: approvedIds,
      })
      setCreatedExam(updated)
      setMessage('Draft saved successfully.')
      setError('')
      return updated
    } catch (e) {
      setError(e.message || 'Failed to save draft.')
      return null
    } finally {
      setSaving(false)
    }
  }

  const publishExam = async () => {
    if (!createdExam) return
    const updatedDraft = await saveDraft()
    if (!updatedDraft) return

    setSaving(true)
    try {
      const published = await examsApi.publish(updatedDraft.id)
      setCreatedExam(published)
      setMessage('Exam published successfully.')
      setError('')
    } catch (e) {
      setError(e.message || 'Failed to publish exam.')
    } finally {
      setSaving(false)
    }
  }

  const approvedCount = questions.filter(q => q.approved).length

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Create Exam from PDF</h1>
        <p>Upload a PDF, auto-categorize, generate questions, and publish.</p>
      </div>

      <div className={styles.card}>
        <div
          className={styles.dropzone}
          onClick={() => fileRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault()
            const dropped = e.dataTransfer.files?.[0]
            if (dropped) handleFileChange({ target: { files: [dropped] } })
          }}
        >
          <input ref={fileRef} hidden type="file" accept=".pdf" onChange={handleFileChange} />
          {!file ? <p>Drag & drop a PDF or click to browse</p> : <p>📄 {file.name}</p>}
        </div>

        <div className={styles.formRow}>
          <label>
            Exam title
            <input
              value={form.examTitle}
              onChange={e => setForm(prev => ({ ...prev, examTitle: e.target.value }))}
              placeholder="Exam title"
            />
          </label>
          <label>
            Duration (minutes)
            <input
              type="number"
              min={1}
              value={form.duration}
              onChange={e => setForm(prev => ({ ...prev, duration: Number(e.target.value) || 1 }))}
            />
          </label>
          <label>
            Number of questions
            <select
              value={form.totalQuestions}
              onChange={e => setForm(prev => ({ ...prev, totalQuestions: Number(e.target.value) }))}
            >
              {TOTAL_QUESTION_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>
            Difficulty
            <select
              value={form.difficulty}
              onChange={e => setForm(prev => ({ ...prev, difficulty: e.target.value }))}
            >
              {DIFFICULTY_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        </div>

        <button className={styles.primaryBtn} disabled={loading || !file} onClick={handleGenerateExam}>
          {loading ? 'Analyzing document and generating questions...' : 'Generate Exam'}
        </button>
      </div>

      {error && <div className={styles.error}>{error}</div>}
      {message && <div className={styles.message}>{message}</div>}

      {createdExam && (
        <div className={styles.card}>
          <div className={styles.sectionHeader}>
            <h2>Generated Exam Details</h2>
            <span className={styles.badge}>{createdExam.status}</span>
          </div>

          <div className={styles.formRow}>
            <label>
              Detected category
              <select value={selectedCategoryId} onChange={e => setSelectedCategoryId(e.target.value)}>
                <option value="">Select category</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </label>
            <button className={styles.secondaryBtn} onClick={applyCategoryOverride} disabled={!selectedCategoryId}>
              Apply Category
            </button>
            {detectedCategory && <p className={styles.hint}>Current: {detectedCategory.name}</p>}
          </div>

          <div className={styles.formRow}>
            <label>
              Title
              <input value={form.examTitle} onChange={e => setForm(prev => ({ ...prev, examTitle: e.target.value }))} />
            </label>
            <label>
              Duration (minutes)
              <input
                type="number"
                min={1}
                value={form.duration}
                onChange={e => setForm(prev => ({ ...prev, duration: Number(e.target.value) || 1 }))}
              />
            </label>
            <label>
              Start time
              <input
                type="datetime-local"
                value={form.startDatetime}
                onChange={e => setForm(prev => ({ ...prev, startDatetime: e.target.value }))}
              />
            </label>
            <label>
              End time
              <input
                type="datetime-local"
                value={form.endDatetime}
                onChange={e => setForm(prev => ({ ...prev, endDatetime: e.target.value }))}
              />
            </label>
          </div>

          <div className={styles.actions}>
            <button className={styles.secondaryBtn} onClick={saveDraft} disabled={saving || questions.length === 0}>
              Save as Draft
            </button>
            <button className={styles.primaryBtn} onClick={publishExam} disabled={saving || questions.length === 0}>
              Publish Exam
            </button>
          </div>

          <p className={styles.hint}>
            {questions.length} generated questions · {approvedCount} approved for final exam
          </p>

          <div className={styles.questionList}>
            {questions.map((q, index) => (
              <div key={q.id} className={styles.questionCard}>
                <div className={styles.questionTop}>
                  <strong>Q{index + 1}</strong>
                  <div className={styles.questionActions}>
                    {!q.editing && (
                      <button className={styles.smallBtn} onClick={() => updateQuestionField(index, 'editing', true)}>
                        Edit
                      </button>
                    )}
                    {q.editing && (
                      <button className={styles.smallBtn} onClick={() => saveQuestionEdit(index)}>
                        Save
                      </button>
                    )}
                    <button
                      className={styles.smallBtn}
                      onClick={() => updateQuestionField(index, 'approved', !q.approved)}
                    >
                      {q.approved ? 'Approved' : 'Approve'}
                    </button>
                    <button className={styles.dangerBtn} onClick={() => deleteQuestion(index)}>Delete</button>
                  </div>
                </div>

                {q.editing ? (
                  <div className={styles.editBox}>
                    <textarea
                      value={q.question}
                      rows={2}
                      onChange={e => updateQuestionField(index, 'question', e.target.value)}
                    />
                    {q.options.map((option, optionIndex) => (
                      <div key={optionIndex} className={styles.optionEditRow}>
                        <span>{String.fromCharCode(65 + optionIndex)}.</span>
                        <input
                          value={option}
                          onChange={e => updateQuestionOption(index, optionIndex, e.target.value)}
                        />
                        <button
                          className={styles.smallBtn}
                          onClick={() => updateQuestionField(index, 'correctIndex', optionIndex)}
                        >
                          {q.correctIndex === optionIndex ? 'Correct' : 'Set Correct'}
                        </button>
                      </div>
                    ))}
                    <div className={styles.formRow}>
                      <label>
                        Difficulty
                        <select
                          value={q.difficulty}
                          onChange={e => updateQuestionField(index, 'difficulty', e.target.value)}
                        >
                          {['EASY', 'MEDIUM', 'HARD'].map(level => <option key={level} value={level}>{level}</option>)}
                        </select>
                      </label>
                      <label>
                        Topic
                        <input value={q.topic || ''} onChange={e => updateQuestionField(index, 'topic', e.target.value)} />
                      </label>
                    </div>
                    <label>
                      Explanation
                      <textarea
                        value={q.explanation || ''}
                        rows={2}
                        onChange={e => updateQuestionField(index, 'explanation', e.target.value)}
                      />
                    </label>
                  </div>
                ) : (
                  <div>
                    <p className={styles.questionText}>{q.question}</p>
                    <ul className={styles.options}>
                      {q.options.map((option, optionIndex) => (
                        <li key={optionIndex} className={q.correctIndex === optionIndex ? styles.correctOption : ''}>
                          <span>{String.fromCharCode(65 + optionIndex)}.</span> {option}
                        </li>
                      ))}
                    </ul>
                    <p className={styles.explanation}><strong>Explanation:</strong> {q.explanation || '—'}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
