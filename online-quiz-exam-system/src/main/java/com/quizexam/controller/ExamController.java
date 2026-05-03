package com.quizexam.controller;

import com.quizexam.model.Exam;
import com.quizexam.model.Exam.ExamStatus;
import com.quizexam.model.Category;
import com.quizexam.model.Difficulty;
import com.quizexam.model.MCQ;
import com.quizexam.model.Question;
import com.quizexam.model.Role;
import com.quizexam.model.User;
import com.quizexam.repository.AttemptRepository;
import com.quizexam.repository.CategoryRepository;
import com.quizexam.repository.ExamRepository;
import com.quizexam.repository.QuestionRepository;
import com.quizexam.repository.UserRepository;
import com.quizexam.service.AiQuestionGeneratorService;
import com.quizexam.service.AiQuestionGeneratorService.GeneratedQuestion;
import com.quizexam.service.AutoCategorizationService;
import com.quizexam.service.DocumentTextExtractor;
import com.quizexam.service.ExamTemplateService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@RestController
@RequestMapping("/api/exams")
public class ExamController {

    private final ExamRepository examRepository;
    private final QuestionRepository questionRepository;
    private final AttemptRepository attemptRepository;
    private final UserRepository userRepository;
    private final CategoryRepository categoryRepository;
    private final DocumentTextExtractor textExtractor;
    private final AiQuestionGeneratorService aiService;
    private final AutoCategorizationService autoCategorizationService;
    private final ExamTemplateService examTemplateService;

    public ExamController(ExamRepository examRepository,
                          QuestionRepository questionRepository,
                          AttemptRepository attemptRepository,
                          UserRepository userRepository,
                          CategoryRepository categoryRepository,
                          DocumentTextExtractor textExtractor,
                          AiQuestionGeneratorService aiService,
                          AutoCategorizationService autoCategorizationService,
                          ExamTemplateService examTemplateService) {
        this.examRepository = examRepository;
        this.questionRepository = questionRepository;
        this.attemptRepository = attemptRepository;
        this.userRepository = userRepository;
        this.categoryRepository = categoryRepository;
        this.textExtractor = textExtractor;
        this.aiService = aiService;
        this.autoCategorizationService = autoCategorizationService;
        this.examTemplateService = examTemplateService;
    }

    @GetMapping
    public List<ExamResponse> listExams(@AuthenticationPrincipal UserDetails principal) {
        User currentUser = userRepository.findByUsername(principal.getUsername()).orElseThrow();
        if (currentUser.getRole() == Role.STUDENT) {
            LocalDateTime now = LocalDateTime.now();
            return examRepository.findByStatus(ExamStatus.ACTIVE).stream()
                .filter(exam -> isExamOpenNow(exam, now))
                .map(this::toResponse)
                .toList();
        }
        return examRepository.findAll().stream().map(this::toResponse).toList();
    }

    @GetMapping("/active")
    public List<ExamResponse> listActive(@AuthenticationPrincipal UserDetails principal) {
        User currentUser = userRepository.findByUsername(principal.getUsername()).orElseThrow();
        LocalDateTime now = LocalDateTime.now();
        return examRepository.findByStatus(ExamStatus.ACTIVE).stream()
            .filter(exam -> currentUser.getRole() != Role.STUDENT || isExamOpenNow(exam, now))
            .map(this::toResponse)
            .toList();
    }

