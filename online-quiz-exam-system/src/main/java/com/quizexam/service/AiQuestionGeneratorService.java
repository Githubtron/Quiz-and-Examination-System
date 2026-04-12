package com.quizexam.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Random;
import java.util.Set;

/**
 * Calls OpenRouter API (OpenAI-compatible) to generate MCQ questions from document text.
 * Includes multi-model retry and deterministic fallback generation for provider outages/rate limits.
 */
@Service
public class AiQuestionGeneratorService {

    private static final Logger log = LoggerFactory.getLogger(AiQuestionGeneratorService.class);

    @Value("${openrouter.api.key:}")
    private String apiKey;

    private static final String OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
    private static final List<String> MODELS = List.of(
        "meta-llama/llama-3.2-3b-instruct:free",
        "google/gemma-3-4b-it:free",
        "microsoft/phi-3-mini-128k-instruct:free"
    );
    private static final List<String> CONCEPT_HINTS = List.of(
        "operating system", "process", "thread", "cpu scheduling", "context switch",
        "deadlock", "semaphore", "mutex", "memory management", "virtual memory",
        "paging", "segmentation", "file system", "kernel", "system call",
        "round robin", "shortest job first", "priority scheduling", "fcfs"
    );
    private static final Set<String> CONCEPT_STOPWORDS = Set.of(
        "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
        "this", "that", "these", "those", "it", "its", "today", "offers", "offer",
        "variety", "interaction", "between", "and", "or", "of", "to", "for", "with",
        "by", "from", "as", "in", "on", "at", "into", "through", "about", "according"
    );

    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newHttpClient();

    public List<GeneratedQuestion> generate(String documentText, int count) throws IOException, InterruptedException {
        return generate(documentText, count, "MIXED");
    }

    public List<GeneratedQuestion> generate(String documentText, int count, String requestedDifficulty) throws IOException, InterruptedException {
        if (apiKey == null || apiKey.isBlank() || apiKey.equals("YOUR_OPENROUTER_KEY_HERE")) {
            throw new IllegalStateException(
                "OpenRouter API key not configured. Set openrouter.api.key in application.properties. " +
                "Get a free key at https://openrouter.ai/keys");
        }

        if (documentText == null || documentText.isBlank()) {
            throw new IllegalArgumentException(
                "Extracted text is empty. The document may be scanned/image-based or unreadable. " +
                "Please upload a text-based PDF or DOCX.");
        }

        String normalizedDifficulty = normalizeRequestedDifficulty(requestedDifficulty);
        String prompt = buildPrompt(documentText, count, normalizedDifficulty);
        List<String> failures = new ArrayList<>();

        for (String model : MODELS) {
            for (int attempt = 1; attempt <= 2; attempt++) {
                HttpResponse<String> response = callOpenRouter(model, prompt);
                if (response.statusCode() == 200) {
                    try {
                        List<GeneratedQuestion> parsed = parseResponse(response.body(), inferSubject(documentText), normalizedDifficulty);
                        if (!parsed.isEmpty()) {
                            return parsed.stream().limit(count).toList();
                        }
                        failures.add(model + " attempt " + attempt + ": empty parsed question list");
                    } catch (Exception parseError) {
                        failures.add(model + " attempt " + attempt + ": parse error - " + parseError.getMessage());
                    }
                } else {
                    failures.add(model + " attempt " + attempt + ": HTTP " + response.statusCode());
                }

                if (response.statusCode() == 429 || response.statusCode() >= 500) {
                    Thread.sleep(800L * attempt);
                } else {
                    break;
                }
            }
        }

        log.warn("OpenRouter generation unavailable. Using deterministic fallback. Failures: {}", failures);
        return buildFallbackQuestions(documentText, count, normalizedDifficulty);
    }

    private HttpResponse<String> callOpenRouter(String model, String prompt) throws IOException, InterruptedException {
        Map<String, Object> body = Map.of(
            "model", model,
            "messages", List.of(
                Map.of("role", "user", "content", prompt)
            ),
            "temperature", 0.2,
            "max_tokens", 8192
        );

        String requestJson = mapper.writeValueAsString(body);
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(OPENROUTER_URL))
            .header("Content-Type", "application/json")
            .header("Authorization", "Bearer " + apiKey)
            .header("HTTP-Referer", "http://localhost:8080")
            .header("X-Title", "QuizMaster")
            .POST(HttpRequest.BodyPublishers.ofString(requestJson))
            .build();

