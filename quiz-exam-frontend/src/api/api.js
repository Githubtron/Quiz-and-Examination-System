/**
 * Central API client — all calls to the Spring Boot backend go through here.
 * Base URL: http://localhost:8080
 */
import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080'

function getToken() {
  const s = localStorage.getItem('qm_session')
  return s ? JSON.parse(s).token : null
}

async function request(method, path, body) {
  const token = getToken()
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    if (res.status === 401) {
      // Token is expired or invalid. Clear session and reload.
      localStorage.removeItem('qm_session')
      window.dispatchEvent(new Event('storage')) // Trigger auth context update if listening, or just force reload
      if (window.location.pathname !== '/login' && window.location.pathname !== '/landing') {
        window.location.href = '/login'
      }
    }
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || `Request failed: ${res.status}`)
  }
  // 204 No Content
  if (res.status === 204) return null
  return res.json()
}

async function multipartRequest(method, path, formData) {
  const token = getToken()
  try {
    const response = await axios({
      method,
      url: `${BASE}${path}`,
      data: formData,
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
        // Do NOT set Content-Type for FormData - browser auto-sets it with boundary
      },
    })
    return response.data
  } catch (error) {
    const serverError = error?.response?.data?.error
    const status = error?.response?.status
    throw new Error(serverError || `Request failed: ${status || 'network error'}`)
  }
}

async function download(path) {
  const token = getToken()
  const headers = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${BASE}${path}`, { headers })
  if (!res.ok) throw new Error(`Download failed: ${res.status}`)
  return res.blob()
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export const auth = {
  login: (username, password) => request('POST', '/api/auth/login', { username, password }),
  register: (username, email, password, role) =>
    request('POST', '/api/auth/register', { username, email, password, role }),
}

// ── Users ─────────────────────────────────────────────────────────────────────
export const users = {
  me: () => request('GET', '/api/users/me'),
  updateMe: (updates) => request('PUT', '/api/users/me', updates),
  list: () => request('GET', '/api/users'),
  delete: (id) => request('DELETE', `/api/users/${id}`),
  createAdmin: (body) => request('POST', '/api/users/admin', body),
}

// ── Questions ─────────────────────────────────────────────────────────────────
export const questions = {
  list: (params = {}) => {
    const q = new URLSearchParams(params).toString()
    return request('GET', `/api/questions${q ? '?' + q : ''}`)
  },
  get: (id) => request('GET', `/api/questions/${id}`),
  createMCQ: (body) => request('POST', '/api/questions/mcq', body),
  updateMCQ: (id, body) => request('PUT', `/api/questions/mcq/${id}`, body),
  createTF: (body) => request('POST', '/api/questions/tf', body),
  createAR: (body) => request('POST', '/api/questions/ar', body),
  delete: (id) => request('DELETE', `/api/questions/${id}`),
  saveGenerated: (body) => request('POST', '/api/questions/save-generated', body),
}

// ── Categories ────────────────────────────────────────────────────────────────
export const categories = {
  list: () => request('GET', '/api/categories'),
  get: (id) => request('GET', `/api/categories/${id}`),
  create: (body) => request('POST', '/api/categories', body),
  update: (id, body) => request('PUT', `/api/categories/${id}`, body),
  delete: (id) => request('DELETE', `/api/categories/${id}`),
}

// ── Exams ─────────────────────────────────────────────────────────────────────
export const exams = {
  list: () => request('GET', '/api/exams'),
  listActive: () => request('GET', '/api/exams/active'),
  get: (id) => request('GET', `/api/exams/${id}`),
  templates: (id) => request('GET', `/api/exams/${id}/templates`),
  create: (body) => request('POST', '/api/exams', body),
  createFromPdf: (formData) => multipartRequest('POST', '/api/exams/create-from-pdf', formData),
  update: (id, body) => request('PUT', `/api/exams/${id}`, body),
  updateAutoCategory: (id, categoryId) => request('PUT', `/api/exams/${id}/auto-category`, { categoryId }),
  publish: (id) => request('PUT', `/api/exams/${id}/publish`),
  delete: (id) => request('DELETE', `/api/exams/${id}`),
}

// ── Attempts ──────────────────────────────────────────────────────────────────
export const attempts = {
  start: (examId) => request('POST', `/api/attempts/start/${examId}`),
  submit: (attemptId, answers) => request('POST', `/api/attempts/${attemptId}/submit`, { answers }),
  tabSwitch: (attemptId) => request('POST', `/api/attempts/${attemptId}/tab-switch`),
  myAttempts: () => request('GET', '/api/attempts/my'),
}

// ── Results ───────────────────────────────────────────────────────────────────
export const results = {
  my: () => request('GET', '/api/results/my'),
  byExam: (examId) => request('GET', `/api/results/exam/${examId}`),
  all: () => request('GET', '/api/results'),
  get: (id) => request('GET', `/api/results/${id}`),
  exportCsv: (examId) => download(`/api/results/exam/${examId}/export/csv`),
  exportPdf: (examId) => download(`/api/results/exam/${examId}/export/pdf`),
  exportSinglePdf: (id) => download(`/api/results/${id}/export/pdf`),
}

// ── Analytics ─────────────────────────────────────────────────────────────────
export const analytics = {
  examStats: (examId) => request('GET', `/api/analytics/exam/${examId}/stats`),
  hardestQuestions: (examId, limit = 5) =>
    request('GET', `/api/analytics/exam/${examId}/hardest-questions?limit=${limit}`),
  studentProgress: (studentId) => request('GET', `/api/analytics/student/${studentId}/progress`),
  scoreDistribution: (examId) => request('GET', `/api/analytics/exam/${examId}/score-distribution`),
}

// ── Notifications ─────────────────────────────────────────────────────────────
export const notifications = {
  list: () => request('GET', '/api/notifications'),
  unreadCount: () => request('GET', '/api/notifications/unread-count'),
  markRead: (id) => request('PUT', `/api/notifications/${id}/read`),
  markAllRead: () => request('PUT', '/api/notifications/read-all'),
  notifyExamAvailable: (examId) => request('POST', `/api/notifications/exam-available/${examId}`),
  notifyResultsPublished: (examId) => request('POST', `/api/notifications/results-published/${examId}`),
}

// ── Adaptive ──────────────────────────────────────────────────────────────────
export const adaptive = {
  nextQuestion: (attemptId) => request('GET', `/api/adaptive/${attemptId}/next`),
}

// ── Helpers ───────────────────────────────────────────────────────────────────
export function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
