package com.quizexam.repository;

import com.quizexam.model.Attempt;
import com.quizexam.model.Attempt.AttemptStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface AttemptRepository extends JpaRepository<Attempt, Long> {
    @Query(value = "SELECT * FROM attempts WHERE student_id = :studentId AND exam_id = :examId ORDER BY id DESC LIMIT 1", nativeQuery = true)
    Attempt findByStudentIdAndExamId(@Param("studentId") long studentId, @Param("examId") long examId);
    
    @Query(value = "SELECT * FROM attempts WHERE student_id = :studentId AND exam_id = :examId ORDER BY id DESC", nativeQuery = true)
    List<Attempt> findAllByStudentIdAndExamId(@Param("studentId") long studentId, @Param("examId") long examId);
    
    List<Attempt> findByStudentId(long studentId);
    List<Attempt> findByExamId(long examId);
    boolean existsByExamIdAndStatus(long examId, AttemptStatus status);
    
    default void deleteOldDuplicates(long studentId, long examId) {
        List<Attempt> attempts = findAllByStudentIdAndExamId(studentId, examId);
        if (attempts.size() > 1) {
            deleteAll(attempts.subList(1, attempts.size()));
        }
    }
}
