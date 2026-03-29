package com.quizexam.controller;

import com.quizexam.model.*;
import com.quizexam.model.Attempt.AttemptStatus;
import com.quizexam.repository.*;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/attempts")
public class AttemptController {

    private final AttemptRepository attemptRepository;
    private final ExamRepository examRepository;
    private final ResultRepository resultRepository;
    private final UserRepository userRepository;

    public AttemptController(AttemptRepository attemptRepository, ExamRepository examRepository,
                             ResultRepository resultRepository, UserRepository userRepository) {
        this.attemptRepository = attemptRepository;
        this.examRepository = examRepository;
        this.resultRepository = resultRepository;
        this.userRepository = userRepository;
    }

    /** Start or resume an exam attempt */
    @PostMapping("/start/{examId}")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<?> start(@PathVariable long examId,
                                   @AuthenticationPrincipal UserDetails principal) {
        long studentId = userRepository.findByUsername(principal.getUsername()).orElseThrow().getId();

        Exam exam = examRepository.findById(examId).orElse(null);
        if (exam == null) return ResponseEntity.notFound().build();
        if (exam.getStatus() != Exam.ExamStatus.ACTIVE)
            return ResponseEntity.badRequest().body(Map.of("error", "Exam is not active"));

        // Check for existing attempt
        var existing = attemptRepository.findByStudentIdAndExamId(studentId, examId);
        if (existing.isPresent()) {
            if (existing.get().getStatus() == AttemptStatus.SUBMITTED)
                return ResponseEntity.badRequest().body(Map.of("error", "Already submitted"));
            return ResponseEntity.ok(existing.get());
        }

        Attempt attempt = new Attempt();
        attempt.setExamId(examId);
        attempt.setStudentId(studentId);
        attempt.setStartedAt(LocalDateTime.now());
        attempt.setStatus(AttemptStatus.IN_PROGRESS);
        return ResponseEntity.ok(attemptRepository.save(attempt));
    }

    /** Submit an attempt and record result */
    @PostMapping("/{attemptId}/submit")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<?> submit(@PathVariable long attemptId,
                                    @RequestBody SubmitRequest req,
                                    @AuthenticationPrincipal UserDetails principal) {
        Attempt attempt = attemptRepository.findById(attemptId).orElse(null);
        if (attempt == null) return ResponseEntity.notFound().build();

        long studentId = userRepository.findByUsername(principal.getUsername()).orElseThrow().getId();
        if (attempt.getStudentId() != studentId)
            return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));

        attempt.setStatus(AttemptStatus.SUBMITTED);
        attempt.setSubmittedAt(LocalDateTime.now());
        attemptRepository.save(attempt);

        // Score the attempt
        Exam exam = examRepository.findById(attempt.getExamId()).orElseThrow();
        List<Question> questions = exam.getQuestions();
        int correct = 0;
        for (Question q : questions) {
            String given = req.answers() != null ? req.answers().get(String.valueOf(q.getId())) : null;
            if (given != null && given.equals(q.getCorrectAnswerValue())) correct++;
        }
        int maxScore = questions.size() * exam.getMarksPerQuestion();
        double totalScore = correct * exam.getMarksPerQuestion();
        double percentage = questions.isEmpty() ? 0 : (correct * 100.0 / questions.size());

        Result result = new Result();
        result.setAttemptId(attemptId);
        result.setTotalScore(totalScore);
        result.setMaxScore(maxScore);
        result.setPercentage(percentage);
        resultRepository.save(result);

        return ResponseEntity.ok(Map.of(
            "score", correct,
            "total", questions.size(),
            "totalScore", totalScore,
            "maxScore", maxScore,
            "percentage", percentage,
            "passed", percentage >= 50
        ));
    }

    /** Log a tab switch */
    @PostMapping("/{attemptId}/tab-switch")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<?> tabSwitch(@PathVariable long attemptId) {
        return attemptRepository.findById(attemptId).map(a -> {
            a.setTabSwitchCount(a.getTabSwitchCount() + 1);
            return ResponseEntity.ok(attemptRepository.save(a));
        }).orElse(ResponseEntity.notFound().build());
    }

    /** Get my attempts */
    @GetMapping("/my")
    @PreAuthorize("hasRole('STUDENT')")
    public List<Attempt> myAttempts(@AuthenticationPrincipal UserDetails principal) {
        long studentId = userRepository.findByUsername(principal.getUsername()).orElseThrow().getId();
        return attemptRepository.findByStudentId(studentId);
    }

    public record SubmitRequest(Map<String, String> answers) {}
}
