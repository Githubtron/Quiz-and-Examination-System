package com.quizexam.controller;

import com.quizexam.model.*;
import com.quizexam.repository.*;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Adaptive exam controller — selects the next question based on student performance.
 * Difficulty steps up on correct answer, steps down on incorrect.
 * Requirements: 13.1, 13.2, 13.3, 13.4
 */
@RestController
@RequestMapping("/api/adaptive")
@PreAuthorize("hasRole('STUDENT')")
public class AdaptiveExamController {

    private final AttemptRepository attemptRepository;
    private final AttemptAnswerRepository attemptAnswerRepository;
    private final ExamRepository examRepository;
    private final QuestionRepository questionRepository;
    private final UserRepository userRepository;

    public AdaptiveExamController(AttemptRepository attemptRepository,
                                   AttemptAnswerRepository attemptAnswerRepository,
                                   ExamRepository examRepository,
                                   QuestionRepository questionRepository,
                                   UserRepository userRepository) {
        this.attemptRepository = attemptRepository;
        this.attemptAnswerRepository = attemptAnswerRepository;
        this.examRepository = examRepository;
        this.questionRepository = questionRepository;
        this.userRepository = userRepository;
    }

    /**
     * GET /api/adaptive/{attemptId}/next
     * Returns the next question for an adaptive exam attempt.
     */
    @GetMapping("/{attemptId}/next")
    public ResponseEntity<?> nextQuestion(@PathVariable long attemptId,
                                           @AuthenticationPrincipal UserDetails principal) {
        long studentId = userRepository.findByUsername(principal.getUsername()).orElseThrow().getId();
        Attempt attempt = attemptRepository.findById(attemptId).orElse(null);
        if (attempt == null) return ResponseEntity.notFound().build();
        if (attempt.getStudentId() != studentId)
            return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
        if (attempt.getStatus() != Attempt.AttemptStatus.IN_PROGRESS)
            return ResponseEntity.badRequest().body(Map.of("error", "Attempt is not in progress"));

        Exam exam = examRepository.findById(attempt.getExamId()).orElseThrow();
        if (!exam.isAdaptive())
            return ResponseEntity.badRequest().body(Map.of("error", "Exam is not adaptive"));

        List<Question> allQuestions = exam.getQuestions();
        List<AttemptAnswer> answered = attemptAnswerRepository.findByAttemptId(attemptId);
        Set<Long> answeredIds = answered.stream().map(AttemptAnswer::getQuestionId).collect(Collectors.toSet());

        // All questions answered
        if (answeredIds.size() >= allQuestions.size())
            return ResponseEntity.ok(Map.of("done", true, "message", "All questions answered"));

        // Determine current difficulty based on last answer
        Difficulty targetDifficulty = Difficulty.MEDIUM; // default start
        if (!answered.isEmpty()) {
            AttemptAnswer last = answered.get(answered.size() - 1);
            Question lastQ = allQuestions.stream()
                .filter(q -> q.getId() == last.getQuestionId())
                .findFirst().orElse(null);
            if (lastQ != null) {
                targetDifficulty = last.isCorrect()
                    ? stepUp(lastQ.getDifficulty())
                    : stepDown(lastQ.getDifficulty());
            }
        }

        // Filter unanswered questions at target difficulty
        final Difficulty target = targetDifficulty;
        List<Question> candidates = allQuestions.stream()
            .filter(q -> !answeredIds.contains(q.getId()) && q.getDifficulty() == target)
            .collect(Collectors.toList());

        // Fallback: any unanswered question
        if (candidates.isEmpty()) {
            candidates = allQuestions.stream()
                .filter(q -> !answeredIds.contains(q.getId()))
                .collect(Collectors.toList());
        }

        if (candidates.isEmpty())
            return ResponseEntity.ok(Map.of("done", true, "message", "All questions answered"));

        // Pick random from candidates
        Question next = candidates.get(new Random().nextInt(candidates.size()));
        return ResponseEntity.ok(Map.of(
            "done", false,
            "question", next,
            "questionNumber", answeredIds.size() + 1,
            "totalQuestions", allQuestions.size()
        ));
    }

    private Difficulty stepUp(Difficulty d) {
        return switch (d) {
            case EASY -> Difficulty.MEDIUM;
            case MEDIUM -> Difficulty.HARD;
            case HARD -> Difficulty.HARD;
        };
    }

    private Difficulty stepDown(Difficulty d) {
        return switch (d) {
            case HARD -> Difficulty.MEDIUM;
            case MEDIUM -> Difficulty.EASY;
            case EASY -> Difficulty.EASY;
        };
    }
}
