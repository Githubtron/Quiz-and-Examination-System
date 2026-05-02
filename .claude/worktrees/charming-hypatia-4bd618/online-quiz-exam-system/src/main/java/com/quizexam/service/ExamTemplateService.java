package com.quizexam.service;

import com.quizexam.model.*;
import com.quizexam.repository.CategoryRepository;
import com.quizexam.repository.ExamRepository;
import com.quizexam.repository.ExamTemplateRepository;
import com.quizexam.repository.QuestionRepository;
import com.quizexam.repository.StudentExamPaperRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

@Service
public class ExamTemplateService {

    private static final List<String> AR_OPTION_TEXTS = List.of(
        "Both A and R are true, and R is the correct explanation of A",
        "Both A and R are true, but R is not the correct explanation of A",
        "A is true but R is false",
        "A is false but R is true"
    );
    private static final List<String> TF_OPTION_TEXTS = List.of("True", "False");

    private final ExamTemplateRepository examTemplateRepository;
    private final StudentExamPaperRepository studentExamPaperRepository;
    private final CategoryRepository categoryRepository;
    private final QuestionRepository questionRepository;
    private final ExamRepository examRepository;

    public ExamTemplateService(ExamTemplateRepository examTemplateRepository,
                               StudentExamPaperRepository studentExamPaperRepository,
                               CategoryRepository categoryRepository,
                               QuestionRepository questionRepository,
                               ExamRepository examRepository) {
        this.examTemplateRepository = examTemplateRepository;
        this.studentExamPaperRepository = studentExamPaperRepository;
        this.categoryRepository = categoryRepository;
        this.questionRepository = questionRepository;
        this.examRepository = examRepository;
    }

    @Transactional
    public List<TemplateEntry> replaceTemplate(long examId, List<TemplateRule> rules) {
        if (rules == null || rules.isEmpty()) {
            throw new IllegalArgumentException("Template must contain at least one category rule");
        }

        Set<Long> seenCategories = new HashSet<>();
        List<ExamTemplate> entities = new ArrayList<>();
        for (TemplateRule rule : rules) {
            if (rule.questionCount() <= 0) {
                throw new IllegalArgumentException("Question count must be greater than zero");
            }
            if (!seenCategories.add(rule.categoryId())) {
                throw new IllegalArgumentException("Duplicate category in template: " + rule.categoryId());
            }
            Category category = categoryRepository.findById(rule.categoryId())
                .orElseThrow(() -> new IllegalArgumentException("Category not found: " + rule.categoryId()));
            long available = questionRepository.countByCategoryId(category.getId());
            if (available < rule.questionCount()) {
                throw new IllegalArgumentException(
                    "Not enough questions in category '" + category.getName() + "' (required " + rule.questionCount() + ", available " + available + ")"
                );
            }

            ExamTemplate template = new ExamTemplate();
            template.setExamId(examId);
            template.setCategory(category);
            template.setQuestionCount(rule.questionCount());
            entities.add(template);
        }

        examTemplateRepository.deleteByExamId(examId);
        List<ExamTemplate> saved = examTemplateRepository.saveAll(entities);
        return saved.stream().map(this::toTemplateEntry).toList();
    }

    @Transactional
    public void clearTemplate(long examId) {
        examTemplateRepository.deleteByExamId(examId);
    }

    @Transactional(readOnly = true)
    public List<TemplateEntry> getTemplateEntries(long examId) {
        return examTemplateRepository.findByExamId(examId).stream()
            .map(this::toTemplateEntry)
            .toList();
    }

    @Transactional(readOnly = true)
    public int getTotalQuestionCount(long examId) {
        List<ExamTemplate> templates = examTemplateRepository.findByExamId(examId);
        if (!templates.isEmpty()) {
            return templates.stream().mapToInt(ExamTemplate::getQuestionCount).sum();
        }
        return examRepository.findById(examId)
            .map(exam -> exam.getQuestions() != null ? exam.getQuestions().size() : 0)
            .orElse(0);
    }

