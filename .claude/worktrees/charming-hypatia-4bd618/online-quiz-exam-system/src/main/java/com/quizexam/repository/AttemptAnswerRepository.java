package com.quizexam.repository;

import com.quizexam.model.AttemptAnswer;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface AttemptAnswerRepository extends JpaRepository<AttemptAnswer, Long> {
    List<AttemptAnswer> findByAttemptId(long attemptId);
    Optional<AttemptAnswer> findByAttemptIdAndQuestionId(long attemptId, long questionId);
    List<AttemptAnswer> findByAttemptIdIn(List<Long> attemptIds);
    void deleteByAttemptId(long attemptId);
}
