package com.quizexam.repository;

import com.quizexam.model.StudentExamPaper;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface StudentExamPaperRepository extends JpaRepository<StudentExamPaper, Long> {
    Optional<StudentExamPaper> findByStudentIdAndExamId(long studentId, long examId);
    List<StudentExamPaper> findByExamId(long examId);
}
