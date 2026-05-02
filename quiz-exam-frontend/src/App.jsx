import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import Navbar from './components/Navbar'

import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import LandingPage from './pages/LandingPage'

import AdminDashboard from './pages/admin/AdminDashboard'
import AdminUsers from './pages/admin/AdminUsers'
import AdminAnalytics from './pages/admin/AdminAnalytics'
import AdminResults from './pages/admin/AdminResults'

import ProfessorDashboard from './pages/professor/ProfessorDashboard'
import ProfessorQuestions from './pages/professor/ProfessorQuestions'
import ProfessorExams from './pages/professor/ProfessorExams'
import ProfessorResults from './pages/professor/ProfessorResults'
import GenerateQuestions from './pages/professor/GenerateQuestions'
import ProfessorCategories from './pages/professor/ProfessorCategories'
import CreateExamFromPdf from './pages/professor/CreateExamFromPdf'

import StudentDashboard from './pages/student/StudentDashboard'
import StudentExams from './pages/student/StudentExams'
import StudentResults from './pages/student/StudentResults'
import ExamAttempt from './pages/student/ExamAttempt'
import ProfilePage from './pages/ProfilePage'

function ProtectedRoute({ children, allowedRoles }) {
  const { session } = useAuth()
  if (!session) return <Navigate to="/login" replace />
  if (allowedRoles && !allowedRoles.includes(session.role)) return <Navigate to="/" replace />
  return children
}

function RoleRedirect() {
  const { session } = useAuth()
  if (!session) return <Navigate to="/landing" replace />
  if (session.role === 'ADMIN') return <Navigate to="/admin" replace />
  if (session.role === 'PROFESSOR') return <Navigate to="/professor" replace />
  return <Navigate to="/student" replace />
}

function AppRoutes() {
  const { session } = useAuth()
  const isAuthenticated = Boolean(session)

  return (
    <div className={isAuthenticated ? 'appShell authShell' : 'appShell publicShell'}>
      <Navbar />
      <main className={isAuthenticated ? 'appMain appMainAuthed' : 'appMain'}>
        <Routes>
          <Route path="/" element={<RoleRedirect />} />
          <Route path="/landing" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Admin */}
          <Route path="/admin" element={<ProtectedRoute allowedRoles={['ADMIN']}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute allowedRoles={['ADMIN']}><AdminUsers /></ProtectedRoute>} />
          <Route path="/admin/analytics" element={<ProtectedRoute allowedRoles={['ADMIN']}><AdminAnalytics /></ProtectedRoute>} />
          <Route path="/admin/results" element={<ProtectedRoute allowedRoles={['ADMIN']}><AdminResults /></ProtectedRoute>} />

          {/* Professor */}
          <Route path="/professor" element={<ProtectedRoute allowedRoles={['PROFESSOR']}><ProfessorDashboard /></ProtectedRoute>} />
          <Route path="/professor/categories" element={<ProtectedRoute allowedRoles={['PROFESSOR']}><ProfessorCategories /></ProtectedRoute>} />
          <Route path="/professor/questions" element={<ProtectedRoute allowedRoles={['PROFESSOR']}><ProfessorQuestions /></ProtectedRoute>} />
          <Route path="/professor/exams" element={<ProtectedRoute allowedRoles={['PROFESSOR']}><ProfessorExams /></ProtectedRoute>} />
          <Route path="/professor/results" element={<ProtectedRoute allowedRoles={['PROFESSOR']}><ProfessorResults /></ProtectedRoute>} />
          <Route path="/professor/generate" element={<ProtectedRoute allowedRoles={['PROFESSOR']}><GenerateQuestions /></ProtectedRoute>} />
          <Route path="/professor/create-exam-from-pdf" element={<ProtectedRoute allowedRoles={['PROFESSOR']}><CreateExamFromPdf /></ProtectedRoute>} />

          {/* Student */}
          <Route path="/student" element={<ProtectedRoute allowedRoles={['STUDENT']}><StudentDashboard /></ProtectedRoute>} />
          <Route path="/student/exams" element={<ProtectedRoute allowedRoles={['STUDENT']}><StudentExams /></ProtectedRoute>} />
          <Route path="/student/results" element={<ProtectedRoute allowedRoles={['STUDENT']}><StudentResults /></ProtectedRoute>} />
          <Route path="/student/exam/:id" element={<ProtectedRoute allowedRoles={['STUDENT']}><ExamAttempt /></ProtectedRoute>} />

          {/* Profile — all roles */}
          <Route path="/profile" element={<ProtectedRoute allowedRoles={['ADMIN', 'PROFESSOR', 'STUDENT']}><ProfilePage /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ThemeProvider>
  )
}