    @Transactional
    public StudentExamPaper getOrCreateStudentPaper(long examId, long studentId) {
        Optional<StudentExamPaper> existing = studentExamPaperRepository.findByStudentIdAndExamId(studentId, examId);
        if (existing.isPresent()) return existing.get();

        Set<String> usedSignatures = studentExamPaperRepository.findByExamId(examId).stream()
            .map(StudentExamPaper::getQuestionIds)
            .map(this::signatureFromCsv)
            .collect(Collectors.toSet());

        List<Long> generatedQuestionIds = null;
        for (int attempt = 0; attempt < 100; attempt++) {
            List<Long> candidate = generateQuestionIds(examId, studentId, attempt);
            if (candidate.isEmpty()) continue;
            if (!usedSignatures.contains(signatureForIds(candidate))) {
                generatedQuestionIds = candidate;
                break;
            }
        }

        if (generatedQuestionIds == null || generatedQuestionIds.isEmpty()) {
            throw new IllegalStateException("Unable to generate a unique question paper with the current template/question pool");
        }

        StudentExamPaper paper = new StudentExamPaper();
        paper.setExamId(examId);
        paper.setStudentId(studentId);
        paper.setQuestionIds(toCsv(generatedQuestionIds));

        try {
            return studentExamPaperRepository.save(paper);
        } catch (DataIntegrityViolationException e) {
            return studentExamPaperRepository.findByStudentIdAndExamId(studentId, examId)
                .orElseThrow(() -> e);
        }
    }

    @Transactional
    public List<Question> getAssignedQuestions(long examId, long studentId) {
        StudentExamPaper paper = getOrCreateStudentPaper(examId, studentId);
        return loadQuestionsInAssignedOrder(paper.getQuestionIds());
    }

    @Transactional
    public List<StudentQuestion> buildStudentQuestionPayload(long examId, long studentId) {
        return getAssignedQuestions(examId, studentId).stream()
            .map(question -> toStudentQuestion(question, examId, studentId))
            .toList();
    }

    public boolean isCorrectForStudent(long examId, long studentId, Question question, String submittedAnswer) {
        if (submittedAnswer == null || submittedAnswer.isBlank()) return false;

        if (question instanceof MCQ mcq) {
            int selectedDisplayIndex;
            try {
                selectedDisplayIndex = Integer.parseInt(submittedAnswer);
            } catch (NumberFormatException e) {
                return false;
            }
            if (selectedDisplayIndex < 0 || selectedDisplayIndex >= mcq.getOptionTexts().size()) return false;

            List<Integer> optionOrder = mcqOptionOrder(examId, studentId, question.getId(), mcq.getOptionTexts().size());
            int originalIndex = optionOrder.get(selectedDisplayIndex);
            return originalIndex == mcq.getCorrectIndex();
        }

        if (question instanceof AssertionReasonQuestion ar) {
            int selectedDisplayIndex;
            try {
                selectedDisplayIndex = Integer.parseInt(submittedAnswer);
            } catch (NumberFormatException e) {
                return false;
            }
            if (selectedDisplayIndex < 0 || selectedDisplayIndex >= AR_OPTION_TEXTS.size()) return false;

            List<Integer> optionOrder = arOptionOrder(examId, studentId, question.getId());
            int originalIndex = optionOrder.get(selectedDisplayIndex);
            return originalIndex == ar.getCorrectChoice();
        }

        return submittedAnswer.equals(question.getCorrectAnswerValue());
    }

