package com.quizexam.controller;

import com.quizexam.model.*;
import com.quizexam.repository.QuestionRepository;
import com.quizexam.repository.UserRepository;
import com.quizexam.service.AiQuestionGeneratorService;
import com.quizexam.service.AiQuestionGeneratorService.GeneratedQuestion;
import com.quizexam.service.DocumentTextExtractor;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/questions")
public class QuestionController {

    private final QuestionRepository questionRepository;
    private final UserRepository userRepository;
    private final DocumentTextExtractor textExtractor;
    private final AiQuestionGeneratorService aiService;

    public QuestionController(QuestionRepository questionRepository, UserRepository userRepository,
                               DocumentTextExtractor textExtractor, AiQuestionGeneratorService aiService) {
        this.questionRepository = questionRepository;
        this.userRepository = userRepository;
        this.textExtractor = textExtractor;
        this.aiService = aiService;
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

    /**
     * POST /api/questions/generate
     * Upload a PDF or DOCX, extract text, call Gemini AI, return generated MCQs (not saved yet).
     */
    @PostMapping("/generate")
    @PreAuthorize("hasAnyRole('PROFESSOR','ADMIN')")
    public ResponseEntity<?> generateFromDocument(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "count", defaultValue = "5") int count) {
        try {
            if (count < 1 || count > 20) count = 5;
            String text = textExtractor.extract(file);
            List<GeneratedQuestion> questions = aiService.generate(text, count);
            return ResponseEntity.ok(Map.of(
                "filename", file.getOriginalFilename(),
                "questions", questions
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(503).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Failed to generate questions: " + e.getMessage()));
        }
    }

    /**
     * POST /api/questions/save-generated
     * Save a list of approved generated MCQs to the question bank.
     */
    @PostMapping("/save-generated")
    @PreAuthorize("hasAnyRole('PROFESSOR','ADMIN')")
    public ResponseEntity<?> saveGenerated(
            @Valid @RequestBody SaveGeneratedRequest req,
            @AuthenticationPrincipal UserDetails principal) {
        long userId = userRepository.findByUsername(principal.getUsername()).orElseThrow().getId();
        List<Question> saved = req.questions().stream().map(q -> {
            MCQ mcq = new MCQ();
            mcq.setText(q.text());
            mcq.setDifficulty(parseDifficulty(q.difficulty()));
            mcq.setSubject(q.subject());
            mcq.setTopic(q.topic());
            mcq.setCreatedBy(userId);
            mcq.setOptionTexts(q.options());
            mcq.setCorrectIndex(q.correctIndex());
            mcq.setSourceDocument(req.sourceDocument());
            return (Question) questionRepository.save(mcq);
        }).toList();
        return ResponseEntity.ok(Map.of("saved", saved.size(), "questions", saved));
    }

    private Difficulty parseDifficulty(String d) {
        try { return Difficulty.valueOf(d.toUpperCase()); }
        catch (Exception e) { return Difficulty.MEDIUM; }
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

    public record SaveGeneratedRequest(
        @NotBlank String sourceDocument,
        @NotNull List<GeneratedQuestion> questions
    ) {}
}
