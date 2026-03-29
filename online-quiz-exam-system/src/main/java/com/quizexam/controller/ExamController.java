package com.quizexam.controller;

import com.quizexam.model.Exam;
import com.quizexam.model.Exam.ExamStatus;
import com.quizexam.model.Question;
import com.quizexam.repository.AttemptRepository;
import com.quizexam.repository.ExamRepository;
import com.quizexam.repository.QuestionRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/exams")
public class ExamController {

    private final ExamRepository examRepository;
    private final QuestionRepository questionRepository;
    private final AttemptRepository attemptRepository;
    private final com.quizexam.repository.UserRepository userRepository;

    public ExamController(ExamRepository examRepository, QuestionRepository questionRepository,
                          AttemptRepository attemptRepository,
                          com.quizexam.repository.UserRepository userRepository) {
        this.examRepository = examRepository;
        this.questionRepository = questionRepository;
        this.attemptRepository = attemptRepository;
        this.userRepository = userRepository;
    }

    @GetMapping
    public List<Exam> listExams() {
        return examRepository.findAll();
    }

    @GetMapping("/active")
    public List<Exam> listActive() {
        return examRepository.findByStatus(ExamStatus.ACTIVE);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Exam> getExam(@PathVariable long id) {
        return examRepository.findById(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('PROFESSOR','ADMIN')")
    public ResponseEntity<Exam> createExam(@Valid @RequestBody ExamRequest req,
                                           @AuthenticationPrincipal UserDetails principal) {
        long userId = userRepository.findByUsername(principal.getUsername()).orElseThrow().getId();
        Exam exam = new Exam();
        exam.setTitle(req.title());
        exam.setDescription(req.description());
        exam.setTimeLimitMinutes(req.timeLimitMinutes());
        exam.setMarksPerQuestion(req.marksPerQuestion());
        exam.setNegativeMarking(req.negativeMarking() != null ? req.negativeMarking() : 0);
        exam.setAdaptive(req.adaptive() != null && req.adaptive());
        exam.setStatus(ExamStatus.DRAFT);
        exam.setStartDatetime(req.startDatetime());
        exam.setEndDatetime(req.endDatetime());
        exam.setCreatedBy(userId);

        if (req.questionIds() != null && !req.questionIds().isEmpty()) {
            List<Question> questions = questionRepository.findAllById(req.questionIds());
            exam.setQuestions(questions);
        }
        return ResponseEntity.ok(examRepository.save(exam));
    }

    @PutMapping("/{id}/publish")
    @PreAuthorize("hasAnyRole('PROFESSOR','ADMIN')")
    public ResponseEntity<Exam> publish(@PathVariable long id) {
        return examRepository.findById(id).map(exam -> {
            exam.setStatus(ExamStatus.ACTIVE);
            return ResponseEntity.ok(examRepository.save(exam));
        }).orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('PROFESSOR','ADMIN')")
    public ResponseEntity<?> updateExam(@PathVariable long id, @RequestBody ExamRequest req) {
        if (attemptRepository.existsByExamIdAndStatus(id, com.quizexam.model.Attempt.AttemptStatus.SUBMITTED))
            return ResponseEntity.badRequest().body(Map.of("error", "Exam has submitted attempts"));
        return examRepository.findById(id).map(exam -> {
            if (req.title() != null) exam.setTitle(req.title());
            if (req.description() != null) exam.setDescription(req.description());
            if (req.timeLimitMinutes() > 0) exam.setTimeLimitMinutes(req.timeLimitMinutes());
            if (req.marksPerQuestion() > 0) exam.setMarksPerQuestion(req.marksPerQuestion());
            if (req.negativeMarking() != null) exam.setNegativeMarking(req.negativeMarking());
            if (req.adaptive() != null) exam.setAdaptive(req.adaptive());
            if (req.startDatetime() != null) exam.setStartDatetime(req.startDatetime());
            if (req.endDatetime() != null) exam.setEndDatetime(req.endDatetime());
            return ResponseEntity.ok(examRepository.save(exam));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('PROFESSOR','ADMIN')")
    public ResponseEntity<?> deleteExam(@PathVariable long id) {
        if (attemptRepository.existsByExamIdAndStatus(id, com.quizexam.model.Attempt.AttemptStatus.SUBMITTED))
            return ResponseEntity.badRequest().body(Map.of("error", "Exam has submitted attempts"));
        examRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    public record ExamRequest(
        @NotBlank String title,
        String description,
        @Positive int timeLimitMinutes,
        @Positive int marksPerQuestion,
        Double negativeMarking,
        Boolean adaptive,
        LocalDateTime startDatetime,
        LocalDateTime endDatetime,
        List<Long> questionIds
    ) {}
}