    @GetMapping("/{id}")
    public ResponseEntity<ExamResponse> getExam(@PathVariable long id) {
        return examRepository.findById(id)
            .map(exam -> ResponseEntity.ok(toResponse(exam)))
            .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/templates")
    public ResponseEntity<?> getTemplate(@PathVariable long id) {
        if (!examRepository.existsById(id)) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(examTemplateService.getTemplateEntries(id));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('PROFESSOR','ADMIN')")
    public ResponseEntity<?> createExam(@Valid @RequestBody ExamRequest req,
                                        @AuthenticationPrincipal UserDetails principal) {
        if ((req.template() == null || req.template().isEmpty()) &&
            (req.questionIds() == null || req.questionIds().isEmpty())) {
            return ResponseEntity.badRequest().body(Map.of("error", "Provide template rules (or legacy questionIds)"));
        }

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

        Exam saved = examRepository.save(exam);

        if (req.template() != null && !req.template().isEmpty()) {
            try {
                examTemplateService.replaceTemplate(saved.getId(), mapTemplateRules(req.template()));
            } catch (IllegalArgumentException | IllegalStateException e) {
                examRepository.deleteById(saved.getId());
                return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
            }
        }

        return ResponseEntity.ok(toResponse(saved));
    }

    @PostMapping("/create-from-pdf")
    @PreAuthorize("hasRole('PROFESSOR')")
    @Transactional
    public ResponseEntity<?> createExamFromPdf(@RequestParam("file") MultipartFile file,
                                               @RequestParam("title") String title,
                                               @RequestParam("duration") int duration,
                                               @RequestParam("questionCount") int questionCount,
                                               @RequestParam(value = "difficulty", defaultValue = "MIXED") String difficulty,
                                               @AuthenticationPrincipal UserDetails principal) {
        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "PDF file is required"));
        }
        String filename = file.getOriginalFilename() == null ? "document.pdf" : file.getOriginalFilename();
        if (!filename.toLowerCase(Locale.ROOT).endsWith(".pdf")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Only PDF files are supported for this endpoint"));
        }
        String contentType = file.getContentType();
        if (contentType == null || !contentType.equalsIgnoreCase("application/pdf")) {
            return ResponseEntity.badRequest().body(Map.of("error", "File must be a PDF (invalid content type)"));
        }
        try (InputStream magicStream = file.getInputStream()) {
            byte[] magic = new byte[4];
            int read = magicStream.read(magic);
            if (read < 4 || magic[0] != 0x25 || magic[1] != 0x50 || magic[2] != 0x44 || magic[3] != 0x46) {
                return ResponseEntity.badRequest().body(Map.of("error", "File content is not a valid PDF"));
            }
        } catch (IOException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Could not read file"));
        }
        if (duration < 1) {
            return ResponseEntity.badRequest().body(Map.of("error", "duration must be at least 1 minute"));
        }
        if (questionCount < 1 || questionCount > 50) {
            return ResponseEntity.badRequest().body(Map.of("error", "questionCount must be between 1 and 50"));
        }

        String normalizedDifficulty;
        try {
            normalizedDifficulty = normalizeDifficultyMode(difficulty);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }

