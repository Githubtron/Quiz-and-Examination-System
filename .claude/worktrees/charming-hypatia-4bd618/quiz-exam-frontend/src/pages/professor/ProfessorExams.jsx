import React, { useState, useEffect } from 'react'
import { categories as categoriesApi, exams as examsApi, notifications as notifApi } from '../../api/api'
import Badge from '../../components/Badge'
import Modal from '../../components/Modal'
import styles from './ProfessorExams.module.css'

function liveStatus(exam) {
  if (exam.status === 'DRAFT') return 'DRAFT'
  const now = new Date()
  if (exam.startDatetime && new Date(exam.startDatetime) > now) return 'SCHEDULED'
  if (exam.endDatetime && new Date(exam.endDatetime) < now) return 'ENDED'
  return 'ACTIVE'
}

const STATUS_VARIANT = { ACTIVE: 'success', DRAFT: 'default', SCHEDULED: 'warning', ENDED: 'danger' }
const WIZARD_STEPS = ['Exam Details', 'Schedule', 'Question Template']

const initialForm = {
  title: '',
  description: '',
  timeLimitMinutes: 30,
  marksPerQuestion: 4,
  negativeMarking: 0,
  adaptive: false,
  startDatetime: '',
  endDatetime: '',
  template: [{ categoryId: '', questionCount: 1 }],
}

