package com.quizexam.controller;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.quizexam.model.Attempt;
import com.quizexam.model.Attempt.AttemptStatus;
import com.quizexam.model.AttemptAnswer;
import com.quizexam.model.AssertionReasonQuestion;
import com.quizexam.model.Exam;
import com.quizexam.model.MCQ;
import com.quizexam.model.Question;
import com.quizexam.model.Result;
import com.quizexam.model.TrueFalseQuestion;
import com.quizexam.repository.AttemptAnswerRepository;
import com.quizexam.repository.AttemptRepository;
import com.quizexam.repository.ExamRepository;
import com.quizexam.repository.ResultRepository;
import com.quizexam.repository.UserRepository;
import com.quizexam.service.ExamTemplateService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import org.springframework.dao.DataIntegrityViolationException;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/attempts")
public class AttemptController {

    private final AttemptRepository attemptRepository;
    private final ExamRepository examRepository;
    private final ResultRepository resultRepository;
    private final UserRepository userRepository;
    private final AttemptAnswerRepository attemptAnswerRepository;
    private final ExamTemplateService examTemplateService;
    private final ObjectMapper objectMapper;

    public AttemptController(AttemptRepository attemptRepository,
                             ExamRepository examRepository,
                             ResultRepository resultRepository,
                             UserRepository userRepository,
                             AttemptAnswerRepository attemptAnswerRepository,
                             ExamTemplateService examTemplateService,
                             ObjectMapper objectMapper) {
        this.attemptRepository = attemptRepository;
        this.examRepository = examRepository;
        this.resultRepository = resultRepository;
        this.userRepository = userRepository;
        this.attemptAnswerRepository = attemptAnswerRepository;
        this.examTemplateService = examTemplateService;
        this.objectMapper = objectMapper;
    }

    /** Start or resume an exam attempt */
    @PostMapping("/start/{examId}")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<?> start(@PathVariable long examId,
                                   @AuthenticationPrincipal UserDetails principal) {
        long studentId = userRepository.findByUsername(principal.getUsername()).orElseThrow().getId();
        LocalDateTime now = LocalDateTime.now();

        Exam exam = examRepository.findById(examId).orElse(null);
        if (exam == null) return ResponseEntity.notFound().build();
        if (exam.getStatus() != Exam.ExamStatus.ACTIVE) {
            return ResponseEntity.badRequest().body(Map.of("error", "Exam is not active"));
        }

        Attempt attempt = null;
        boolean resumed = false;
        var existing = attemptRepository.findByStudentIdAndExamId(studentId, examId);
        if (existing != null && existing.getStatus() == AttemptStatus.IN_PROGRESS) {
            if (isAttemptExpired(existing, exam, now)) {
                submitAttempt(existing, exam, Map.of(), now);
                // Expired attempt submitted, will fall through to create a new one
            } else {
                attempt = existing;
                resumed = true;
            }
        }

        if (!resumed) {
            if (exam.getStartDatetime() != null && now.isBefore(exam.getStartDatetime())) {
                return ResponseEntity.badRequest().body(Map.of("error", "Exam has not started yet"));
            }
            if (exam.getEndDatetime() != null && now.isAfter(exam.getEndDatetime())) {
                return ResponseEntity.badRequest().body(Map.of("error", "Exam has ended"));
            }
            Attempt created = new Attempt();
            created.setExamId(examId);
            created.setStudentId(studentId);
            created.setStartedAt(now);
            created.setStatus(AttemptStatus.IN_PROGRESS);
            attempt = attemptRepository.save(created);
        }

        List<ExamTemplateService.StudentQuestion> studentQuestions;
        try {
            studentQuestions = examTemplateService.buildStudentQuestionPayload(examId, studentId);
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }

        return ResponseEntity.ok(new StartExamResponse(
            attempt.getId(),
            resumed,
            new ExamSnapshot(
                exam.getId(),
                exam.getTitle(),
                exam.getTimeLimitMinutes(),
                exam.getMarksPerQuestion(),
                exam.getNegativeMarking(),
                studentQuestions.size()
            ),
            studentQuestions
        ));
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
        if (attempt.getStudentId() != studentId) {
            return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
        }
        if (attempt.getStatus() == AttemptStatus.SUBMITTED) {
            return ResponseEntity.badRequest().body(Map.of("error", "Attempt already submitted"));
        }

        Exam exam = examRepository.findById(attempt.getExamId()).orElseThrow();
        LocalDateTime now = LocalDateTime.now();
        if (isAttemptExpired(attempt, exam, now)) {
            submitAttempt(attempt, exam, Map.of(), now);
            return ResponseEntity.badRequest().body(Map.of("error", "Time is over. Attempt auto-submitted"));
        }

        SubmissionResult result = submitAttempt(
            attempt,
            exam,
            req.answers() != null ? req.answers() : Map.of(),
            now
        );

        return ResponseEntity.ok(Map.of(
            "score", result.correct(),
            "total", result.totalQuestions(),
            "totalScore", result.totalScore(),
            "maxScore", result.maxScore(),
            "percentage", result.percentage(),
            "passed", result.percentage() >= 50
        ));
    }