    private StudentQuestion toStudentQuestion(Question question, long examId, long studentId) {
        Category category = question.getCategory();
        long categoryId = category != null ? category.getId() : 0L;
        String categoryName = category != null ? category.getName() : null;

        if (question instanceof MCQ mcq) {
            List<Integer> optionOrder = mcqOptionOrder(examId, studentId, question.getId(), mcq.getOptionTexts().size());
            List<String> randomizedOptions = optionOrder.stream()
                .map(idx -> mcq.getOptionTexts().get(idx))
                .toList();
            return new StudentQuestion(
                question.getId(),
                question.getType(),
                question.getText(),
                question.getDifficulty(),
                question.getSubject(),
                question.getTopic(),
                categoryId,
                categoryName,
                randomizedOptions,
                null,
                null
            );
        }

        if (question instanceof AssertionReasonQuestion ar) {
            List<Integer> optionOrder = arOptionOrder(examId, studentId, question.getId());
            List<String> randomizedChoices = optionOrder.stream().map(AR_OPTION_TEXTS::get).toList();
            return new StudentQuestion(
                question.getId(),
                question.getType(),
                question.getText(),
                question.getDifficulty(),
                question.getSubject(),
                question.getTopic(),
                categoryId,
                categoryName,
                randomizedChoices,
                ar.getAssertion(),
                ar.getReason()
            );
        }

        if (question instanceof TrueFalseQuestion) {
            List<Integer> optionOrder = tfOptionOrder(examId, studentId, question.getId());
            List<String> randomizedChoices = optionOrder.stream().map(TF_OPTION_TEXTS::get).toList();
            return new StudentQuestion(
                question.getId(),
                question.getType(),
                question.getText(),
                question.getDifficulty(),
                question.getSubject(),
                question.getTopic(),
                categoryId,
                categoryName,
                randomizedChoices,
                null,
                null
            );
        }

        return new StudentQuestion(
            question.getId(),
            question.getType(),
            question.getText(),
            question.getDifficulty(),
            question.getSubject(),
            question.getTopic(),
            categoryId,
            categoryName,
            null,
            null,
            null
        );
    }

    private List<Long> generateQuestionIds(long examId, long studentId, int variation) {
        List<ExamTemplate> templates = examTemplateRepository.findByExamId(examId);
        Random random = new Random(seedForPaper(examId, studentId, variation));

        if (!templates.isEmpty()) {
            List<Long> selected = new ArrayList<>();
            for (ExamTemplate template : templates) {
                long categoryId = template.getCategory().getId();
                int requiredCount = template.getQuestionCount();

                List<Question> pool = new ArrayList<>(questionRepository.findByCategoryId(categoryId));
                if (pool.size() < requiredCount) {
                    throw new IllegalStateException(
                        "Not enough questions to generate paper for category " + template.getCategory().getName()
                    );
                }
                selected.addAll(selectBalanced(pool, requiredCount, random));
            }
            Collections.shuffle(selected, random);
            return selected;
        }

        Exam exam = examRepository.findById(examId)
            .orElseThrow(() -> new IllegalArgumentException("Exam not found: " + examId));
        List<Long> legacyQuestionIds = exam.getQuestions().stream()
            .map(Question::getId)
            .collect(Collectors.toCollection(ArrayList::new));
        if (legacyQuestionIds.isEmpty()) {
            throw new IllegalStateException("Exam has no template and no directly assigned questions");
        }
        Collections.shuffle(legacyQuestionIds, random);
        return legacyQuestionIds;
    }

    // Selects `count` questions from pool with 40% EASY / 40% MEDIUM / 20% HARD target distribution.
    // Falls back to any difficulty when buckets are short.
    private List<Long> selectBalanced(List<Question> pool, int count, Random random) {
        Map<Difficulty, List<Question>> byDiff = pool.stream()
            .collect(Collectors.groupingBy(
                q -> q.getDifficulty() != null ? q.getDifficulty() : Difficulty.MEDIUM,
                Collectors.toCollection(ArrayList::new)
            ));

        for (List<Question> bucket : byDiff.values()) Collections.shuffle(bucket, random);

        List<Question> easy   = byDiff.getOrDefault(Difficulty.EASY,   new ArrayList<>());
        List<Question> medium = byDiff.getOrDefault(Difficulty.MEDIUM, new ArrayList<>());
        List<Question> hard   = byDiff.getOrDefault(Difficulty.HARD,   new ArrayList<>());

        int wantEasy   = (int) Math.round(count * 0.40);
        int wantHard   = (int) Math.round(count * 0.20);
        int wantMedium = count - wantEasy - wantHard;

        List<Long> selected = new ArrayList<>(count);
        List<Question> leftover = new ArrayList<>();
        drainInto(easy,   wantEasy,   selected, leftover);
        drainInto(medium, wantMedium, selected, leftover);
        drainInto(hard,   wantHard,   selected, leftover);

        if (selected.size() < count) {
            Collections.shuffle(leftover, random);
            leftover.stream().limit(count - selected.size()).map(Question::getId).forEach(selected::add);
        }
        return selected;
    }

