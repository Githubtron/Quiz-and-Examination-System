package com.quizexam.repository;

import com.quizexam.model.Exam;
import com.quizexam.model.Exam.ExamStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ExamRepository extends JpaRepository<Exam, Long> {
    List<Exam> findByStatus(ExamStatus status);
    List<Exam> findByCreatedBy(long createdBy);
}
