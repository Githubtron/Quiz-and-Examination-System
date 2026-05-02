# Online Quiz & Exam System

A full-stack web application for conducting online quizzes and exams with role-based access control, AI-powered question generation, adaptive exams, and analytics.

---

## Features

- **Role-based access** — Admin, Professor, and Student dashboards
- **AI question generation** — Auto-generate questions from topics using OpenRouter (Llama 3.2 / Gemma 3 / Phi 3)
- **Document import** — Upload PDF or DOCX files to generate exam questions automatically
- **Adaptive exams** — Next question is selected based on student's real-time performance
- **Exam lifecycle** — Draft → Active flow with shuffled questions per attempt
- **Analytics** — Charts and PDF export of results using Recharts and jsPDF
- **JWT authentication** — Secure token-based auth with 24-hour expiry

---

## Screenshots

### Login Page
![Login Page](screenshots/login.png)

### Student Dashboard
![Student Dashboard](screenshots/student-dashboard.png)

### Take Exam
![Take Exam](screenshots/take-exam.png)

### Professor — Create Exam
![Create Exam](screenshots/create-exam.png)

### Professor — AI Question Generation
![AI Question Generation](screenshots/ai-question-generation.png)

### Analytics
![Analytics](screenshots/analytics.png)

---

## Tech Stack

| Layer    | Technology                              |
|----------|-----------------------------------------|
| Backend  | Java 25, Spring Boot 3.5.0, Maven       |
| Frontend | React 18, Vite 5, React Router v6       |
| Database | MySQL                                   |
| AI       | OpenRouter API                          |
| Charts   | Recharts                                |
| PDF      | jsPDF + html2canvas, Apache PDFBox      |
| Docs     | Apache POI (DOCX parsing)               |

---

## Project Structure

```
mini project/
├── online-quiz-exam-system/   # Spring Boot backend (port 8080)
└── quiz-exam-frontend/        # React + Vite frontend (port 3000)
```

---

## Prerequisites

- Java 25+
- Maven 3.8+
- Node.js 18+
- MySQL 8+
- OpenRouter API key (optional — falls back to template questions without it)

---

## Setup & Installation

### 1. Database

Create a MySQL database (or let Spring Boot auto-create it):

```sql
CREATE DATABASE quizexam;
```

### 2. Backend Configuration

Edit `online-quiz-exam-system/src/main/resources/application.properties`:

```properties
spring.datasource.url=jdbc:mysql://localhost:3306/quizexam?createDatabaseIfNotExist=true
spring.datasource.username=YOUR_DB_USERNAME
spring.datasource.password=YOUR_DB_PASSWORD
app.jwt.secret=YOUR_JWT_SECRET
openrouter.api.key=YOUR_OPENROUTER_API_KEY
```

### 3. Start the Backend

```bash
cd online-quiz-exam-system
mvn spring-boot:run
```

Backend runs at `http://localhost:8080`.

### 4. Start the Frontend

```bash
cd quiz-exam-frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:3000` and proxies `/api/*` to the backend.

---

## User Roles

| Role      | Capabilities                                                                 |
|-----------|------------------------------------------------------------------------------|
| Admin     | Manage users, view platform-wide analytics                                   |
| Professor | Create/manage exams, generate questions via AI or document upload, view results |
| Student   | Take exams, view scores and performance analytics                            |

---

## AI Question Generation

Professors can generate questions in two ways:

1. **By topic** — Enter a subject/topic and the AI generates MCQ, True/False, or Assertion-Reason questions.
2. **From document** — Upload a PDF or DOCX file; text is extracted and sent to the AI model.

If the OpenRouter API key is not configured, the system falls back to deterministic template-based questions.

---

## Question Types

- Multiple Choice (MCQ)
- True / False
- Assertion-Reason

---

## Running Tests

```bash
cd online-quiz-exam-system
mvn test                        # Run all tests
mvn test -Dtest=ClassName       # Run a specific test class
```

---

## Build for Production

```bash
# Backend JAR
cd online-quiz-exam-system
mvn clean install

# Frontend production build
cd quiz-exam-frontend
npm run build
```

---

## Security Notes

- JWT tokens expire after 24 hours.
- Credentials and API keys in `application.properties` should be moved to environment variables before any production deployment.
- File upload limit is set to 20 MB.

---

## License

This project is for educational purposes.
