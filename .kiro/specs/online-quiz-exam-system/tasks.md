# Implementation Plan: Online Quiz and Examination Management System

## Overview

Incremental Java implementation following the 3-layer architecture (Presentation → Service → Repository). Each task builds on the previous, ending with full integration. Tests are sub-tasks placed close to the code they validate.

---

## Tasks

- [x] 1. Project setup and database initialization
  - Create Maven project with dependencies: MySQL Connector/J, HikariCP, jBCrypt, JFreeChart, Apache PDFBox, JUnit 5, Mockito, jqwik, H2 (test scope)
  - Add `db.properties` for MySQL connection config
  - Implement `DatabaseConfig.java` — HikariCP DataSource initialized from `db.properties`
  - Write `schema.sql` with all 11 CREATE TABLE statements (users, questions, mcq_options, ar_details, tf_details, exams, exam_questions, attempts, attempt_answers, results, notifications)
  - Implement `Main.java` — verify DB connectivity on startup; log error and `System.exit(1)` on failure
  - _Requirements: 12.1, 12.2, 12.3_

- [x] 2. Exception hierarchy and model classes
  - [x] 2.1 Create exception classes
    - Implement `AppException` (base checked exception) and all subclasses: `AuthException`, `DuplicateUserException`, `UnauthorizedException`, `ValidationException`, `QuestionInUseException`, `ExamHasAttemptsException`, `AlreadyAttemptedException`, `ExamNotAvailableException`, `DatabaseException`
    - _Requirements: 1.5, 2.8, 3.6, 4.2, 5.8, 12.5_
  - [x] 2.2 Create model/entity classes
    - Implement `Role` enum (ADMIN, PROFESSOR, STUDENT), `Difficulty` enum (EASY, MEDIUM, HARD), `ARChoice` enum (5 values)
    - Implement `User`, `Session`, `Question` (abstract), `MCQ`, `MCQOption`, `AssertionReasonQuestion`, `TrueFalseQuestion`, `Exam`, `ExamQuestion`, `Attempt`, `AttemptAnswer`, `Result`, `Notification`, `ExamStats`, `QuestionStats`
    - _Requirements: 1.2, 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ] 3. Repository layer (JDBC DAOs)
  - [x] 3.1 Implement `UserRepositoryImpl`
    - Methods: `save(User)`, `findByUsername(String)`, `findByEmail(String)`, `findById(long)`, `existsByUsername(String)`, `existsByEmail(String)`
    - All writes use the transaction pattern (commit/rollback)
    - _Requirements: 1.1, 12.4, 12.5_
  - [ ]* 3.2 Write integration tests for `UserRepositoryImpl` using H2
    - Test: save and retrieve by username, duplicate username rejected, duplicate email rejected
    - _Requirements: 1.1_
  - [x] 3.3 Implement `QuestionRepositoryImpl`
    - Methods: `save(Question)`, `findById(long)`, `update(Question)`, `delete(long)`, `search(QuestionFilter)`, `isUsedInActiveExam(long)`
    - Handle MCQ options, AR details, TF details in same transaction as question insert
    - _Requirements: 2.1, 2.2, 2.3, 2.6, 2.7, 2.8, 2.9_
  - [ ]* 3.4 Write integration tests for `QuestionRepositoryImpl` using H2
    - Test: save MCQ with options, save AR, save TF, search by type/difficulty/subject/topic/keyword
    - _Requirements: 2.1, 2.2, 2.3, 2.9_
  - [x] 3.5 Implement `ExamRepositoryImpl`
    - Methods: `save(Exam)`, `findById(long)`, `update(Exam)`, `delete(long)`, `addQuestion(long examId, long questionId, int order)`, `listAvailable()`, `hasSubmittedAttempts(long examId)`
    - _Requirements: 3.1, 3.2, 3.5, 3.6, 3.7_
  - [x] 3.6 Implement `AttemptRepositoryImpl`
    - Methods: `save(Attempt)`, `findById(long)`, `findByStudentAndExam(long, long)`, `updateStatus(long, status, timestamp)`, `saveAnswer(AttemptAnswer)`, `updateAnswer(AttemptAnswer)`, `getAnswers(long attemptId)`, `incrementTabSwitch(long attemptId)`
    - _Requirements: 5.1, 5.4, 5.5, 6.4, 6.5_
  - [x] 3.7 Implement `ResultRepositoryImpl`
    - Methods: `save(Result)`, `findByAttemptId(long)`, `findByExamId(long)`, `findByStudentId(long)`
    - _Requirements: 7.5, 10.1_
  - [ ]* 3.8 Write property test for Result round-trip (Property 14)
    - **Property 14: Result persistence round-trip**
    - **Validates: Requirements 7.5**
    - _Use H2; generate random Result objects, save, retrieve, assert equivalence_
  - [x] 3.9 Implement `NotificationRepositoryImpl`
    - Methods: `save(Notification)`, `findByUserId(long)`, `markRead(long)`
    - _Requirements: 4.3, 4.4_

