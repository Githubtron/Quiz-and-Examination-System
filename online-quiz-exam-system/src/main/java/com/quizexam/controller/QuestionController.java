package com.quizexam.controller;

import com.quizexam.model.*;
import com.quizexam.repository.QuestionRepository;
import com.quizexam.repository.UserRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/questions")
public class QuestionController {

    private final QuestionRepository questionRepository;
    private final UserRepository userRepository;

    public QuestionController(QuestionRepository questionRepository, UserRepository userRepository) {
        this.questionRepository = questionRepository;
        this.userRepository = userRepository;
    }

    @GetMapping
    public List<Question> list(@RequestParam(required = false) String subject,
                               @RequestParam(required = false) String difficulty) {
        if (subject != null && difficulty != null)
            return questionRepository.findBySubjectAndDifficulty(subject, Difficulty.valueOf(difficulty.toUpperCase()));
        if (subject != null) return questionRepository.findBySubject(subject);
        if (difficulty != null) return questionRepository.findByDifficulty(Difficulty.valueOf(difficulty.toUpperCase()));
        return questionRepository.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Question> get(@PathVariable long id) {
        return questionRepository.findById(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/mcq")
    @PreAuthorize("hasAnyRole('PROFESSOR','ADMIN')")
    public ResponseEntity<Question> createMCQ(@Valid @RequestBody MCQRequest req,
                                              @AuthenticationPrincipal UserDetails principal) {
        long userId = userRepository.findByUsername(principal.getUsername()).orElseThrow().getId();
        MCQ mcq = new MCQ();
        mcq.setText(req.text());
        mcq.setDifficulty(Difficulty.valueOf(req.difficulty().toUpperCase()));
        mcq.setSubject(req.subject());
        mcq.setTopic(req.topic());
        mcq.setCreatedBy(userId);
        mcq.setOptionTexts(req.options());
        mcq.setCorrectIndex(req.correctIndex());
        return ResponseEntity.ok(questionRepository.save(mcq));
    }

    @PostMapping("/tf")
    @PreAuthorize("hasAnyRole('PROFESSOR','ADMIN')")
    public ResponseEntity<Question> createTF(@Valid @RequestBody TFRequest req,
                                             @AuthenticationPrincipal UserDetails principal) {
        long userId = userRepository.findByUsername(principal.getUsername()).orElseThrow().getId();
        TrueFalseQuestion tf = new TrueFalseQuestion();
        tf.setText(req.text());
        tf.setDifficulty(Difficulty.valueOf(req.difficulty().toUpperCase()));
        tf.setSubject(req.subject());
        tf.setTopic(req.topic());
        tf.setCreatedBy(userId);
        tf.setCorrectAnswer(req.correctAnswer());
        return ResponseEntity.ok(questionRepository.save(tf));
    }

    @PostMapping("/ar")
    @PreAuthorize("hasAnyRole('PROFESSOR','ADMIN')")
    public ResponseEntity<Question> createAR(@Valid @RequestBody ARRequest req,
                                             @AuthenticationPrincipal UserDetails principal) {
        long userId = userRepository.findByUsername(principal.getUsername()).orElseThrow().getId();
        AssertionReasonQuestion ar = new AssertionReasonQuestion();
        ar.setText(req.assertion() + " | " + req.reason());
        ar.setDifficulty(Difficulty.valueOf(req.difficulty().toUpperCase()));
        ar.setSubject(req.subject());
        ar.setTopic(req.topic());
        ar.setCreatedBy(userId);
        ar.setAssertion(req.assertion());
        ar.setReason(req.reason());
        ar.setCorrectChoice(req.correctChoice());
        return ResponseEntity.ok(questionRepository.save(ar));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('PROFESSOR','ADMIN')")
    public ResponseEntity<?> delete(@PathVariable long id) {
        if (!questionRepository.existsById(id))
            return ResponseEntity.notFound().build();
        questionRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    public record MCQRequest(
        @NotBlank String text, @NotNull List<String> options,
        int correctIndex, @NotBlank String difficulty,
        String subject, String topic
    ) {}

    public record TFRequest(
        @NotBlank String text, boolean correctAnswer,
        @NotBlank String difficulty, String subject, String topic
    ) {}

    public record ARRequest(
        @NotBlank String assertion, @NotBlank String reason,
        int correctChoice, @NotBlank String difficulty,
        String subject, String topic
    ) {}
}