    /** Log a tab switch */
    @PostMapping("/{attemptId}/tab-switch")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<?> tabSwitch(@PathVariable long attemptId) {
        return attemptRepository.findById(attemptId).map(a -> {
            if (a.getStatus() != AttemptStatus.IN_PROGRESS) {
                return ResponseEntity.ok(a);
            }
            Exam exam = examRepository.findById(a.getExamId()).orElse(null);
            LocalDateTime now = LocalDateTime.now();
            if (exam != null && isAttemptExpired(a, exam, now)) {
                submitAttempt(a, exam, Map.of(), now);
                return ResponseEntity.ok(a);
            }
            a.setTabSwitchCount(a.getTabSwitchCount() + 1);
            return ResponseEntity.ok(attemptRepository.save(a));
        }).orElse(ResponseEntity.notFound().build());
    }

    /** Get my attempts */
    @GetMapping("/my")
    @PreAuthorize("hasRole('STUDENT')")
    public List<Attempt> myAttempts(@AuthenticationPrincipal UserDetails principal) {
        long studentId = userRepository.findByUsername(principal.getUsername()).orElseThrow().getId();
        autoSubmitExpiredAttempts(studentId);
        return attemptRepository.findByStudentId(studentId);
    }

    private void autoSubmitExpiredAttempts(long studentId) {
        LocalDateTime now = LocalDateTime.now();
        for (Attempt attempt : attemptRepository.findByStudentId(studentId)) {
            if (attempt.getStatus() != AttemptStatus.IN_PROGRESS) continue;
            Exam exam = examRepository.findById(attempt.getExamId()).orElse(null);
            if (exam == null) continue;
            if (isAttemptExpired(attempt, exam, now)) {
                submitAttempt(attempt, exam, Map.of(), now);
            }
        }
    }

    private boolean isAttemptExpired(Attempt attempt, Exam exam, LocalDateTime now) {
        if (exam.getEndDatetime() != null && now.isAfter(exam.getEndDatetime())) return true;
        if (attempt.getStartedAt() == null) return false;
        LocalDateTime timeLimitEnd = attempt.getStartedAt().plusMinutes(exam.getTimeLimitMinutes());
        return !now.isBefore(timeLimitEnd);
    }

    private SubmissionResult submitAttempt(Attempt attempt, Exam exam, Map<String, String> answers, LocalDateTime submittedAt) {
        List<Question> assignedQuestions = examTemplateService.getAssignedQuestions(exam.getId(), attempt.getStudentId());

        int correct = 0;
        List<AttemptAnswer> answerRecords = new ArrayList<>();
        List<Map<String, Object>> detail = new ArrayList<>();

        for (Question q : assignedQuestions) {
            String given = answers.get(String.valueOf(q.getId()));
            boolean isCorrect = examTemplateService.isCorrectForStudent(exam.getId(), attempt.getStudentId(), q, given);
            if (isCorrect) correct++;

            answerRecords.add(new AttemptAnswer(attempt.getId(), q.getId(), given, isCorrect));

            Map<String, Object> questionDetail = new LinkedHashMap<>();
            questionDetail.put("questionId", q.getId());
            questionDetail.put("questionType", q.getType());
            questionDetail.put("questionText", q.getText());
            questionDetail.put("studentAnswer", given);
            questionDetail.put("correctAnswer", q.getCorrectAnswerValue());
            questionDetail.put("isCorrect", isCorrect);

            if (q instanceof MCQ mcq) {
                questionDetail.put("options", mcq.getOptionTexts());
            } else if (q instanceof TrueFalseQuestion) {
                questionDetail.put("options", List.of("True", "False"));
            } else if (q instanceof AssertionReasonQuestion ar) {
                questionDetail.put("assertion", ar.getAssertion());
                questionDetail.put("reason", ar.getReason());
                questionDetail.put("options", List.of(
                    "Both A and R are true, and R is the correct explanation of A",
                    "Both A and R are true, but R is not the correct explanation of A",
                    "A is true but R is false",
                    "A is false but R is true"
                ));
            }

            detail.add(questionDetail);
        }

        attempt.setStatus(AttemptStatus.SUBMITTED);
        attempt.setSubmittedAt(submittedAt);
        attemptRepository.save(attempt);

        attemptAnswerRepository.deleteByAttemptId(attempt.getId());
        attemptAnswerRepository.saveAll(answerRecords);

        int maxScore = assignedQuestions.size() * exam.getMarksPerQuestion();
        double totalScore = correct * exam.getMarksPerQuestion();
        double percentage = maxScore == 0 ? 0 : (totalScore * 100.0 / maxScore);

        Result result = resultRepository.findByAttemptId(attempt.getId()).orElseGet(Result::new);
        result.setAttemptId(attempt.getId());
        result.setTotalScore(totalScore);
        result.setMaxScore(maxScore);
        result.setPercentage(percentage);
        result.setDetailJson(toDetailJson(detail));
        try {
            resultRepository.save(result);
        } catch (DataIntegrityViolationException ignored) {
            // Concurrent submission — a result already exists for this attempt; that's fine
        }

        return new SubmissionResult(correct, assignedQuestions.size(), totalScore, maxScore, percentage);
    }

    private String toDetailJson(List<Map<String, Object>> detail) {
        try {
            return objectMapper.writeValueAsString(detail);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build result detail JSON", e);
        }
    }

    public record SubmitRequest(Map<String, String> answers) {}

    public record ExamSnapshot(
        long id,
        String title,
        int timeLimitMinutes,
        int marksPerQuestion,
        double negativeMarking,
        int totalQuestions
    ) {}

    public record StartExamResponse(
        long attemptId,
        boolean resumed,
        ExamSnapshot exam,
        List<ExamTemplateService.StudentQuestion> questions
    ) {}

    private record SubmissionResult(
        int correct,
        int totalQuestions,
        double totalScore,
        int maxScore,
        double percentage
    ) {}
}
