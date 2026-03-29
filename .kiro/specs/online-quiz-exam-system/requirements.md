# Requirements Document

## Introduction

A Java-based Online Quiz and Examination Management System supporting three roles: Administrator, Professor, and Student. Administrators manage users and system-wide settings. Professors create and manage questions and exams, schedule exam windows, and view analytics. Students attempt timed exams and receive instant automated results. The system is backed by a relational database (MySQL or PostgreSQL) and provides graphical performance reports, result exports (CSV/PDF), and optional adaptive exam capabilities.

---

## Glossary

- **System**: The Online Quiz and Examination Management System
- **Administrator**: A privileged user who manages users, views analytics, and oversees the system
- **Professor**: A user who creates and manages questions, exams, and views student performance
- **Student**: A registered user who attempts exams and views their results
- **MCQ**: Multiple Choice Question — a question with exactly four options and one correct answer
- **Assertion_Reason**: A question presenting an assertion and a reason; the student selects the correct relationship between them (one of five fixed choices)
- **True_False**: A question with exactly two options: True and False
- **Exam**: A timed, scheduled collection of questions assigned to students
- **Attempt**: A single student's session of answering all questions in an Exam
- **Result**: The automated score and feedback generated after an Attempt is finalized
- **Session**: An authenticated user's active login context
- **Database**: The relational database storing all persistent data
- **Negative_Marking**: A configurable rule that deducts marks for incorrect answers
- **Adaptive_Exam**: An exam that dynamically selects questions based on the student's previous answers

---

## Requirements

### Requirement 1: User Authentication and Role Management

**User Story:** As a user, I want to register and log in securely, so that I can access features appropriate to my role.

#### Acceptance Criteria

1. WHEN a new user registers, THE System SHALL require a unique username, a valid email address, a password, and a role selection (Administrator, Professor, or Student).
2. THE System SHALL support exactly three roles: Administrator, Professor, and Student.
3. WHEN a password is stored, THE System SHALL store it in hashed form in the Database.
4. WHEN a user provides correct credentials, THE System SHALL create a Session and grant access to role-appropriate features.
5. WHEN a user provides incorrect credentials, THE System SHALL reject the login and display a descriptive error message without revealing which field was wrong.
6. WHEN a user logs out, THE System SHALL terminate the active Session.
7. THE System SHALL ensure that Administrator accounts can only be created by existing Administrators and not through self-registration.
8. WHILE a Session is active, THE System SHALL associate every action with the authenticated user's identity and role.

---

### Requirement 2: Question Bank Management

**User Story:** As a professor or administrator, I want to create and manage questions of multiple types, so that I can build a rich question bank for exams.

#### Acceptance Criteria

1. WHEN an MCQ question is created, THE System SHALL store the question text, exactly four answer options, and the correct answer index in the Database.
2. WHEN an Assertion_Reason question is created, THE System SHALL store the assertion statement, the reason statement, and the correct relationship choice (from a fixed set of five options) in the Database.
3. WHEN a True_False question is created, THE System SHALL store the question text and the correct answer (True or False) in the Database.
4. THE System SHALL allow questions to be assigned a difficulty level of Easy, Medium, or Hard.
5. THE System SHALL allow questions to be categorized by subject and topic.
6. WHEN a question is edited, THE System SHALL update only the specified fields and persist the changes to the Database.
7. WHEN a question that is not assigned to any active Exam is deleted, THE System SHALL remove it from the Database.
8. IF a question is assigned to an active Exam, THEN THE System SHALL reject the deletion and return a descriptive error message.
9. THE System SHALL allow searching and filtering questions by type, difficulty level, keyword, subject, and topic.

---

### Requirement 3: Exam Creation and Management

**User Story:** As a professor, I want to create and manage exams by selecting questions and configuring scoring rules, so that students can be assessed effectively.

#### Acceptance Criteria

1. WHEN an exam is created, THE System SHALL store the exam title, description, time limit in minutes (minimum 1), and total marks in the Database.
2. THE System SHALL allow an Exam to contain questions of mixed types (MCQ, Assertion_Reason, True_False).
3. THE System SHALL allow setting a marks-per-question value for each Exam.
4. WHERE negative marking is enabled, THE System SHALL store the negative marking deduction value per incorrect answer.
5. WHEN an Exam is published, THE System SHALL mark it as active and make it visible to Students.
6. IF an Exam already has at least one submitted Attempt, THEN THE System SHALL reject any edit request and return a descriptive error message.
7. WHEN an Exam that has no submitted Attempts is deleted, THE System SHALL remove the Exam and its question associations from the Database.

---

### Requirement 4: Exam Scheduling

**User Story:** As a professor, I want to schedule exams with a defined start and end date, so that students can attempt them only within the allowed period.

#### Acceptance Criteria

1. WHEN creating an Exam, THE System SHALL allow defining a start date-time and an end date-time for the exam window.
2. THE System SHALL allow Exam Attempts only during the scheduled exam window (between start date-time and end date-time).
3. WHEN an Exam becomes available (start date-time is reached), THE System SHALL notify enrolled Students.
4. WHEN Exam results are published, THE System SHALL notify the relevant Students.

---

### Requirement 5: Exam Attempt by Student

**User Story:** As a student, I want to attempt a published exam within the allotted time, so that my knowledge can be evaluated.

#### Acceptance Criteria

