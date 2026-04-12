package com.quizexam.controller;

import com.quizexam.model.*;
import com.quizexam.repository.*;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/analytics")
@PreAuthorize("hasAnyRole('PROFESSOR','ADMIN')")
public class AnalyticsController {

    private final ResultRepository resultRepository;
    private final AttemptRepository attemptRepository;
    private final AttemptAnswerRepository attemptAnswerRepository;
    private final QuestionRepository questionRepository;
    private final UserRepository userRepository;

    public AnalyticsController(ResultRepository resultRepository,
                                AttemptRepository attemptRepository,
                                AttemptAnswerRepository attemptAnswerRepository,
                                QuestionRepository questionRepository,
                                UserRepository userRepository) {
        this.resultRepository = resultRepository;
        this.attemptRepository = attemptRepository;
        this.attemptAnswerRepository = attemptAnswerRepository;
        this.questionRepository = questionRepository;
        this.userRepository = userRepository;
    }

    /**
     * GET /api/analytics/exam/{examId}/stats
     * Returns average, median, highest, lowest score and pass percentage.
     */
    @GetMapping("/exam/{examId}/stats")
    public ResponseEntity<ExamStats> examStats(@PathVariable long examId) {
        List<Result> results = resultRepository.findByExamId(examId);
        if (results.isEmpty())
            return ResponseEntity.ok(new ExamStats(examId, 0, 0, 0, 0, 0, 0));

        List<Double> scores = results.stream().map(Result::getPercentage).sorted().toList();
        int n = scores.size();
        double avg = scores.stream().mapToDouble(Double::doubleValue).average().orElse(0);
        double median = n % 2 == 0
            ? (scores.get(n / 2 - 1) + scores.get(n / 2)) / 2.0
            : scores.get(n / 2);
        double highest = scores.get(n - 1);
        double lowest = scores.get(0);
        double passPercent = scores.stream().filter(s -> s >= 50).count() * 100.0 / n;

        return ResponseEntity.ok(new ExamStats(examId, avg, median, highest, lowest, passPercent, n));
    }

    /**
     * GET /api/analytics/exam/{examId}/hardest-questions?limit=5
     * Returns questions ranked by incorrect response rate.
     */
    @GetMapping("/exam/{examId}/hardest-questions")
    public ResponseEntity<List<QuestionStats>> hardestQuestions(
            @PathVariable long examId,
            @RequestParam(defaultValue = "5") int limit) {

        List<Attempt> attempts = attemptRepository.findByExamId(examId).stream()
            .filter(a -> a.getStatus() == Attempt.AttemptStatus.SUBMITTED)
            .toList();

        if (attempts.isEmpty()) return ResponseEntity.ok(List.of());

        List<Long> attemptIds = attempts.stream().map(Attempt::getId).toList();
        List<AttemptAnswer> answers = attemptAnswerRepository.findByAttemptIdIn(attemptIds);

        // Group by questionId
        Map<Long, List<AttemptAnswer>> byQuestion = answers.stream()
            .collect(Collectors.groupingBy(AttemptAnswer::getQuestionId));

        List<QuestionStats> stats = byQuestion.entrySet().stream().map(entry -> {
            long qId = entry.getKey();
            List<AttemptAnswer> qAnswers = entry.getValue();
            int total = qAnswers.size();
            int incorrect = (int) qAnswers.stream().filter(a -> !a.isCorrect()).count();
            double rate = total > 0 ? incorrect * 100.0 / total : 0;
            String text = questionRepository.findById(qId).map(Question::getText).orElse("Unknown");
            return new QuestionStats(qId, text, total, incorrect, rate);
        })
        .sorted(Comparator.comparingDouble(QuestionStats::getIncorrectRate).reversed())
        .limit(limit)
        .toList();

        return ResponseEntity.ok(stats);
    }

    /**
     * GET /api/analytics/student/{studentId}/progress
     * Returns per-exam scores for a student (for line chart).
     */
    @GetMapping("/student/{studentId}/progress")
    public ResponseEntity<List<Map<String, Object>>> studentProgress(@PathVariable long studentId) {
        List<Result> results = resultRepository.findByStudentId(studentId);
        List<Map<String, Object>> progress = results.stream().map(r -> {
            Attempt attempt = attemptRepository.findById(r.getAttemptId()).orElse(null);
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("attemptId", r.getAttemptId());
            entry.put("examId", attempt != null ? attempt.getExamId() : null);
            entry.put("submittedAt", attempt != null ? attempt.getSubmittedAt() : null);
            entry.put("totalScore", r.getTotalScore());
            entry.put("maxScore", r.getMaxScore());
            entry.put("percentage", r.getPercentage());
            return entry;
        }).toList();
        return ResponseEntity.ok(progress);
    }

    /**
     * GET /api/analytics/exam/{examId}/score-distribution
     * Returns score bucket counts for pie/bar chart.
     */
    @GetMapping("/exam/{examId}/score-distribution")
    public ResponseEntity<Map<String, Long>> scoreDistribution(@PathVariable long examId) {
        List<Result> results = resultRepository.findByExamId(examId);
        Map<String, Long> buckets = new LinkedHashMap<>();
        buckets.put("0-20", results.stream().filter(r -> r.getPercentage() < 20).count());
        buckets.put("20-40", results.stream().filter(r -> r.getPercentage() >= 20 && r.getPercentage() < 40).count());
        buckets.put("40-60", results.stream().filter(r -> r.getPercentage() >= 40 && r.getPercentage() < 60).count());
        buckets.put("60-80", results.stream().filter(r -> r.getPercentage() >= 60 && r.getPercentage() < 80).count());
        buckets.put("80-100", results.stream().filter(r -> r.getPercentage() >= 80).count());
        return ResponseEntity.ok(buckets);
    }
}