    private void drainInto(List<Question> source, int want, List<Long> target, List<Question> overflow) {
        int take = Math.min(want, source.size());
        source.stream().limit(take).map(Question::getId).forEach(target::add);
        if (source.size() > take) overflow.addAll(source.subList(take, source.size()));
    }

    private List<Question> loadQuestionsInAssignedOrder(String questionIdsCsv) {
        List<Long> ids = parseCsvIds(questionIdsCsv);
        if (ids.isEmpty()) return List.of();

        Map<Long, Question> byId = questionRepository.findAllById(ids).stream()
            .collect(Collectors.toMap(Question::getId, q -> q));

        List<Question> ordered = ids.stream()
            .map(byId::get)
            .filter(Objects::nonNull)
            .toList();

        if (ordered.size() != ids.size()) {
            throw new IllegalStateException("Some assigned questions are no longer available");
        }
        return ordered;
    }

    private List<Long> parseCsvIds(String csv) {
        if (csv == null || csv.isBlank()) return List.of();
        return Arrays.stream(csv.split(","))
            .map(String::trim)
            .filter(part -> !part.isEmpty())
            .map(Long::parseLong)
            .toList();
    }

    private String toCsv(List<Long> ids) {
        return ids.stream().map(String::valueOf).collect(Collectors.joining(","));
    }

    private String signatureFromCsv(String csv) {
        return signatureForIds(parseCsvIds(csv));
    }

    private String signatureForIds(List<Long> ids) {
        return ids.stream()
            .sorted()
            .map(String::valueOf)
            .collect(Collectors.joining(","));
    }

    private List<Integer> mcqOptionOrder(long examId, long studentId, long questionId, int optionCount) {
        List<Integer> order = IntStream.range(0, optionCount)
            .boxed()
            .collect(Collectors.toCollection(ArrayList::new));
        Collections.shuffle(order, new Random(seedForQuestion(examId, studentId, questionId, "MCQ")));
        return order;
    }

    private List<Integer> arOptionOrder(long examId, long studentId, long questionId) {
        List<Integer> order = IntStream.range(0, AR_OPTION_TEXTS.size())
            .boxed()
            .collect(Collectors.toCollection(ArrayList::new));
        Collections.shuffle(order, new Random(seedForQuestion(examId, studentId, questionId, "AR")));
        return order;
    }

    private List<Integer> tfOptionOrder(long examId, long studentId, long questionId) {
        List<Integer> order = IntStream.range(0, TF_OPTION_TEXTS.size())
            .boxed()
            .collect(Collectors.toCollection(ArrayList::new));
        Collections.shuffle(order, new Random(seedForQuestion(examId, studentId, questionId, "TF")));
        return order;
    }

    private long seedForPaper(long examId, long studentId, int variation) {
        return (examId * 1_000_003L) ^ (studentId * 9_699_689L) ^ (variation * 2_147_483_647L) ^ 17L;
    }

    private long seedForQuestion(long examId, long studentId, long questionId, String salt) {
        return (examId * 1_000_003L)
            ^ (studentId * 9_699_689L)
            ^ (questionId * 31_415_927L)
            ^ salt.hashCode();
    }

    private TemplateEntry toTemplateEntry(ExamTemplate template) {
        return new TemplateEntry(
            template.getId(),
            template.getCategory().getId(),
            template.getCategory().getName(),
            template.getCategory().getDescription(),
            template.getQuestionCount()
        );
    }

    @Transactional
    public List<PaperSummary> generateAllPapers(long examId, List<Long> studentIds) {
        List<PaperSummary> results = new ArrayList<>();
        for (int i = 0; i < studentIds.size(); i++) {
            long studentId = studentIds.get(i);
            String label = "S" + (i + 1);
            try {
                StudentExamPaper paper = getOrCreateStudentPaper(examId, studentId);
                int questionCount = parseCsvIds(paper.getQuestionIds()).size();
                results.add(new PaperSummary(studentId, label, paper.getId(), questionCount, "GENERATED"));
            } catch (Exception e) {
                results.add(new PaperSummary(studentId, label, -1L, 0, "FAILED: " + e.getMessage()));
            }
        }
        return results;
    }