1. WHEN a Student starts an Exam, THE System SHALL record the start timestamp and begin a countdown equal to the Exam's time limit.
2. WHILE an Attempt is in progress, THE System SHALL display a countdown timer to the Student.
3. WHILE an Attempt is in progress, THE System SHALL update the displayed timer at least every second.
4. WHEN a Student selects an answer for a question, THE System SHALL store the response within the current Attempt.
5. WHILE an Attempt is in progress, THE System SHALL allow the Student to navigate between questions and change answers before final submission.
6. WHEN a Student explicitly submits the Exam, THE System SHALL finalize the Attempt and trigger automated scoring.
7. WHEN the time limit expires before the Student submits, THE System SHALL automatically finalize the Attempt with the answers recorded up to that point and trigger automated scoring.
8. IF a Student attempts to start an Exam they have already completed, THEN THE System SHALL reject the request and display the previously recorded Result.

---

### Requirement 6: Exam Security and Randomization

**User Story:** As a professor, I want exam questions and options randomized and basic anti-cheating measures in place, so that exam integrity is maintained.

#### Acceptance Criteria

1. THE System SHALL present questions in a randomized order unique to each Student's Attempt.
2. THE System SHALL randomize the answer option order for MCQ questions in each Attempt.
3. THE System SHALL disable copy and paste operations during an active Attempt.
4. WHEN a browser tab-switching event is detected during an Attempt, THE System SHALL log the event.
5. THE System SHALL prevent a Student from having more than one simultaneous active Attempt for the same Exam.

---

### Requirement 7: Automated Scoring and Results

**User Story:** As a student, I want to receive an instant automated result after submitting an exam, so that I know my performance immediately.

#### Acceptance Criteria

1. WHEN an Attempt is finalized, THE System SHALL compare each recorded answer against the correct answer for its question and compute a total score.
2. THE System SHALL calculate the total score by summing marks for each correct answer as defined by the Exam's marks-per-question value.
3. WHERE negative marking is enabled for the Exam, THE System SHALL deduct the configured negative marking value for each incorrect answer.
4. IF a question was left unanswered in the Attempt, THEN THE System SHALL treat it as incorrect and award zero marks for that question.
5. WHEN scoring is complete, THE System SHALL persist the Result (total score, max score, percentage, and per-question correctness) to the Database.
6. WHEN a Student views their Result, THE System SHALL display the total score, percentage, per-question correctness, and the correct answers for all questions.

---

### Requirement 8: Student Dashboard

**User Story:** As a student, I want to view my exam information and results in one place, so that I can track my progress.

#### Acceptance Criteria

1. WHEN a Student logs in, THE System SHALL display a dashboard.
2. THE dashboard SHALL show all upcoming Exams available to the Student.
3. THE dashboard SHALL display all completed Exams along with the Student's scores.
4. THE dashboard SHALL show performance statistics for the Student across all completed Exams.

---

### Requirement 9: Performance Reports and Graphs

**User Story:** As a professor or administrator, I want graphical reports of student performance, so that I can identify trends and areas for improvement.

#### Acceptance Criteria

1. THE System SHALL generate bar charts showing student scores per Exam.
2. THE System SHALL generate pie charts representing score distribution across score ranges for an Exam.
3. THE System SHALL generate line graphs showing a Student's score progression across multiple Exams.
4. THE System SHALL display summary statistics per Exam including average score, highest score, lowest score, and pass percentage.

---

### Requirement 10: Results and Reporting (Administrator/Professor)

**User Story:** As an administrator or professor, I want to view and export exam results, so that I can monitor performance and maintain records.

#### Acceptance Criteria

1. WHEN an Administrator or Professor views results for a specific Exam, THE System SHALL display all Attempts including student name, score, percentage, and submission timestamp.
2. THE System SHALL allow filtering results by Exam and by Student.
3. WHEN results are exported for an Exam, THE System SHALL generate a CSV file containing student name, score, percentage, and submission timestamp for all Attempts of that Exam.
4. WHEN results are exported for an Exam, THE System SHALL generate a PDF report containing the same information as the CSV export.

---

### Requirement 11: Analytics Dashboard

**User Story:** As an administrator, I want to analyze exam data, so that I can make informed decisions about exam quality and student performance.

#### Acceptance Criteria

1. THE System SHALL calculate and display per-Exam statistics including average score, median score, highest score, and lowest score.
2. THE System SHALL identify and display the questions with the highest incorrect response rate for each Exam.
3. THE System SHALL display a graphical analytics dashboard presenting the statistics from criteria 11.1 and 11.2.

---

### Requirement 12: Database Persistence

**User Story:** As a system operator, I want all data stored reliably in a relational database, so that no data is lost between sessions.

#### Acceptance Criteria

1. THE System SHALL use a relational Database (MySQL or PostgreSQL) to persist all users, questions, exams, attempts, and results.
2. WHEN the System starts, THE System SHALL establish a connection to the Database and verify connectivity before accepting any user requests.
3. IF the Database connection fails during startup, THEN THE System SHALL log the error and terminate with a descriptive message.
4. WHEN any write operation (create, update, delete) is performed, THE System SHALL execute it within a database transaction and roll back on failure.
5. IF a database transaction fails, THEN THE System SHALL return a descriptive error to the caller and log the failure details.

---

### Requirement 13: Adaptive Exams (Advanced Feature)

**User Story:** As a system administrator, I want adaptive exams that adjust difficulty based on student responses, so that each student is assessed at an appropriate level.

#### Acceptance Criteria

1. WHERE an Exam is configured as adaptive, THE System SHALL dynamically select the next question based on the Student's previous answers.
2. WHEN a Student answers a question correctly in an adaptive Exam, THE System SHALL present a question of higher difficulty next.
3. WHEN a Student answers a question incorrectly in an adaptive Exam, THE System SHALL present a question of lower difficulty next.
4. THE System SHALL store adaptive Exam session data (question sequence and responses) in the Database for analytics purposes.
