package com.quizexam.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.quizexam.model.Category;
import com.quizexam.model.Difficulty;
import com.quizexam.repository.CategoryRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class AutoCategorizationService {

    private static final Logger log = LoggerFactory.getLogger(AutoCategorizationService.class);
    private static final String OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
    private static final String MODEL = "google/gemma-3-4b-it:free";

    @Value("${openrouter.api.key:}")
    private String apiKey;

    private final CategoryRepository categoryRepository;
    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newHttpClient();

    public AutoCategorizationService(CategoryRepository categoryRepository) {
        this.categoryRepository = categoryRepository;
    }

    @Transactional
    public AutoCategorizationResult detectAndEnsureCategory(String extractedText) {
        if (extractedText == null || extractedText.isBlank()) {
            throw new IllegalArgumentException("Extracted text is empty");
        }

        String sample = extractedText.length() > 2000 ? extractedText.substring(0, 2000) : extractedText;
        DetectionPayload detection = detectWithFallback(sample);

        String normalizedSubject = normalizeSubject(detection.subject());
        List<String> topics = normalizeTopics(detection.topics());
        Difficulty detectedDifficulty = detection.difficulty() != null ? detection.difficulty() : Difficulty.MEDIUM;

        Category category = categoryRepository.findByNameIgnoreCase(normalizedSubject)
            .orElseGet(() -> {
                Category created = new Category();
                created.setName(normalizedSubject);
                created.setDescription(buildCategoryDescription(topics, detectedDifficulty));
                return categoryRepository.save(created);
            });

        return new AutoCategorizationResult(category, normalizedSubject, topics, detectedDifficulty);
    }

    private DetectionPayload detectWithFallback(String sample) {
        try {
            return detectWithAi(sample);
        } catch (IOException e) {
            log.warn("Auto-categorization AI call failed, using heuristic categorization: {}", e.getMessage());
            return heuristicDetection(sample);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.warn("Auto-categorization AI call interrupted, using heuristic categorization");
            return heuristicDetection(sample);
        } catch (IllegalStateException e) {
            log.warn("Auto-categorization AI response invalid, using heuristic categorization: {}", e.getMessage());
            return heuristicDetection(sample);
        }
    }

    private DetectionPayload detectWithAi(String sample) throws IOException, InterruptedException {
        if (apiKey == null || apiKey.isBlank() || apiKey.equals("YOUR_OPENROUTER_KEY_HERE")) {
            throw new IllegalStateException("OpenRouter API key is not configured");
        }

        String prompt = "Analyze this text and return ONLY a JSON with:\n" +
                        "{\n" +
                        "  'subject': 'main subject name',\n" +
                        "  'topics': ['topic1', 'topic2', 'topic3'],\n" +
                        "  'difficulty': 'EASY or MEDIUM or HARD'\n" +
                        "}\n" +
                        "Do not return anything else.\n\n" +
                        "Text:\n" + sample;

        Map<String, Object> body = Map.of(
            "model", MODEL,
            "messages", List.of(Map.of("role", "user", "content", prompt)),
            "temperature", 0.1,
            "max_tokens", 512
        );

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(OPENROUTER_URL))
            .header("Content-Type", "application/json")
            .header("Authorization", "Bearer " + apiKey)
            .header("HTTP-Referer", "http://localhost:8080")
            .header("X-Title", "QuizMaster")
            .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)))
            .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) {
            throw new IllegalStateException("OpenRouter status " + response.statusCode());
        }

        JsonNode root = mapper.readTree(response.body());
        JsonNode contentNode = root.path("choices").path(0).path("message").path("content");
        if (contentNode.isMissingNode() || contentNode.asText().isBlank()) {
            throw new IllegalStateException("Missing categorization content in AI response");
        }

        String raw = stripCodeFences(contentNode.asText().trim());
        JsonNode parsed = parseLenientJson(raw);
        String subject = readText(parsed, "subject");
        if (subject == null) {
            throw new IllegalStateException("AI categorization returned empty subject");
        }

        List<String> topics = readTopics(parsed.path("topics"));
        Difficulty difficulty = parseDifficulty(readText(parsed, "difficulty"));
        return new DetectionPayload(subject, topics, difficulty);
    }

    private DetectionPayload heuristicDetection(String text) {
        String lower = text.toLowerCase(Locale.ROOT);
        String subject;
        if (lower.contains("database") || lower.contains("sql") || lower.contains("normalization")) {
            subject = "DBMS";
        } else if (lower.contains("operating system") || lower.contains("kernel") || lower.contains("process scheduling")) {
            subject = "Operating Systems";
        } else if (lower.contains("java") || lower.contains("jvm") || lower.contains("object-oriented")) {
            subject = "Java Programming";
        } else if (lower.contains("network") || lower.contains("tcp") || lower.contains("ip")) {
            subject = "Computer Networks";
        } else {
            subject = "General";
        }
        return new DetectionPayload(subject, extractTopics(text), Difficulty.MEDIUM);
    }

    private String normalizeSubject(String subject) {
        String normalized = subject == null ? "" : subject.trim();
        if (normalized.isEmpty()) normalized = "General";
        if (normalized.length() > 100) normalized = normalized.substring(0, 100).trim();
        return normalized;
    }

    private List<String> normalizeTopics(List<String> topics) {
        List<String> normalized = new ArrayList<>();
        if (topics != null) {
            for (String topic : topics) {
                if (topic == null) continue;
                String cleaned = topic.trim();
                if (cleaned.isEmpty()) continue;
                if (cleaned.length() > 100) cleaned = cleaned.substring(0, 100).trim();
                normalized.add(cleaned);
                if (normalized.size() == 3) break;
            }
        }
        if (normalized.isEmpty()) {
            normalized.add("Core Concepts");
        }
        return normalized;
    }

    private String buildCategoryDescription(List<String> topics, Difficulty difficulty) {
        return "Auto-created from PDF upload. Topics: " +
               String.join(", ", topics) +
               ". Detected difficulty: " +
               (difficulty != null ? difficulty.name() : "MEDIUM") + ".";
    }

    private String stripCodeFences(String raw) {
        if (!raw.startsWith("```")) return raw;
        return raw.replaceAll("^```[a-zA-Z]*\\n?", "").replaceAll("```$", "").trim();
    }

    private JsonNode parseLenientJson(String raw) throws IOException {
        try {
            return mapper.readTree(raw);
        } catch (IOException ignored) {
            String normalized = raw.replace('\'', '"');
            return mapper.readTree(normalized);
        }
    }

    private String readText(JsonNode node, String field) {
        JsonNode value = node.path(field);
        if (!value.isTextual()) return null;
        String text = value.asText().trim();
        return text.isBlank() ? null : text;
    }

    private List<String> readTopics(JsonNode node) {
        List<String> topics = new ArrayList<>();
        if (node.isArray()) {
            for (JsonNode child : node) {
                if (child.isTextual() && !child.asText().isBlank()) {
                    topics.add(child.asText().trim());
                }
            }
        } else if (node.isTextual()) {
            for (String part : node.asText().split(",")) {
                String cleaned = part.trim();
                if (!cleaned.isBlank()) topics.add(cleaned);
            }
        }
        return topics;
    }

    private Difficulty parseDifficulty(String value) {
        if (value == null) return Difficulty.MEDIUM;
        return switch (value.trim().toUpperCase(Locale.ROOT)) {
            case "EASY" -> Difficulty.EASY;
            case "HARD" -> Difficulty.HARD;
            default -> Difficulty.MEDIUM;
        };
    }

    private List<String> extractTopics(String text) {
        List<String> topics = new ArrayList<>();
        String[] chunks = text.split("(?<=[.!?])\\s+|\\R+");
        for (String chunk : chunks) {
            String cleaned = chunk.replaceAll("\\s+", " ").trim();
            if (cleaned.length() < 10) continue;
            if (cleaned.length() > 100) cleaned = cleaned.substring(0, 100).trim();
            topics.add(cleaned);
            if (topics.size() == 3) break;
        }
        if (topics.isEmpty()) topics.add("Core Concepts");
        return topics;
    }

    private record DetectionPayload(String subject, List<String> topics, Difficulty difficulty) {}

    public record AutoCategorizationResult(
        Category category,
        String subject,
        List<String> topics,
        Difficulty difficulty
    ) {}
}