    @Transactional(readOnly = true)
    public List<PaperSummary> listPapers(long examId) {
        List<StudentExamPaper> papers = new ArrayList<>(studentExamPaperRepository.findByExamId(examId));
        papers.sort(Comparator.comparingLong(StudentExamPaper::getId));
        List<PaperSummary> result = new ArrayList<>();
        for (int i = 0; i < papers.size(); i++) {
            StudentExamPaper paper = papers.get(i);
            int questionCount = parseCsvIds(paper.getQuestionIds()).size();
            result.add(new PaperSummary(paper.getStudentId(), "S" + (i + 1), paper.getId(), questionCount, "GENERATED"));
        }
        return result;
    }

    @Transactional(readOnly = true)
    public PaperExportData exportPaper(long examId, long studentId, String label) {
        StudentExamPaper paper = studentExamPaperRepository.findByStudentIdAndExamId(studentId, examId)
            .orElseThrow(() -> new IllegalArgumentException("No paper generated for this student"));

        Exam exam = examRepository.findById(examId)
            .orElseThrow(() -> new IllegalArgumentException("Exam not found: " + examId));

        List<Question> questions = loadQuestionsInAssignedOrder(paper.getQuestionIds());
        List<ExportQuestion> exportQuestions = new ArrayList<>();
        for (int i = 0; i < questions.size(); i++) {
            Question q = questions.get(i);
            List<String> options = buildDisplayOptions(q, examId, studentId);
            String assertion = null, reason = null;
            if (q instanceof AssertionReasonQuestion arq) {
                assertion = arq.getAssertion();
                reason    = arq.getReason();
            }
            exportQuestions.add(new ExportQuestion(
                i + 1, q.getId(), q.getText(), q.getType(),
                q.getDifficulty(), q.getSubject(), q.getTopic(),
                q.getCategory() != null ? q.getCategory().getName() : null,
                options, assertion, reason
            ));
        }

        return new PaperExportData(label, exam.getId(), exam.getTitle(),
            exam.getTimeLimitMinutes(), exam.getMarksPerQuestion(), studentId, exportQuestions);
    }

    private List<String> buildDisplayOptions(Question q, long examId, long studentId) {
        if (q instanceof MCQ mcq) {
            List<Integer> order = mcqOptionOrder(examId, studentId, q.getId(), mcq.getOptionTexts().size());
            return order.stream().map(idx -> mcq.getOptionTexts().get(idx)).toList();
        }
        if (q instanceof AssertionReasonQuestion) {
            List<Integer> order = arOptionOrder(examId, studentId, q.getId());
            return order.stream().map(AR_OPTION_TEXTS::get).toList();
        }
        if (q instanceof TrueFalseQuestion) {
            List<Integer> order = tfOptionOrder(examId, studentId, q.getId());
            return order.stream().map(TF_OPTION_TEXTS::get).toList();
        }
        return List.of();
    }

    public record TemplateRule(long categoryId, int questionCount) {}

    public record TemplateEntry(
        long id,
        long categoryId,
        String categoryName,
        String categoryDescription,
        int questionCount
    ) {}

    public record StudentQuestion(
        long id,
        String type,
        String text,
        Difficulty difficulty,
        String subject,
        String topic,
        long categoryId,
        String categoryName,
        List<String> optionTexts,
        String assertion,
        String reason
    ) {}

    public record PaperSummary(long studentId, String label, long paperId, int questionCount, String status) {}

    public record ExportQuestion(
        int number,
        long id,
        String text,
        String type,
        Difficulty difficulty,
        String subject,
        String topic,
        String categoryName,
        List<String> options,
        String assertion,
        String reason
    ) {}

    public record PaperExportData(
        String label,
        long examId,
        String examTitle,
        int timeLimitMinutes,
        int marksPerQuestion,
        long studentId,
        List<ExportQuestion> questions
    ) {}
}
