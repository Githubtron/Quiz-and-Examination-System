package com.quizexam.repository;

import com.quizexam.model.Result;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface ResultRepository extends JpaRepository<Result, Long> {
    Optional<Result> findByAttemptId(long attemptId);

    @Query("SELECT r FROM Result r JOIN Attempt a ON r.attemptId = a.id WHERE a.examId = :examId")
    List<Result> findByExamId(@Param("examId") long examId);

    @Query("SELECT r FROM Result r JOIN Attempt a ON r.attemptId = a.id WHERE a.studentId = :studentId")
    List<Result> findByStudentId(@Param("studentId") long studentId);
}
