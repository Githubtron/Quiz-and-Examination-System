package com.quizexam.repository;

import com.quizexam.model.ExamTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ExamTemplateRepository extends JpaRepository<ExamTemplate, Long> {
    List<ExamTemplate> findByExamId(long examId);
    void deleteByExamId(long examId);
    boolean existsByCategoryId(long categoryId);
}
