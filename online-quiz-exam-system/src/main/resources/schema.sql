-- Online Quiz and Examination Management System — Database Schema
-- MySQL DDL

CREATE TABLE IF NOT EXISTS users (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    username      VARCHAR(50)  NOT NULL UNIQUE,
    email         VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          ENUM('ADMIN','PROFESSOR','STUDENT') NOT NULL,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
    id           BIGINT AUTO_INCREMENT PRIMARY KEY,
    name         VARCHAR(100) NOT NULL UNIQUE,
    description  TEXT
);

CREATE TABLE IF NOT EXISTS questions (
    id               BIGINT AUTO_INCREMENT PRIMARY KEY,
    type             ENUM('MCQ','AR','TF') NOT NULL,
    text             TEXT NOT NULL,
    difficulty       ENUM('EASY','MEDIUM','HARD'),
    subject          VARCHAR(100),
    topic            VARCHAR(100),
    explanation      TEXT,
    correct_answer   TEXT,
    created_by       BIGINT NOT NULL,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    source_document  VARCHAR(255) DEFAULT NULL,
    category_id      BIGINT NOT NULL,
    CONSTRAINT fk_questions_user FOREIGN KEY (created_by) REFERENCES users(id),
    CONSTRAINT fk_questions_category FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS mcq_options (
    id           BIGINT AUTO_INCREMENT PRIMARY KEY,
    question_id  BIGINT NOT NULL,
    option_index TINYINT NOT NULL,
    option_text  TEXT NOT NULL,
    is_correct   BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT fk_mcq_options_question FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ar_details (
    question_id    BIGINT PRIMARY KEY,
    assertion      TEXT NOT NULL,
    reason         TEXT NOT NULL,
    correct_choice TINYINT NOT NULL,
    CONSTRAINT fk_ar_details_question FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tf_details (
    question_id    BIGINT PRIMARY KEY,
    correct_answer BOOLEAN NOT NULL,
    CONSTRAINT fk_tf_details_question FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS exams (
    id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
    title               VARCHAR(200) NOT NULL,
    description         TEXT,
    time_limit_minutes  INT NOT NULL,
    marks_per_question  INT NOT NULL,
    negative_marking    DECIMAL(5,2) DEFAULT 0.00,
    is_adaptive         BOOLEAN DEFAULT FALSE,
    status              ENUM('DRAFT','ACTIVE') DEFAULT 'DRAFT',
    start_datetime      DATETIME,
    end_datetime        DATETIME,
    source_pdf          VARCHAR(255),
    auto_generated      BOOLEAN DEFAULT FALSE,
    created_by          BIGINT NOT NULL,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_time_limit CHECK (time_limit_minutes >= 1),
    CONSTRAINT fk_exams_user FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Legacy/manual exam question assignment (kept for compatibility)
CREATE TABLE IF NOT EXISTS exam_questions (
    exam_id       BIGINT NOT NULL,
    question_id   BIGINT NOT NULL,
    display_order INT NOT NULL,
    PRIMARY KEY (exam_id, question_id),
    CONSTRAINT fk_eq_exam FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
    CONSTRAINT fk_eq_question FOREIGN KEY (question_id) REFERENCES questions(id)
);

CREATE TABLE IF NOT EXISTS exam_templates (
    id             BIGINT AUTO_INCREMENT PRIMARY KEY,
    exam_id        BIGINT NOT NULL,
    category_id    BIGINT NOT NULL,
    question_count INT NOT NULL,
    CONSTRAINT uq_exam_category UNIQUE (exam_id, category_id),
    CONSTRAINT fk_exam_template_exam FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
    CONSTRAINT fk_exam_template_category FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS student_exam_papers (
    id           BIGINT AUTO_INCREMENT PRIMARY KEY,
    student_id   BIGINT NOT NULL,
    exam_id      BIGINT NOT NULL,
    question_ids TEXT NOT NULL,
    CONSTRAINT uq_student_exam UNIQUE (student_id, exam_id),
    CONSTRAINT fk_student_paper_student FOREIGN KEY (student_id) REFERENCES users(id),
    CONSTRAINT fk_student_paper_exam FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS attempts (
    id               BIGINT AUTO_INCREMENT PRIMARY KEY,
    exam_id          BIGINT NOT NULL,
    student_id       BIGINT NOT NULL,
    started_at       TIMESTAMP NOT NULL,
    submitted_at     TIMESTAMP,
    status           ENUM('IN_PROGRESS','SUBMITTED') DEFAULT 'IN_PROGRESS',
    tab_switch_count INT DEFAULT 0,
    UNIQUE (exam_id, student_id),
    CONSTRAINT fk_attempts_exam    FOREIGN KEY (exam_id)    REFERENCES exams(id),
    CONSTRAINT fk_attempts_student FOREIGN KEY (student_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS attempt_answers (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    attempt_id      BIGINT NOT NULL,
    question_id     BIGINT NOT NULL,
    selected_answer VARCHAR(255),
    is_correct      BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT fk_aa_attempt  FOREIGN KEY (attempt_id) REFERENCES attempts(id) ON DELETE CASCADE,
    CONSTRAINT fk_aa_question FOREIGN KEY (question_id) REFERENCES questions(id)
);

CREATE TABLE IF NOT EXISTS results (
    id           BIGINT AUTO_INCREMENT PRIMARY KEY,
    attempt_id   BIGINT NOT NULL UNIQUE,
    total_score  DECIMAL(8,2) NOT NULL,
    max_score    INT NOT NULL,
    percentage   DECIMAL(5,2) NOT NULL,
    detail_json  TEXT NOT NULL,
    CONSTRAINT fk_results_attempt FOREIGN KEY (attempt_id) REFERENCES attempts(id)
);

CREATE TABLE IF NOT EXISTS notifications (
    id         BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id    BIGINT NOT NULL,
    message    TEXT NOT NULL,
    exam_id    BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_read    BOOLEAN DEFAULT FALSE,
    CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_notif_exam FOREIGN KEY (exam_id) REFERENCES exams(id)
);

-- Ensure long AI-generated text is not truncated on existing databases.
ALTER TABLE questions ADD COLUMN IF NOT EXISTS explanation TEXT;
ALTER TABLE questions MODIFY COLUMN text TEXT;
ALTER TABLE questions MODIFY COLUMN explanation TEXT;
ALTER TABLE mcq_options MODIFY COLUMN option_text TEXT;