- [x] 4. Authentication service
  - [x] 4.1 Implement `AuthServiceImpl`
    - `register`: validate fields, check uniqueness, BCrypt hash (cost 12), INSERT user in transaction
    - `login`: lookup by username, `BCrypt.checkpw`, create `Session` with UUID token
    - `logout`: invalidate Session
    - `createAdmin`: verify caller has ADMIN role, then register with role=ADMIN
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 1.6, 1.7_
  - [ ]* 4.2 Write property test for password hashing (Property 1)
    - **Property 1: Password hashing non-reversible and verifiable**
    - **Validates: Requirements 1.3**
  - [ ]* 4.3 Write property test for login rejection (Property 2)
    - **Property 2: Login rejects wrong credentials**
    - **Validates: Requirements 1.5**
  - [ ]* 4.4 Write unit tests for `AuthServiceImpl`
    - Test: duplicate username rejected, duplicate email rejected, admin-only creation enforced
    - _Requirements: 1.1, 1.7_

- [x] 5. Question service
  - [x] 5.1 Implement `QuestionServiceImpl`
    - `createMCQ`: validate 4 options, exactly one correct index, persist
    - `createAssertionReason`: validate correct_choice in [1,5], persist
    - `createTrueFalse`: persist
    - `updateQuestion`: check not in active exam, partial update
    - `deleteQuestion`: check `isUsedInActiveExam`, throw `QuestionInUseException` if true
    - `searchQuestions`: delegate to repository with filter
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.6, 2.7, 2.8, 2.9_
  - [ ]* 5.2 Write property test for MCQ correct-option invariant (Property 3)
    - **Property 3: MCQ correct-option invariant**
    - **Validates: Requirements 2.1**
  - [ ]* 5.3 Write property test for AR choice range invariant (Property 4)
    - **Property 4: AR choice range invariant**
    - **Validates: Requirements 2.2**
  - [ ]* 5.4 Write property test for question search filter correctness (Property 5)
    - **Property 5: Question search filter correctness**
    - **Validates: Requirements 2.9**
  - [ ]* 5.5 Write property test for question deletion guard (Property 13)
    - **Property 13: Question deletion blocked in active exam**
    - **Validates: Requirements 2.8**

- [x] 6. Exam service
  - [x] 6.1 Implement `ExamServiceImpl`
    - `createExam`: validate time_limit >= 1, persist exam and question associations
    - `publishExam`: set status=ACTIVE
    - `updateExam`: check `hasSubmittedAttempts`, throw `ExamHasAttemptsException` if true
    - `deleteExam`: same guard as update
    - `listAvailableExams`: filter by status=ACTIVE and current datetime within window
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 4.1, 4.2_
  - [ ]* 6.2 Write property test for exam time limit invariant (Property 6)
    - **Property 6: Exam time limit invariant**
    - **Validates: Requirements 3.1**
  - [ ]* 6.3 Write property test for exam edit/delete guard (Property 7)
    - **Property 7: Exam edit/delete blocked when attempts exist**
    - **Validates: Requirements 3.6, 3.7**