        try {
            long userId = userRepository.findByUsername(principal.getUsername()).orElseThrow().getId();
            String extractedText = textExtractor.extract(file);
            AutoCategorizationService.AutoCategorizationResult autoResult =
                autoCategorizationService.detectAndEnsureCategory(extractedText);

            String generationDifficulty = normalizedDifficulty;
            List<GeneratedQuestion> generatedQuestions =
                aiService.generate(extractedText, questionCount, generationDifficulty);
            if (generatedQuestions.size() < questionCount) {
                return ResponseEntity.status(503).body(Map.of(
                    "error", "Could not generate enough questions from the uploaded document"
                ));
            }

            Category category = autoResult.category();
            List<Question> savedQuestions = new ArrayList<>();
            for (GeneratedQuestion generatedQuestion : generatedQuestions.stream().limit(questionCount).toList()) {
                MCQ mcq = new MCQ();
                mcq.setText(generatedQuestion.text());
                mcq.setDifficulty(parseDifficulty(generatedQuestion.difficulty(), autoResult.difficulty()));
                mcq.setSubject(firstNonBlank(generatedQuestion.subject(), autoResult.subject()));
                mcq.setTopic(firstNonBlank(generatedQuestion.topic(), autoResult.topics().isEmpty() ? null : autoResult.topics().get(0)));
                mcq.setExplanation(generatedQuestion.explanation());
                mcq.setCreatedBy(userId);
                mcq.setCategory(category);
                mcq.setSourceDocument(filename);
                mcq.setOptionTexts(generatedQuestion.options());
                mcq.setCorrectIndex(generatedQuestion.correctIndex());
                savedQuestions.add(questionRepository.save(mcq));
            }

            Exam exam = new Exam();
            exam.setTitle(resolveExamTitle(title, filename));
            exam.setDescription("Auto-generated from PDF: " + filename);
            exam.setTimeLimitMinutes(duration);
            exam.setMarksPerQuestion(1);
            exam.setNegativeMarking(0);
            exam.setAdaptive(false);
            exam.setStatus(ExamStatus.DRAFT);
            exam.setCreatedBy(userId);
            exam.setSourcePdf(filename);
            exam.setAutoGenerated(true);
            exam.setQuestions(savedQuestions);
            Exam savedExam = examRepository.save(exam);

            return ResponseEntity.ok(new CreateFromPdfResponse(
                toResponse(savedExam),
                new CategorySummary(category.getId(), category.getName(), category.getDescription()),
                autoResult.topics(),
                autoResult.difficulty(),
                toGeneratedQuestionResponses(savedQuestions)
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(503).body(Map.of("error", e.getMessage()));
        } catch (IOException e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Failed to read PDF: " + e.getMessage()));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return ResponseEntity.status(503).body(Map.of("error", "AI request was interrupted"));
        }
    }

    @PutMapping("/{id}/auto-category")
    @PreAuthorize("hasAnyRole('PROFESSOR','ADMIN')")
    @Transactional
    public ResponseEntity<?> updateAutoCategory(@PathVariable long id,
                                                @Valid @RequestBody AutoCategoryUpdateRequest req) {
        Category category = categoryRepository.findById(req.categoryId())
            .orElse(null);
        if (category == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Category not found: " + req.categoryId()));
        }

        return examRepository.findById(id).map(exam -> {
            if (!exam.isAutoGenerated()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Category override is only available for auto-generated exams"));
            }
            List<Question> questions = questionRepository.findByExamId(id);
            for (Question question : questions) {
                question.setCategory(category);
                question.setSubject(category.getName());
            }
            questionRepository.saveAll(questions);
            return ResponseEntity.ok(Map.of(
                "exam", toResponse(exam),
                "category", new CategorySummary(category.getId(), category.getName(), category.getDescription())
            ));
        }).orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}/publish")
    @PreAuthorize("hasAnyRole('PROFESSOR','ADMIN')")
    public ResponseEntity<ExamResponse> publish(@PathVariable long id) {
        return examRepository.findById(id).map(exam -> {
            exam.setStatus(ExamStatus.ACTIVE);
            return ResponseEntity.ok(toResponse(examRepository.save(exam)));
        }).orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('PROFESSOR','ADMIN')")
    public ResponseEntity<?> updateExam(@PathVariable long id, @RequestBody ExamRequest req) {
        if (attemptRepository.existsByExamIdAndStatus(id, com.quizexam.model.Attempt.AttemptStatus.SUBMITTED)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Exam has submitted attempts"));
        }
        return examRepository.findById(id).map(exam -> {
            if (req.title() != null) exam.setTitle(req.title());
            if (req.description() != null) exam.setDescription(req.description());
            if (req.timeLimitMinutes() > 0) exam.setTimeLimitMinutes(req.timeLimitMinutes());
            if (req.marksPerQuestion() > 0) exam.setMarksPerQuestion(req.marksPerQuestion());
            if (req.negativeMarking() != null) exam.setNegativeMarking(req.negativeMarking());
            if (req.adaptive() != null) exam.setAdaptive(req.adaptive());
            if (req.startDatetime() != null) exam.setStartDatetime(req.startDatetime());
            if (req.endDatetime() != null) exam.setEndDatetime(req.endDatetime());
            if (req.questionIds() != null) {
                List<Question> questions = questionRepository.findAllById(req.questionIds());
                exam.setQuestions(questions);
            }

            Exam saved = examRepository.save(exam);

            if (req.template() != null) {
                if (req.template().isEmpty()) {
                    if (req.questionIds() == null || req.questionIds().isEmpty()) {
                        return ResponseEntity.badRequest().body(Map.of("error", "Template cannot be empty when no legacy questionIds are provided"));
                    }
                    examTemplateService.clearTemplate(id);
                } else {
                    try {
                        examTemplateService.replaceTemplate(saved.getId(), mapTemplateRules(req.template()));
                    } catch (IllegalArgumentException | IllegalStateException e) {
                        return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
                    }
                }
            }

            return ResponseEntity.ok(toResponse(saved));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('PROFESSOR','ADMIN')")
    public ResponseEntity<?> deleteExam(@PathVariable long id) {
        if (attemptRepository.existsByExamIdAndStatus(id, com.quizexam.model.Attempt.AttemptStatus.SUBMITTED)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Exam has submitted attempts"));
        }
        examTemplateService.clearTemplate(id);
        examRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    private List<ExamTemplateService.TemplateRule> mapTemplateRules(List<TemplateRuleRequest> template) {
        return template.stream()
            .map(rule -> new ExamTemplateService.TemplateRule(rule.categoryId(), rule.questionCount()))
            .toList();
    }

    private boolean isExamOpenNow(Exam exam, LocalDateTime now) {
        if (exam.getStartDatetime() != null && now.isBefore(exam.getStartDatetime())) return false;
        if (exam.getEndDatetime() != null && now.isAfter(exam.getEndDatetime())) return false;
        return true;
    }

    private ExamResponse toResponse(Exam exam) {
        return new ExamResponse(
            exam.getId(),
            exam.getTitle(),
            exam.getDescription(),
            exam.getTimeLimitMinutes(),
            exam.getMarksPerQuestion(),
            exam.getNegativeMarking(),
            exam.isAdaptive(),
            exam.getStatus(),
            exam.getStartDatetime(),
            exam.getEndDatetime(),
            exam.getCreatedBy(),
            exam.getCreatedAt(),
            examTemplateService.getTotalQuestionCount(exam.getId()),
            exam.getSourcePdf(),
            exam.isAutoGenerated()
        );
    }

    private List<GeneratedExamQuestionResponse> toGeneratedQuestionResponses(List<Question> questions) {
        return questions.stream()
            .filter(question -> question instanceof MCQ)
            .map(question -> {
                MCQ mcq = (MCQ) question;
                return new GeneratedExamQuestionResponse(
                    mcq.getId(),
                    mcq.getText(),
                    mcq.getOptionTexts(),
                    mcq.getCorrectIndex(),
                    mcq.getDifficulty(),
                    mcq.getTopic(),
                    mcq.getExplanation(),
                    true
                );
            })
            .toList();
    }

    private String resolveExamTitle(String examTitle, String filename) {
        if (examTitle != null && !examTitle.isBlank()) {
            return examTitle.trim();
        }
        int dot = filename.lastIndexOf('.');
        return dot > 0 ? filename.substring(0, dot) : filename;
    }

    private Difficulty parseDifficulty(String rawDifficulty, Difficulty fallback) {
        if (rawDifficulty == null || rawDifficulty.isBlank()) return fallback;
        try {
            return Difficulty.valueOf(rawDifficulty.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return fallback;
        }
    }

    private String normalizeDifficultyMode(String value) {
        if (value == null || value.isBlank()) return "MIXED";
        return switch (value.trim().toUpperCase(Locale.ROOT)) {
            case "EASY", "MEDIUM", "HARD", "MIXED" -> value.trim().toUpperCase(Locale.ROOT);
            default -> throw new IllegalArgumentException("difficulty must be EASY, MEDIUM, HARD, or MIXED");
        };
    }

    private String firstNonBlank(String a, String b) {
        if (a != null && !a.isBlank()) return a;
        if (b != null && !b.isBlank()) return b;
        return null;
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
        List<Long> questionIds,
        List<TemplateRuleRequest> template
    ) {}

    public record TemplateRuleRequest(
        @Positive long categoryId,
        @Positive int questionCount
    ) {}

    public record ExamResponse(
        long id,
        String title,
        String description,
        int timeLimitMinutes,
        int marksPerQuestion,
        double negativeMarking,
        boolean adaptive,
        ExamStatus status,
        LocalDateTime startDatetime,
        LocalDateTime endDatetime,
        long createdBy,
        LocalDateTime createdAt,
        int totalQuestions,
        String sourcePdf,
        boolean autoGenerated
    ) {}

    public record CategorySummary(long id, String name, String description) {}

    public record GeneratedExamQuestionResponse(
        long id,
        String question,
        List<String> options,
        int correctIndex,
        Difficulty difficulty,
        String topic,
        String explanation,
        boolean approved
    ) {}

    public record CreateFromPdfResponse(
        ExamResponse exam,
        CategorySummary detectedCategory,
        List<String> detectedTopics,
        Difficulty detectedDifficulty,
        List<GeneratedExamQuestionResponse> questions
    ) {}

    public record AutoCategoryUpdateRequest(@Positive long categoryId) {}
}