        return httpClient.send(request, HttpResponse.BodyHandlers.ofString());
    }

    private String buildPrompt(String text, int count, String difficulty) {
        return "You are an expert professor with 10 years of experience creating\n" +
               "high quality university exam questions.\n\n" +
               "Your task is to generate " + count + " MCQ questions on the subject\n" +
               "of OPERATING SYSTEMS based on the concepts found in the\n" +
               "provided study material.\n\n" +
               "QUESTION QUALITY RULES:\n" +
               "- Every question must be grammatically correct and complete\n" +
               "- Questions must be clear, concise and unambiguous\n" +
               "- Each question must test ONE specific concept\n" +
               "- Never copy raw sentences from the document as question text\n" +
               "- Identify the KEY CONCEPTS from the document and frame\n" +
               "  proper questions around those concepts\n" +
               "- Options must be meaningful and plausible, not random text\n" +
               "- Only ONE option should be clearly correct\n" +
               "- Wrong options should be related but clearly incorrect\n\n" +
               "QUESTION FORMAT VARIETY (rotate between these):\n" +
               "1. Definition: 'What is [concept]?'\n" +
               "2. Purpose: 'What is the purpose of [concept]?'\n" +
               "3. Example: 'Which of the following is an example of [concept]?'\n" +
               "4. Identify: 'Which of the following is NOT a type of [concept]?'\n" +
               "5. Compare: 'What is the key difference between [A] and [B]?'\n" +
               "6. Function: 'Which component of OS is responsible for [task]?'\n" +
               "7. Scenario: 'In which situation would [concept] be used?'\n\n" +
               "STRICTLY FORBIDDEN:\n" +
               "- Do not copy sentences from document as question text\n" +
               "- Do not use partial sentences as question subjects\n" +
               "- Do not ask 'according to the document'\n" +
               "- Do not include professor names, page numbers, course codes\n" +
               "- Do not create questions with grammatically incorrect text\n" +
               "- Do not create questions where the answer is obvious from\n" +
               "  the question itself\n\n" +
               "EXAMPLE OF GOOD QUESTIONS:\n" +
               "Q: What is the primary function of an Operating System?\n" +
               "A: Resource management and providing interface between user and hardware\n" +
               "B: Only managing files on disk\n" +
               "C: Running application software directly\n" +
               "D: Managing internet connections only\n" +
               "Correct: A\n\n" +
               "Q: Which scheduling algorithm provides the minimum average\n" +
               "waiting time?\n" +
               "A: FCFS\n" +
               "B: Round Robin\n" +
               "C: Shortest Job First\n" +
               "D: Priority Scheduling\n" +
               "Correct: C\n\n" +
               "Study material content:\n" +
               text + "\n\n" +
               "IMPORTANT: Return ONLY valid JSON array, no extra text:\n" +
               "[\n" +
               "  {\n" +
               "    'question': 'clear grammatically correct question',\n" +
               "    'optionA': 'meaningful option',\n" +
               "    'optionB': 'meaningful option',\n" +
               "    'optionC': 'meaningful option',\n" +
               "    'optionD': 'meaningful option',\n" +
               "    'correctAnswer': 'A or B or C or D',\n" +
               "    'difficulty': 'EASY or MEDIUM or HARD',\n" +
               "    'topic': 'specific OS concept name',\n" +
               "    'explanation': 'clear explanation of why this answer is correct'\n" +
               "  }\n" +
               "]";
    }

    private List<GeneratedQuestion> parseResponse(String responseBody, String defaultSubject, String requestedDifficulty) throws IOException {
        JsonNode root = mapper.readTree(responseBody);
        JsonNode contentNode = root.path("choices").path(0).path("message").path("content");
        if (contentNode.isMissingNode() || contentNode.asText().isBlank()) {
            throw new IOException("Model response did not contain choices[0].message.content");
        }

        String rawText = contentNode.asText().trim();
        if (rawText.startsWith("```")) {
            rawText = rawText.replaceAll("^```[a-zA-Z]*\\n?", "").replaceAll("```$", "").trim();
        }
        JsonNode parsed;
        try {
            parsed = mapper.readTree(rawText);
        } catch (IOException primaryParseError) {
            parsed = mapper.readTree(rawText.replace('\'', '"'));
        }
        if (!parsed.isArray()) {
            throw new IOException("Model output is not a JSON array");
        }

        List<GeneratedQuestion> questions = new ArrayList<>();
        for (JsonNode node : parsed) {
            String questionText = firstNonBlank(readText(node, "question"), readText(node, "text"));
            if (questionText == null) continue;

            List<String> options = extractOptions(node);
            if (options.size() < 4) continue;
            options = new ArrayList<>(options.subList(0, 4));

            int correctIndex = parseCorrectIndex(node, options);
            String difficulty = "MIXED".equals(requestedDifficulty)
                ? normalizeDifficulty(readText(node, "difficulty"))
                : requestedDifficulty;
            String topic = firstNonBlank(readText(node, "topic"), "Document comprehension");
            String subject = firstNonBlank(readText(node, "subject"), defaultSubject);
            String explanation = firstNonBlank(readText(node, "explanation"), "Derived directly from the uploaded document.");

            questions.add(new GeneratedQuestion(
                questionText,
                options,
                correctIndex,
                difficulty,
                subject,
                topic,
                explanation
            ));
        }

        if (questions.isEmpty()) {
            throw new IOException("No valid questions parsed from model output");
        }

        return questions;
    }

    private List<GeneratedQuestion> buildFallbackQuestions(String text, int count, String requestedDifficulty) {
        List<String> facts = extractFacts(text);
        if (facts.isEmpty()) {
            throw new IllegalStateException("AI generation failed and fallback could not extract usable document facts");
        }

        String inferredSubject = inferSubject(text);
        List<GeneratedQuestion> generated = new ArrayList<>();
        Random random = new Random(text.hashCode());

        for (int i = 0; i < count; i++) {
            String correct = facts.get(i % facts.size());
            String alternate = facts.get((i + 1) % facts.size());
            int formatIndex = i % 8;
            List<String> options = new ArrayList<>();

            if (formatIndex == 7) {
                String unsupported = "It guarantees a behavior not stated anywhere in the document.";
                options.add(unsupported);
                options.add(correct);
                options.add(alternate);
                for (int j = 2; j < facts.size() && options.size() < 4; j++) {
                    String distractor = facts.get((i + j) % facts.size());
                    if (!distractor.equals(correct) && !distractor.equals(alternate)) options.add(distractor);
                }
                while (options.size() < 4) {
                    options.add("This statement is explicitly supported by the document.");
                }
            } else {
                options.add(correct);
                for (int j = 1; j < facts.size() && options.size() < 4; j++) {
                    String distractor = facts.get((i + j) % facts.size());
                    if (!distractor.equals(correct)) options.add(distractor);
                }
                while (options.size() < 4) {
                    options.add("This statement is not supported by the given document.");
                }
            }

            List<String> shuffled = new ArrayList<>(options);
            for (int k = shuffled.size() - 1; k > 0; k--) {
                int swapIdx = random.nextInt(k + 1);
                String tmp = shuffled.get(k);
                shuffled.set(k, shuffled.get(swapIdx));
                shuffled.set(swapIdx, tmp);
            }

            int correctIndex = formatIndex == 7
                ? shuffled.indexOf("It guarantees a behavior not stated anywhere in the document.")
                : shuffled.indexOf(correct);

            String concept = extractConcept(correct);
            String secondConcept = extractConcept(alternate);
            generated.add(new GeneratedQuestion(
                buildFallbackQuestionText(formatIndex, concept, secondConcept),
                shuffled,
                correctIndex,
                "MIXED".equals(requestedDifficulty) ? difficultyForIndex(i) : requestedDifficulty,
                inferredSubject,
                concept,
                "This option is directly supported by statements in the uploaded document."
            ));
        }
        return generated;
    }

    private String buildFallbackQuestionText(int formatIndex, String concept, String secondConcept) {
        return switch (formatIndex) {
            case 0 -> "Which of the following best defines " + concept + "?";
            case 1 -> "What is the primary purpose of " + concept + "?";
            case 2 -> "What is the difference between " + concept + " and " + secondConcept + "?";
            case 3 -> "Which of the following is an example of " + concept + "?";
            case 4 -> "Which of the following statements about " + concept + " is TRUE?";
            case 5 -> "Which of the following is NOT a feature of " + concept + "?";
            case 6 -> "How does " + concept + " work?";
            default -> "In which scenario would you use " + concept + "?";
        };
    }

    private List<String> extractFacts(String text) {
        String compact = text.replaceAll("\\s+", " ").trim();
        String[] sentenceParts = compact.split("(?<=[.!?])\\s+");
        Set<String> facts = new LinkedHashSet<>();
        for (String part : sentenceParts) {
            String normalized = part.trim().replaceAll("[\\r\\n]+", " ");
            if (normalized.length() >= 25) {
                facts.add(normalized);
            }
        }
        if (facts.isEmpty()) {
            String[] lineParts = text.split("\\R+");
            for (String line : lineParts) {
                String normalized = line.trim().replaceAll("\\s+", " ");
                if (normalized.length() >= 25) facts.add(normalized + ".");
            }
        }
        return new ArrayList<>(facts);
    }

    private String inferSubject(String text) {
        String lower = text.toLowerCase();
        if (lower.contains("database") || lower.contains("sql")) return "Database Systems";
        if (lower.contains("operating system") || lower.contains("kernel")) return "Operating Systems";
        if (lower.contains("java") || lower.contains("jvm")) return "Java";
        return "General";
    }

    private String difficultyForIndex(int idx) {
        return switch (idx % 3) {
            case 0 -> "EASY";
            case 1 -> "MEDIUM";
            default -> "HARD";
        };
    }

    private String extractConcept(String fact) {
        String lower = fact.toLowerCase(Locale.ROOT);
        for (String hint : CONCEPT_HINTS) {
            if (lower.contains(hint)) {
                return toTitleCase(hint);
            }
        }

        String normalized = fact.replaceAll("[^A-Za-z0-9\\s-]", " ").replaceAll("\\s+", " ").trim();
        if (normalized.isBlank()) return "Operating System";

        List<String> keywords = new ArrayList<>();
        for (String raw : normalized.split(" ")) {
            String token = raw.trim();
            if (token.length() < 3) continue;
            String tokenLower = token.toLowerCase(Locale.ROOT);
            if (CONCEPT_STOPWORDS.contains(tokenLower)) continue;
            keywords.add(toTitleCase(tokenLower));
            if (keywords.size() == 2) break;
        }
        return keywords.isEmpty() ? "Operating System" : String.join(" ", keywords);
    }

    private String toTitleCase(String text) {
        String[] words = text.split("\\s+");
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < words.length; i++) {
            if (i > 0) sb.append(' ');
            String word = words[i];
            if (word.length() <= 2) {
                sb.append(word.toUpperCase(Locale.ROOT));
            } else {
                sb.append(Character.toUpperCase(word.charAt(0))).append(word.substring(1).toLowerCase(Locale.ROOT));
            }
        }
        return sb.toString();
    }

    private List<String> extractOptions(JsonNode node) {
        String optionA = readText(node, "optionA");
        String optionB = readText(node, "optionB");
        String optionC = readText(node, "optionC");
        String optionD = readText(node, "optionD");
        if (optionA != null && optionB != null && optionC != null && optionD != null) {
            return List.of(optionA, optionB, optionC, optionD);
        }

        JsonNode optionsNode = node.path("options");
        if (!optionsNode.isArray()) return List.of();
        List<String> options = new ArrayList<>();
        for (JsonNode option : optionsNode) {
            if (option.isTextual() && !option.asText().isBlank()) {
                options.add(option.asText().trim());
            }
            if (options.size() == 4) break;
        }
        return options;
    }

    private int parseCorrectIndex(JsonNode node, List<String> options) {
        JsonNode correctIndexNode = node.path("correctIndex");
        if (correctIndexNode.isInt()) {
            int idx = correctIndexNode.asInt();
            if (idx >= 0 && idx < 4) return idx;
        }

        String correctAnswer = readText(node, "correctAnswer");
        if (correctAnswer != null) {
            Integer letterIndex = parseLetterIndex(correctAnswer);
            if (letterIndex != null) return letterIndex;

            for (int i = 0; i < options.size(); i++) {
                if (correctAnswer.equalsIgnoreCase(options.get(i))) return i;
            }
        }
        return 0;
    }

    private Integer parseLetterIndex(String answer) {
        String normalized = answer.trim().toUpperCase(Locale.ROOT);
        if (normalized.length() == 1) {
            char ch = normalized.charAt(0);
            if (ch >= 'A' && ch <= 'D') return ch - 'A';
        }
        if (normalized.matches("[1-4]")) {
            return Integer.parseInt(normalized) - 1;
        }
        return null;
    }

    private String readText(JsonNode node, String field) {
        JsonNode value = node.path(field);
        if (!value.isTextual()) return null;
        String text = value.asText().trim();
        return text.isBlank() ? null : text;
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) return value;
        }
        return null;
    }

    private String normalizeDifficulty(String difficulty) {
        if (difficulty == null) return "MEDIUM";
        return switch (difficulty.trim().toUpperCase(Locale.ROOT)) {
            case "EASY" -> "EASY";
            case "HARD" -> "HARD";
            default -> "MEDIUM";
        };
    }

    private String normalizeRequestedDifficulty(String requestedDifficulty) {
        if (requestedDifficulty == null) return "MIXED";
        return switch (requestedDifficulty.trim().toUpperCase(Locale.ROOT)) {
            case "EASY" -> "EASY";
            case "MEDIUM" -> "MEDIUM";
            case "HARD" -> "HARD";
            default -> "MIXED";
        };
    }

    public record GeneratedQuestion(
        String text,
        List<String> options,
        int correctIndex,
        String difficulty,
        String subject,
        String topic,
        String explanation
    ) {}
}