- [x] 7. Scoring service
  - [x] 7.1 Implement `ScoringServiceImpl`
    - Pure function: iterate questions, compare `answer_value` to correct answer per type
    - Compute `total_score = (correct × marks) − (incorrect × negative_marking)`
    - Compute `percentage = (total_score / max_score) × 100`
    - Build `detail_json` (per-question: questionId, studentAnswer, correctAnswer, isCorrect, marksAwarded)
    - Unanswered (null answer_value) treated as incorrect
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  - [ ]* 7.2 Write property test for score computation (Property 10)
    - **Property 10: Score computation correctness**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4**
  - [ ]* 7.3 Write unit tests for `ScoringServiceImpl`
    - Test: all correct, all incorrect, all unanswered, mixed with negative marking, negative marking disabled

- [x] 8. Attempt service and exam timer
  - [x] 8.1 Implement `AttemptServiceImpl`
    - `startAttempt`: check scheduling window, check no existing SUBMITTED attempt, INSERT attempt, shuffle question order, INSERT blank `attempt_answers` rows, schedule `autoSubmit` via `ScheduledExecutorService`
    - `recordAnswer`: verify attempt is IN_PROGRESS and belongs to student, UPDATE `attempt_answers`
    - `submitAttempt`: UPDATE attempt status=SUBMITTED, call `ScoringService.score`, INSERT result, cancel scheduled task
    - `autoSubmit`: same finalization path as `submitAttempt` (no session check)
    - `logTabSwitch`: increment `tab_switch_count`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 6.4, 6.5_
  - [ ]* 8.2 Write property test for answer overwrite idempotence (Property 9)
    - **Property 9: Answer overwrite idempotence**
    - **Validates: Requirements 5.4, 5.5**
  - [ ]* 8.3 Write property test for auto-submit equals manual-submit (Property 11)
    - **Property 11: Auto-submit and manual-submit produce identical scoring**
    - **Validates: Requirements 5.6, 5.7**
  - [ ]* 8.4 Write property test for re-attempt blocked (Property 12)
    - **Property 12: Re-attempt is blocked**
    - **Validates: Requirements 5.8**
  - [ ]* 8.5 Write property test for attempt outside scheduling window (Property 8)
    - **Property 8: Attempt blocked outside scheduling window**
    - **Validates: Requirements 4.2**

- [ ] 9. Checkpoint — core backend complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Result service and export
  - [x] 10.1 Implement `ResultServiceImpl`
    - `getResultForStudent`: load Result by (student, exam), include detail_json
    - `getResultsForExam`: load all Results for exam with student info
    - `exportResultsCSV`: write header + one row per Result using `java.io.PrintWriter`
    - `exportResultsPDF`: use Apache PDFBox to generate a table with student name, score, percentage, timestamp
    - _Requirements: 7.6, 10.1, 10.2, 10.3, 10.4_
  - [ ]* 10.2 Write property test for CSV row count (Property 15)
    - **Property 15: CSV export row count matches attempt count**
    - **Validates: Requirements 10.3**
  - [ ]* 10.3 Write unit tests for `ResultServiceImpl`
    - Test: CSV header present, PDF file created and non-empty, filter by student returns only that student's results

- [ ] 11. Analytics service and charts
  - [x] 11.1 Implement `AnalyticsServiceImpl`
    - `getExamStats`: compute average (arithmetic mean), median, highest, lowest, pass percentage from all Results for exam
    - `getHardestQuestions`: count incorrect responses per question across all attempts, sort descending
    - `buildScoreBarChart`: JFreeChart `BarChart` — x-axis students, y-axis scores
    - `buildScoreDistributionPieChart`: JFreeChart `PieChart` — score range buckets
    - `buildStudentProgressLineChart`: JFreeChart `LineChart` — x-axis exams (chronological), y-axis student score
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 11.1, 11.2, 11.3_
  - [ ]* 11.2 Write property test for exam stats arithmetic (Property 16)
    - **Property 16: Exam stats arithmetic correctness**
    - **Validates: Requirements 11.1**
  - [ ]* 11.3 Write unit tests for `AnalyticsServiceImpl`
    - Test: average of known score set, hardest question identified correctly

- [ ] 12. Notification service
  - [x] 12.1 Implement `NotificationServiceImpl`
    - `notifyExamAvailable`: find all students, INSERT notification row per student
    - `notifyResultsPublished`: same pattern for result-published event
    - _Requirements: 4.3, 4.4_

