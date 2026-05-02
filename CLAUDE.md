# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack online quiz/exam platform with role-based access (ADMIN, PROFESSOR, STUDENT), AI-powered question generation via OpenRouter, adaptive exams, PDF/DOCX document processing, and analytics.

- **Backend:** `online-quiz-exam-system/` — Spring Boot 3.5.0, Java 25, Maven
- **Frontend:** `quiz-exam-frontend/` — React 18 + Vite 5, no TypeScript

---

## Commands

### Backend
```bash
cd online-quiz-exam-system
mvn spring-boot:run        # Start dev server on :8080
mvn clean install          # Build JAR
mvn test                   # Run all tests
mvn test -Dtest=ClassName  # Run a single test class
```

### Frontend
```bash
cd quiz-exam-frontend
npm install                # Install dependencies
npm run dev                # Dev server on :3000 (proxies /api → localhost:8080)
npm run build              # Production build
npm run preview            # Preview production build
```

Both servers must run simultaneously for development. The Vite proxy forwards `/api/*` to the Spring Boot backend.

---

## Backend Architecture

**Package:** `com.quizexam`

Layered: `controller` → `service` → `repository` → `model`

**Security flow:** Every request hits `JwtAuthFilter` → extracts/validates JWT via `JwtUtils` → sets `SecurityContext`. `SecurityConfig` defines which routes are public vs. role-restricted.

**Question model:** Abstract `Question` base entity with single-table inheritance. Concrete types: `MCQQuestion`, `TrueFalseQuestion`, `AssertionReasonQuestion`. Each has its own controller and service.

**Key services:**
- `AiQuestionGeneratorService` — calls OpenRouter API (Llama 3.2 / Gemma 3 / Phi 3) with multi-model retry + deterministic fallback
- `ExamTemplateService` — randomizes/shuffles questions per student attempt
- `DocumentTextExtractor` — PDF text via PDFBox, DOCX via Apache POI

**Exam lifecycle:** `DRAFT` → `ACTIVE`. Attempts track `IN_PROGRESS` → `SUBMITTED` status.

**Config:** `online-quiz-exam-system/src/main/resources/application.properties`
- DB: MySQL on `localhost:3306/quizexam` (auto-creates if missing via `createDatabaseIfNotExist=true`)
- JWT expiry: 24 hours
- File upload limit: 20MB
- CORS: allows `localhost:5173`, `localhost:3000`, `localhost:3001`

---

## Frontend Architecture

**Routing (React Router v6):** Role-gated routes — `/admin/*`, `/professor/*`, `/student/*`, plus shared `/profile`.

**Auth state:** `AuthContext` reads/writes a `qm_session` JSON key in `localStorage`. Contains `{ token, userId, username, role, email }`. Auto-clears and redirects to `/login` on 401.

**API layer:** `src/api/api.js` — single Axios-based module. Base URL is hardcoded to `http://localhost:8080`. Sends `Authorization: Bearer <token>` header. Supports both `application/json` and `multipart/form-data`.

**Styling:** CSS Modules (`.module.css` per page). Global styles in `src/styles/`.

**Charts:** Recharts for analytics pages. PDF export uses jsPDF + html2canvas.

---

## Data Flow: Exam Attempt

1. Student calls `POST /api/attempts/start/:examId` → creates `Attempt` (IN_PROGRESS), returns shuffled questions via `ExamTemplateService`
2. Student submits answers to `POST /api/attempts/:attemptId/submit` → creates `Result` with score
3. Adaptive path: `GET /api/adaptive/:attemptId/next` → returns next question based on performance

---

## Environment & Secrets

Credentials live in `application.properties` (DB password, JWT secret, OpenRouter API key). These should be externalized via env vars before any production deployment. The `.gitignore` excludes `.env` and `application.properties` from future commits.

The OpenRouter key is needed for AI question generation (`/professor/generate` and `CreateExamFromPdf`). Without it, the service falls back to deterministic template questions.
