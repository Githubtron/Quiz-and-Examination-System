package com.quizexam.repository;

import com.quizexam.model.Difficulty;
import com.quizexam.model.Question;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface QuestionRepository extends JpaRepository<Question, Long> {
    List<Question> findBySubject(String subject);
    List<Question> findByDifficulty(Difficulty difficulty);
    List<Question> findBySubjectAndDifficulty(String subject, Difficulty difficulty);
    List<Question> findByCreatedBy(long createdBy);

    @Query("SELECT q FROM Question q JOIN q.exams e WHERE e.id = :examId")
    List<Question> findByExamId(@Param("examId") long examId);
}