export default function ProfessorExams() {
  const [exams, setExams] = useState([])
  const [categories, setCategories] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [form, setForm] = useState(initialForm)
  const [wizardStep, setWizardStep] = useState(0)

  useEffect(() => {
    Promise.all([examsApi.list(), categoriesApi.list()])
      .then(([examList, categoryList]) => {
        const cats = categoryList || []
        setExams(examList || [])
        setCategories(cats)
        if (cats.length > 0) {
          setForm(f => ({
            ...f,
            template: [{ categoryId: String(cats[0].id), questionCount: 1 }],
          }))
        }
      })
      .catch(e => setMsg(e.message))
      .finally(() => setLoading(false))
  }, [])

  const totalTemplateQuestions = form.template.reduce((sum, row) => {
    const count = Number(row.questionCount)
    return sum + (Number.isFinite(count) && count > 0 ? count : 0)
  }, 0)

  const resetWizardForm = () => {
    setForm({
      ...initialForm,
      template: categories.length > 0 ? [{ categoryId: String(categories[0].id), questionCount: 1 }] : [{ categoryId: '', questionCount: 1 }],
    })
    setWizardStep(0)
  }

  const openWizard = () => {
    resetWizardForm()
    setShowModal(true)
  }

  const closeWizard = () => {
    setShowModal(false)
    setWizardStep(0)
  }

  const validateStep = step => {
    if (step === 0) {
      if (!form.title.trim()) {
        setMsg('Exam title is required.')
        return false
      }
      if (Number(form.timeLimitMinutes) < 1 || Number(form.marksPerQuestion) < 1) {
        setMsg('Provide valid time limit and marks per question.')
        return false
      }
    }

    if (step === 2) {
      const validTemplate = form.template.filter(row => row.categoryId && Number(row.questionCount) > 0)
      if (validTemplate.length === 0) {
        setMsg('Add at least one valid category rule in the template.')
        return false
      }
      const unique = new Set(validTemplate.map(row => row.categoryId))
      if (unique.size !== validTemplate.length) {
        setMsg('Each category can appear only once in the template.')
        return false
      }
    }

    return true
  }

  const nextStep = () => {
    if (!validateStep(wizardStep)) return
    setWizardStep(s => Math.min(s + 1, WIZARD_STEPS.length - 1))
  }

  const prevStep = () => {
    setWizardStep(s => Math.max(0, s - 1))
  }

  const handleCreate = async e => {
    e.preventDefault()

    if (!validateStep(2)) return

    const validTemplate = form.template
      .filter(row => row.categoryId && Number(row.questionCount) > 0)
      .map(row => ({ categoryId: Number(row.categoryId), questionCount: Number(row.questionCount) }))

    try {
      const body = {
        title: form.title,
        description: form.description,
        timeLimitMinutes: Number(form.timeLimitMinutes),
        marksPerQuestion: Number(form.marksPerQuestion),
        negativeMarking: Number(form.negativeMarking),
        adaptive: form.adaptive,
        startDatetime: form.startDatetime || null,
        endDatetime: form.endDatetime || null,
        template: validTemplate,
      }

      const created = await examsApi.create(body)
      setExams(es => [...es, created])
      setMsg('Exam created.')
      closeWizard()
    } catch (err) {
      setMsg(err.message)
    }
  }

  const handlePublish = async id => {
    try {
      const updated = await examsApi.publish(id)
      setExams(es => es.map(e => (e.id === id ? updated : e)))
      await notifApi.notifyExamAvailable(id).catch(() => {})
      setMsg('Exam published and students notified.')
    } catch (err) {
      setMsg(err.message)
    }
  }

  const handleDelete = async id => {
    if (!confirm('Delete this exam?')) return
    try {
      await examsApi.delete(id)
      setExams(es => es.filter(e => e.id !== id))
      setMsg('Exam deleted.')
    } catch (err) {
      setMsg(err.message)
    }
  }

  const addTemplateRow = () => {
    setForm(f => ({
      ...f,
      template: [...f.template, { categoryId: categories[0] ? String(categories[0].id) : '', questionCount: 1 }],
    }))
  }

  const updateTemplateRow = (idx, key, value) => {
    setForm(f => ({
      ...f,
      template: f.template.map((row, i) => (i === idx ? { ...row, [key]: value } : row)),
    }))
  }

  const removeTemplateRow = idx => {
    setForm(f => ({
      ...f,
      template: f.template.filter((_, i) => i !== idx),
    }))
  }

  if (loading) return <div className={styles.page}><p>Loading exams…</p></div>

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Exam Management</h1>
          <p className={styles.sub}>{exams.length} exams</p>
        </div>
        <button className={styles.addBtn} onClick={openWizard} disabled={categories.length === 0}>
          + Create Exam
        </button>
      </div>

      {categories.length === 0 && (
        <div className={styles.warn}>Create categories before creating template-based exams.</div>
      )}

      {msg && <div className={styles.msg} onClick={() => setMsg('')}>{msg}</div>}

      <div className={styles.examGrid}>
        {exams.map(e => {
          const status = liveStatus(e)
          return (
            <div key={e.id} className={styles.examCard}>
              <div className={styles.examTop}>
                <Badge variant={STATUS_VARIANT[status]}>{status}</Badge>
                {e.adaptive && <Badge variant="info">ADAPTIVE</Badge>}
              </div>
              <h3 className={styles.examTitle}>{e.title}</h3>
              <p className={styles.examDesc}>{e.description}</p>
              <div className={styles.examMeta}>
                <span>⏱ {e.timeLimitMinutes} min</span>
                <span>📝 {e.totalQuestions ?? 0} questions</span>
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
        {exams.length === 0 && <p className={styles.empty}>No exams yet. Create one to get started.</p>}
      </div>

      <Modal open={showModal} onClose={closeWizard} title="Create Exam Wizard" size="lg">
        <form onSubmit={handleCreate} className={styles.form}>
          <div className={styles.wizardHead}>
            <div className={styles.stepTrack}>
              <div className={styles.stepFill} style={{ width: `${((wizardStep + 1) / WIZARD_STEPS.length) * 100}%` }} />
            </div>
            <div className={styles.stepList}>
              {WIZARD_STEPS.map((step, idx) => (
                <div key={step} className={`${styles.stepItem} ${idx <= wizardStep ? styles.stepActive : ''}`}>
                  <span>{idx + 1}</span>
                  <p>{step}</p>
                </div>
              ))}
            </div>
          </div>

          {wizardStep === 0 && (
            <div className={styles.stepPanel}>
              <div className={styles.floatingField}>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder=" " required />
                <label>Exam Title</label>
              </div>

              <div className={styles.floatingField}>
                <textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder=" " />
                <label>Description</label>
              </div>

              <div className={styles.formRow}>
                <div className={styles.floatingField}>
                  <input
                    type="number"
                    min={1}
                    value={form.timeLimitMinutes}
                    onChange={e => setForm(f => ({ ...f, timeLimitMinutes: e.target.value }))}
                    placeholder=" "
                    required
                  />
                  <label>Time Limit (min)</label>
                </div>

                <div className={styles.floatingField}>
                  <input
                    type="number"
                    min={1}
                    value={form.marksPerQuestion}
                    onChange={e => setForm(f => ({ ...f, marksPerQuestion: e.target.value }))}
                    placeholder=" "
                    required
                  />
                  <label>Marks per Question</label>
                </div>

                <div className={styles.floatingField}>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={form.negativeMarking}
                    onChange={e => setForm(f => ({ ...f, negativeMarking: e.target.value }))}
                    placeholder=" "
                  />
                  <label>Negative Marking</label>
                </div>
              </div>

              <label className={styles.checkLabel}>
                <input type="checkbox" checked={form.adaptive} onChange={e => setForm(f => ({ ...f, adaptive: e.target.checked }))} />
                Enable Adaptive Exam
              </label>
            </div>
          )}

          {wizardStep === 1 && (
            <div className={styles.stepPanel}>
              <div className={styles.formRow}>
                <div className={styles.floatingField}>
                  <input
                    type="datetime-local"
                    value={form.startDatetime}
                    onChange={e => setForm(f => ({ ...f, startDatetime: e.target.value }))}
                    placeholder=" "
                  />
                  <label>Start Date/Time</label>
                </div>
                <div className={styles.floatingField}>
                  <input
                    type="datetime-local"
                    value={form.endDatetime}
                    onChange={e => setForm(f => ({ ...f, endDatetime: e.target.value }))}
                    placeholder=" "
                  />
                  <label>End Date/Time</label>
                </div>
              </div>
            </div>
          )}

          {wizardStep === 2 && (
            <div className={styles.stepPanel}>
              <div className={styles.templateHeader}>
                <h4>Question Paper Template</h4>
                <button type="button" className={styles.addRuleBtn} onClick={addTemplateRow}>+ Add Rule</button>
              </div>

              <div className={styles.templateList}>
                {form.template.map((row, idx) => (
                  <div key={idx} className={styles.templateRow}>
                    <select
                      value={row.categoryId}
                      onChange={e => updateTemplateRow(idx, 'categoryId', e.target.value)}
                      required
                    >
                      <option value="">Select category</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>

                    <input
                      type="number"
                      min={1}
                      value={row.questionCount}
                      onChange={e => updateTemplateRow(idx, 'questionCount', e.target.value)}
                      required
                    />

                    <button
                      type="button"
                      className={styles.removeRuleBtn}
                      onClick={() => removeTemplateRow(idx)}
                      disabled={form.template.length === 1}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <p className={styles.templateTotal}>Total questions: <strong>{totalTemplateQuestions}</strong></p>
            </div>
          )}

          <div className={styles.modalActions}>
            <button type="button" className={styles.cancelBtn} onClick={closeWizard}>Cancel</button>

            {wizardStep > 0 && (
              <button type="button" className={styles.backBtn} onClick={prevStep}>Back</button>
            )}

            {wizardStep < WIZARD_STEPS.length - 1 ? (
              <button type="button" className={styles.nextBtn} onClick={nextStep}>Next</button>
            ) : (
              <button type="submit" className={styles.submitBtn}>Create Exam</button>
            )}
          </div>
        </form>
      </Modal>
    </div>
  )
}