- [ ] 13. Adaptive exam service
  - [x] 13.1 Implement `AdaptiveExamServiceImpl`
    - `selectNextQuestion`: filter question pool by difficulty (step-up on correct, step-down on incorrect), exclude already-answered questions, pick random from candidates; fallback to any unanswered if no difficulty match
    - Persist adaptive session data (question sequence) in `attempt_answers.display_order`
    - _Requirements: 13.1, 13.2, 13.3, 13.4_
  - [ ]* 13.2 Write property test for adaptive difficulty progression (Property 17)
    - **Property 17: Adaptive difficulty progression**
    - **Validates: Requirements 13.2, 13.3**

- [ ] 14. Transaction rollback property test
  - [ ]* 14.1 Write property test for transaction rollback on failure (Property 18)
    - **Property 18: Transaction rollback on failure**
    - **Validates: Requirements 12.4, 12.5**
    - _Use H2 with a mock DataSource that throws SQLException mid-transaction; assert DB state unchanged_

- [ ] 15. Swing UI — Authentication screens
  - [ ] 15.1 Implement `LoginPanel` and `RegisterPanel`
    - Login form: username, password fields, Login button → calls `AuthService.login`
    - Register form: username, email, password, role selector → calls `AuthService.register`
    - Display `ValidationException` / `AuthException` messages inline
    - _Requirements: 1.1, 1.4, 1.5_

- [ ] 16. Swing UI — Administrator screens
  - [ ] 16.1 Implement admin dashboard panel
    - Menu: Manage Users, View Analytics, View All Results
    - _Requirements: 1.7, 11.3_
  - [ ] 16.2 Implement user management panel
    - Create admin account form → calls `AuthService.createAdmin`
    - _Requirements: 1.7_

- [ ] 17. Swing UI — Professor screens
  - [ ] 17.1 Implement question bank panel
    - Create/edit/delete MCQ, AR, TF questions with form dialogs
    - Search/filter bar (type, difficulty, subject, topic, keyword)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9_
  - [ ] 17.2 Implement exam management panel
    - Create/edit/publish/delete exam form; question selector with multi-select list
    - Start/end datetime pickers; negative marking toggle; adaptive exam checkbox
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 4.1_
  - [ ] 17.3 Implement results and analytics panel
    - Results table with filter by exam/student; Export CSV and Export PDF buttons
    - Embed JFreeChart panels for bar chart, pie chart, line graph
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 10.1, 10.2, 10.3, 10.4, 11.1, 11.2, 11.3_

- [ ] 18. Swing UI — Student screens
  - [ ] 18.1 Implement student dashboard panel
    - Upcoming exams list, completed exams with scores, performance stats summary
    - Notifications panel showing unread notifications
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 4.3, 4.4_
  - [ ] 18.2 Implement exam attempt panel
    - Question display with answer selection (radio buttons for MCQ/TF, dropdown for AR)
    - Countdown timer label updated every second via `javax.swing.Timer`
    - Navigation buttons (Previous / Next / Submit)
    - Disable copy-paste on answer components
    - Tab-switch detection via `WindowFocusListener` → calls `AttemptService.logTabSwitch`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 6.1, 6.2, 6.3, 6.4, 6.5_
  - [ ] 18.3 Implement result display panel
    - Show total score, percentage, per-question correctness, correct answers
    - _Requirements: 7.6, 5.8_

- [ ] 19. Wire all components together in Main.java
  - [x] 19.1 Instantiate DataSource, all Repository impls, all Service impls
    - Pass dependencies via constructor injection (no DI framework)
    - _Requirements: 12.1, 12.2_
  - [ ] 19.2 Launch Swing UI with role-based panel routing
    - After login, show Admin / Professor / Student dashboard based on `Session.role`
    - _Requirements: 1.2, 1.8_

- [ ] 20. Final checkpoint — Ensure all tests pass
  - Ensure all unit tests, property tests, and integration tests pass. Ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness; unit tests validate specific examples and edge cases
- H2 (MySQL-compatible mode) is used for all integration and repository tests — no live MySQL required during testing
