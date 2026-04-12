package com.quizexam.model;

import jakarta.persistence.*;

/**
 * Defines how many questions to pick from each category for an exam.
 * e.g. "Pick 5 from DBMS, 3 from OS, 2 from Java"
 */
@Entity
@Table(name = "exam_templates",
       uniqueConstraints = @UniqueConstraint(columnNames = {"exam_id", "category_id"}))
public class ExamTemplate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private long id;

    @Column(name = "exam_id", nullable = false)
    private long examId;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "category_id", nullable = false)
    private Category category;

    @Column(name = "question_count", nullable = false)
    private int questionCount;

    public ExamTemplate() {}

    public long getId() { return id; }
    public void setId(long id) { this.id = id; }

    public long getExamId() { return examId; }
    public void setExamId(long examId) { this.examId = examId; }

    public Category getCategory() { return category; }
    public void setCategory(Category category) { this.category = category; }

    public int getQuestionCount() { return questionCount; }
    public void setQuestionCount(int questionCount) { this.questionCount = questionCount; }
}
