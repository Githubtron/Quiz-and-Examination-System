package com.quizexam.repository;

import com.quizexam.model.Attempt;
import com.quizexam.model.Attempt.AttemptStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface AttemptRepository extends JpaRepository<Attempt, Long> {
    Optional<Attempt> findByStudentIdAndExamId(long studentId, long examId);
    List<Attempt> findByStudentId(long studentId);
    List<Attempt> findByExamId(long examId);
    boolean existsByExamIdAndStatus(long examId, AttemptStatus status);
}
