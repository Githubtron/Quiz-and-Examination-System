import React, { useState, useEffect, useCallback } from 'react'
import { exams as examsApi, users as usersApi, papers as papersApi } from '../../api/api'
import styles from './ProfessorPapers.module.css'

const DIFFICULTY_COLOR = { EASY: '#16a34a', MEDIUM: '#d97706', HARD: '#dc2626' }

function printPaper(paperData) {
  const w = window.open('', '_blank', 'width=900,height=700')
  if (!w) return

  const optionLetters = ['A', 'B', 'C', 'D', 'E']
  const questionsHtml = paperData.questions.map(q => {
    const optionsHtml = (q.options || []).map((opt, i) =>
      `<div class="option"><span class="optLetter">${optionLetters[i] || i + 1}.</span> ${opt}</div>`
    ).join('')

    let body = ''
    if (q.type === 'AR') {
      body = `
        <div class="ar-block">
          <div><strong>Assertion (A):</strong> ${q.assertion || ''}</div>
          <div><strong>Reason (R):</strong> ${q.reason || ''}</div>
        </div>
        ${optionsHtml}`
    } else {
      body = optionsHtml
    }

    const diffBadge = q.difficulty
      ? `<span class="diff-badge diff-${q.difficulty.toLowerCase()}">${q.difficulty}</span>` : ''
    const catBadge = q.categoryName
      ? `<span class="cat-badge">${q.categoryName}</span>` : ''

    return `
      <div class="question">
        <div class="q-header">
          <span class="q-num">Q${q.number}.</span>
          <span class="q-meta">${catBadge}${diffBadge}</span>
        </div>
        <div class="q-text">${q.text}</div>
        ${body}
      </div>`
  }).join('')

  w.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${paperData.label} — ${paperData.examTitle}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Times New Roman', serif; font-size: 12pt; color: #111; padding: 20mm; }
    .header { text-align: center; border-bottom: 2px solid #111; padding-bottom: 10px; margin-bottom: 18px; }
    .header h1 { font-size: 16pt; font-weight: bold; }
    .header h2 { font-size: 13pt; margin-top: 4px; }
    .meta { display: flex; justify-content: space-between; font-size: 10pt; margin-bottom: 18px; }
    .instructions { background: #f5f5f5; border: 1px solid #ccc; padding: 10px 14px; margin-bottom: 20px; font-size: 10pt; }
    .question { margin-bottom: 20px; page-break-inside: avoid; }
    .q-header { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
    .q-num { font-weight: bold; font-size: 11pt; }
    .q-meta { display: flex; gap: 4px; }
    .cat-badge { font-size: 8pt; background: #e8f4fd; border: 1px solid #90caf9; border-radius: 3px; padding: 1px 5px; }
    .diff-badge { font-size: 8pt; border-radius: 3px; padding: 1px 5px; color: #fff; }
    .diff-easy { background: #16a34a; }
    .diff-medium { background: #d97706; }
    .diff-hard { background: #dc2626; }
    .q-text { font-size: 11pt; margin-bottom: 8px; line-height: 1.5; }
    .option { margin-left: 16px; margin-bottom: 4px; font-size: 10pt; }
    .optLetter { font-weight: bold; margin-right: 4px; }
    .ar-block { background: #fafafa; border-left: 3px solid #666; padding: 8px 12px; margin-bottom: 10px; font-size: 10pt; line-height: 1.6; }
    .ar-block div { margin-bottom: 4px; }
    .footer { text-align: center; margin-top: 30px; font-size: 9pt; color: #555; border-top: 1px solid #ccc; padding-top: 8px; }
    @media print { body { padding: 12mm; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>${paperData.examTitle}</h1>
    <h2>Question Paper — Student: ${paperData.label}</h2>
  </div>
  <div class="meta">
    <span>Total Questions: ${paperData.questions.length}</span>
    <span>Total Marks: ${paperData.questions.length * paperData.marksPerQuestion}</span>
    <span>Time Allowed: ${paperData.timeLimitMinutes} minutes</span>
    <span>Marks per Question: ${paperData.marksPerQuestion}</span>
  </div>
  <div class="instructions">
    <strong>Instructions:</strong> Attempt all questions. Each question carries ${paperData.marksPerQuestion} mark(s).
    Do not write your name anywhere on the answer sheet.
  </div>
  ${questionsHtml}
  <div class="footer">— End of Question Paper (${paperData.label}) —</div>
  <script>window.onload = function() { window.print(); }<\/script>
</body>
</html>`)
  w.document.close()
}

export default function ProfessorPapers() {
  const [exams, setExams] = useState([])
  const [students, setStudents] = useState([])
  const [selectedExamId, setSelectedExamId] = useState('')
  const [selectedStudentIds, setSelectedStudentIds] = useState([])
  const [generatedPapers, setGeneratedPapers] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingExport, setLoadingExport] = useState(null)
  const [msg, setMsg] = useState('')
  const [init, setInit] = useState(true)

  useEffect(() => {
    Promise.all([examsApi.list(), usersApi.listStudents()])
      .then(([examList, studentList]) => {
        setExams(examList || [])
        setStudents(studentList || [])
        if (examList?.length) setSelectedExamId(String(examList[0].id))
      })
      .catch(e => setMsg(e.message))
      .finally(() => setInit(false))
  }, [])

  const loadExistingPapers = useCallback((examId) => {
    if (!examId) return
    papersApi.list(examId)
      .then(list => setGeneratedPapers(list || []))
      .catch(() => setGeneratedPapers([]))
  }, [])

  useEffect(() => {
    if (selectedExamId) loadExistingPapers(selectedExamId)
  }, [selectedExamId, loadExistingPapers])

  const toggleStudent = (id) => {
    setSelectedStudentIds(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    )
  }

  const selectAll = () => setSelectedStudentIds(students.map(s => s.id))
  const selectNone = () => setSelectedStudentIds([])

  const handleGenerate = async () => {
    if (!selectedExamId) { setMsg('Select an exam first.'); return }
    if (selectedStudentIds.length === 0) { setMsg('Select at least one student.'); return }
    setLoading(true)
    setMsg('')
    try {
      const summaries = await papersApi.batchGenerate(Number(selectedExamId), selectedStudentIds)
      setGeneratedPapers(summaries)
      const failed = summaries.filter(s => s.status.startsWith('FAILED'))
      if (failed.length === 0) {
        setMsg(`Generated ${summaries.length} unique paper(s) successfully.`)
      } else {
        setMsg(`Generated ${summaries.length - failed.length} paper(s). ${failed.length} failed.`)
      }
    } catch (e) {
      setMsg('Error: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = async (studentId, label) => {
    setLoadingExport(studentId)
    try {
      const data = await papersApi.export(Number(selectedExamId), studentId, label)
      printPaper(data)
    } catch (e) {
      setMsg('Export failed: ' + e.message)
    } finally {
      setLoadingExport(null)
    }
  }

  const selectedExam = exams.find(e => String(e.id) === selectedExamId)
  const totalMarks = selectedExam
    ? selectedExam.totalQuestions * selectedExam.marksPerQuestion
    : 0

  if (init) return <div className={styles.loading}>Loading...</div>

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <h1 className={styles.title}>Generate Question Papers</h1>
        <p className={styles.subtitle}>
          Batch-generate unique randomised papers per student with automatic difficulty balancing (40% Easy · 40% Medium · 20% Hard).
        </p>
      </header>

      {msg && (
        <div className={`${styles.alert} ${msg.startsWith('Error') || msg.includes('failed') ? styles.alertError : styles.alertSuccess}`}>
          {msg}
        </div>
      )}

      <div className={styles.grid}>
        {/* Left: configuration */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>1. Select Exam</h2>
          <select
            className={styles.select}
            value={selectedExamId}
            onChange={e => { setSelectedExamId(e.target.value); setGeneratedPapers([]) }}
          >
            {exams.map(ex => (
              <option key={ex.id} value={ex.id}>
                {ex.title} ({ex.totalQuestions}Q × {ex.marksPerQuestion}M = {ex.totalQuestions * ex.marksPerQuestion} marks)
              </option>
            ))}
          </select>

          {selectedExam && (
            <div className={styles.examMeta}>
              <span className={`${styles.pill} ${selectedExam.status === 'ACTIVE' ? styles.pillGreen : styles.pillGray}`}>
                {selectedExam.status}
              </span>
              <span className={styles.pillBlue}>{selectedExam.timeLimitMinutes} min</span>
              <span className={styles.pillBlue}>{totalMarks} total marks</span>
            </div>
          )}

          <h2 className={styles.cardTitle} style={{ marginTop: 24 }}>2. Select Students</h2>
          <div className={styles.studentActions}>
            <button className={styles.linkBtn} onClick={selectAll}>Select all ({students.length})</button>
            <span className={styles.dot}>·</span>
            <button className={styles.linkBtn} onClick={selectNone}>Clear</button>
            <span className={styles.count}>{selectedStudentIds.length} selected</span>
          </div>

          <div className={styles.studentList}>
            {students.length === 0 && (
              <p className={styles.empty}>No student accounts found. Register students first.</p>
            )}
            {students.map((s, i) => (
              <label key={s.id} className={styles.studentRow}>
                <input
                  type="checkbox"
                  checked={selectedStudentIds.includes(s.id)}
                  onChange={() => toggleStudent(s.id)}
                />
                <span className={styles.studentLabel}>S{i + 1}</span>
                <span className={styles.studentName}>{s.username}</span>
                <span className={styles.studentEmail}>{s.email}</span>
              </label>
            ))}
          </div>

          <button
            className={styles.generateBtn}
            onClick={handleGenerate}
            disabled={loading || !selectedExamId || selectedStudentIds.length === 0}
          >
            {loading ? 'Generating...' : `Generate ${selectedStudentIds.length} Paper(s)`}
          </button>
        </section>

        {/* Right: generated papers */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Generated Papers</h2>
          {generatedPapers.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>📄</div>
              <p>No papers generated yet. Select an exam and students, then click Generate.</p>
            </div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Label</th>
                    <th>Student ID</th>
                    <th>Questions</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {generatedPapers.map(p => (
                    <tr key={p.paperId} className={p.status.startsWith('FAILED') ? styles.rowFailed : ''}>
                      <td><span className={styles.labelBadge}>{p.label}</span></td>
                      <td className={styles.muted}>{p.studentId}</td>
                      <td>{p.questionCount}</td>
                      <td>
                        <span className={`${styles.statusBadge} ${p.status.startsWith('FAILED') ? styles.statusFail : styles.statusOk}`}>
                          {p.status.startsWith('FAILED') ? 'FAILED' : 'READY'}
                        </span>
                      </td>
                      <td>
                        {!p.status.startsWith('FAILED') && (
                          <button
                            className={styles.printBtn}
                            onClick={() => handlePrint(p.studentId, p.label)}
                            disabled={loadingExport === p.studentId}
                          >
                            {loadingExport === p.studentId ? '...' : 'Print'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className={styles.tableNote}>
                Each paper has unique question selection and option ordering. Papers are reusable — re-generating will keep existing papers for students who already have one.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
