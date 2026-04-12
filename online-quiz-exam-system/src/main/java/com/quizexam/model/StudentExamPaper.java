package com.quizexam.model;

import jakarta.persistence.*;

/**
 * Stores the unique set of questions assigned to a specific student for a specific exam.
 * Generated once on first "Start Exam" and reused on refresh.
 */
@Entity
@Table(name = "student_exam_papers",
       uniqueConstraints = @UniqueConstraint(columnNames = {"student_id", "exam_id"}))
public class StudentExamPaper {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private long id;

    @Column(name = "student_id", nullable = false)
    private long studentId;

    @Column(name = "exam_id", nullable = false)
    private long examId;

    /**
     * Comma-separated ordered list of question IDs assigned to this student.
     * e.g. "3,7,12,1,5,9,2"
     */
    @Column(name = "question_ids", nullable = false, columnDefinition = "TEXT")
    private String questionIds;

    public StudentExamPaper() {}

    public long getId() { return id; }
    public void setId(long id) { this.id = id; }

    public long getStudentId() { return studentId; }
    public void setStudentId(long studentId) { this.studentId = studentId; }

    public long getExamId() { return examId; }
    public void setExamId(long examId) { this.examId = examId; }

    public String getQuestionIds() { return questionIds; }
    public void setQuestionIds(String questionIds) { this.questionIds = questionIds; }
}
