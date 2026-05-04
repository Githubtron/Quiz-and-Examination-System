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
        "deepseek/deepseek-chat-v3-0324:free",
        "google/gemma-3-27b-it:free",
        "meta-llama/llama-3.3-70b-instruct:free"
    );
    private static final String SYSTEM_MESSAGE =
        "You are an expert educational assessment designer who creates university examination questions. " +
        "Your MCQs always test genuine understanding of specific concepts — never trivial reading comprehension. " +
        "Your distractors are plausible but unambiguously wrong to anyone who studied the material. " +
        "You always respond with valid JSON that exactly matches the schema given by the user.";

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
                    String snippet = response.body() == null ? "" :
                        response.body().substring(0, Math.min(response.body().length(), 200));
                    failures.add(model + " attempt " + attempt + ": HTTP " + response.statusCode() + " — " + snippet);
                    if (response.statusCode() == 401) break; // bad key — no point retrying same model
                }

                if (response.statusCode() == 429 || response.statusCode() >= 500) {
                    Thread.sleep(attempt == 1 ? 3000L : 5000L);
                } else {
                    break;
                }
            }
        }

        String failureSummary = String.join("; ", failures);
        log.error("⚠️  AI question generation FAILED on all models. Failures: {}", failureSummary);
        throw new IOException(
            "AI question generation failed after trying all available models. " +
            "This is usually caused by free-tier rate limits. Please wait a minute and try again. " +
            "Details: " + failureSummary);
    }

    private HttpResponse<String> callOpenRouter(String model, String prompt) throws IOException, InterruptedException {
        Map<String, Object> body = Map.of(
            "model", model,
            "messages", List.of(
                Map.of("role", "system", "content", SYSTEM_MESSAGE),
                Map.of("role", "user", "content", prompt)
            ),
            "temperature", 0.4,
            "top_p", 0.95,
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
        String subject = inferSubject(text);
        String difficultyGuide = switch (difficulty) {
            case "EASY"   -> "All " + count + " questions must be EASY: test direct recall of a definition, term, or fact stated in the material.";
            case "MEDIUM" -> "All " + count + " questions must be MEDIUM: test understanding of how or why a concept works, or the relationship between two concepts.";
            case "HARD"   -> "All " + count + " questions must be HARD: require the student to apply, compare, or critically analyse concepts from the material.";
            default       -> "Spread difficulty: roughly one-third EASY (recall), one-third MEDIUM (understanding), one-third HARD (application/analysis).";
        };

        String excerpt = text.length() > 9000 ? text.substring(0, 9000) : text;

        return "Generate exactly " + count + " multiple-choice questions (MCQs) from the study material below.\n" +
               "Subject: " + subject + "\n\n" +
               "=== DIFFICULTY ===\n" +
               difficultyGuide + "\n\n" +
               "=== WHAT MAKES A GOOD MCQ ===\n" +
               "QUESTION STEM:\n" +
               "  - Tests ONE specific concept from the material (not general world knowledge)\n" +
               "  - Is a complete, grammatically correct sentence or phrase\n" +
               "  - Does NOT reveal or hint at the answer\n\n" +
               "OPTIONS (A, B, C, D):\n" +
               "  - Exactly one option is unambiguously correct\n" +
               "  - All four options are from the same category (e.g. if the correct answer is an algorithm name, all options must be algorithm names)\n" +
               "  - Wrong options are plausible but clearly incorrect to someone who studied the material\n" +
               "  - Each option is concise (under 20 words)\n" +
               "  - No option says 'All of the above', 'None of the above', 'Both A and B', or similar\n\n" +
               "STRICTLY FORBIDDEN:\n" +
               "  - Copying sentences verbatim from the material as options\n" +
               "  - Questions answerable without reading the material\n" +
               "  - Mentioning 'the document', 'the text', page numbers, instructor names, or course codes\n" +
               "  - Two options that mean essentially the same thing\n" +
               "  - Trick questions based on minor wording differences\n\n" +
               "=== STUDY MATERIAL ===\n" +
               excerpt + "\n\n" +
               "=== OUTPUT FORMAT ===\n" +
               "Return ONLY a raw JSON array — no markdown, no code fences, no text before or after the array:\n" +
               "[\n" +
               "  {\n" +
               "    \"question\": \"<specific question about a concept in the material>\",\n" +
               "    \"optionA\": \"<option>\",\n" +
               "    \"optionB\": \"<option>\",\n" +
               "    \"optionC\": \"<option>\",\n" +
               "    \"optionD\": \"<option>\",\n" +
               "    \"correctAnswer\": \"A\",\n" +
               "    \"difficulty\": \"EASY\",\n" +
               "    \"topic\": \"<name of the concept being tested>\",\n" +
               "    \"explanation\": \"<why the correct option is right and why each wrong option is wrong>\"\n" +
               "  }\n" +
               "]\n";
    }

    private List<GeneratedQuestion> parseResponse(String responseBody, String defaultSubject, String requestedDifficulty) throws IOException {
        JsonNode root = mapper.readTree(responseBody);
        JsonNode contentNode = root.path("choices").path(0).path("message").path("content");
        if (contentNode.isMissingNode() || contentNode.asText().isBlank()) {
            throw new IOException("Model response did not contain choices[0].message.content");
        }

        String rawText = contentNode.asText().trim();

        // Strip all markdown code fences
        if (rawText.contains("```")) {
            rawText = rawText.replaceAll("(?s)```(?:json)?\\s*", "").replaceAll("```", "").trim();
        }

        // Extract the JSON array even if the model prepended or appended explanatory text
        if (!rawText.startsWith("[")) {
            int start = rawText.indexOf('[');
            int end = rawText.lastIndexOf(']');
            if (start >= 0 && end > start) {
                rawText = rawText.substring(start, end + 1).trim();
            }
        }

        JsonNode parsed;
        try {
            parsed = mapper.readTree(rawText);
        } catch (IOException primaryParseError) {
            // Last-resort: fix common model quirk of using single quotes
            try {
                parsed = mapper.readTree(rawText.replace('\'', '"'));
            } catch (IOException e) {
                throw new IOException("Could not parse model output as JSON. Raw response (first 500 chars): " +
                    rawText.substring(0, Math.min(rawText.length(), 500)));
            }
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

            // Reject questions where any option is too long (raw PDF dump detected)
            boolean hasLongOption = options.stream().anyMatch(o -> o.length() > 120);
            if (hasLongOption) continue;

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
        log.warn("⚠️  FALLBACK TRIGGERED: AI question generation unavailable. " +
                 "Returning deterministic template questions extracted from document text. " +
                 "These are NOT AI-generated — they are pattern-based and lower quality.");
        List<String> facts = extractFacts(text);
        if (facts.isEmpty()) {
            throw new IllegalStateException("AI generation failed and fallback could not extract usable document facts");
        }

        String inferredSubject = inferSubject(text);
        List<GeneratedQuestion> generated = new ArrayList<>();
        Random random = new Random(text.hashCode());

        for (int i = 0; i < count; i++) {
            String correct = truncate(facts.get(i % facts.size()), 80);
            String alternate = truncate(facts.get((i + 1) % facts.size()), 80);
            int formatIndex = i % 8;
            List<String> options = new ArrayList<>();

            if (formatIndex == 7) {
                String unsupported = "It guarantees a behavior not stated anywhere in the document.";
                options.add(unsupported);
                options.add(correct);
                options.add(alternate);
                for (int j = 2; j < facts.size() && options.size() < 4; j++) {
                    String distractor = truncate(facts.get((i + j) % facts.size()), 80);
                    if (!distractor.equals(correct) && !distractor.equals(alternate)) options.add(distractor);
                }
                while (options.size() < 4) {
                    options.add("This statement is explicitly supported by the document.");
                }
            } else {
                options.add(correct);
                for (int j = 1; j < facts.size() && options.size() < 4; j++) {
                    String distractor = truncate(facts.get((i + j) % facts.size()), 80);
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
        String lower = text.toLowerCase(Locale.ROOT);
        // Computer Science & IT
        if (lower.contains("machine learning") || lower.contains("neural network") || lower.contains("deep learning") || lower.contains("gradient descent")) return "Machine Learning";
        if (lower.contains("artificial intelligence") || lower.contains("heuristic") || lower.contains("search algorithm") || lower.contains("knowledge representation")) return "Artificial Intelligence";
        if (lower.contains("computer network") || lower.contains("tcp/ip") || lower.contains("osi model") || lower.contains("routing protocol") || lower.contains("subnet")) return "Computer Networks";
        if (lower.contains("data structure") || lower.contains("linked list") || lower.contains("binary tree") || lower.contains("hash table") || lower.contains("graph traversal")) return "Data Structures & Algorithms";
        if (lower.contains("database") || lower.contains("sql") || lower.contains("rdbms") || lower.contains("normalization") || lower.contains("relational")) return "Database Systems";
        if (lower.contains("operating system") || lower.contains("kernel") || lower.contains("process scheduling") || lower.contains("deadlock") || lower.contains("semaphore")) return "Operating Systems";
        if (lower.contains("compiler") || lower.contains("lexical analysis") || lower.contains("parsing") || lower.contains("grammar") || lower.contains("syntax tree")) return "Compiler Design";
        if (lower.contains("software engineering") || lower.contains("sdlc") || lower.contains("agile") || lower.contains("scrum") || lower.contains("use case")) return "Software Engineering";
        if (lower.contains("cryptography") || lower.contains("encryption") || lower.contains("cybersecurity") || lower.contains("firewall") || lower.contains("vulnerability")) return "Information Security";
        if (lower.contains("cloud computing") || lower.contains("virtualization") || lower.contains("microservice") || lower.contains("containerization") || lower.contains("kubernetes")) return "Cloud Computing";
        if (lower.contains("web") || lower.contains("html") || lower.contains("http") || lower.contains("css") || lower.contains("rest api")) return "Web Technology";
        if (lower.contains("java") || lower.contains("jvm") || lower.contains("inheritance") || lower.contains("polymorphism") || lower.contains("encapsulation")) return "Object-Oriented Programming";
        if (lower.contains("digital circuit") || lower.contains("logic gate") || lower.contains("boolean algebra") || lower.contains("flip flop") || lower.contains("multiplexer")) return "Digital Electronics";
        if (lower.contains("computer architecture") || lower.contains("instruction set") || lower.contains("pipeline") || lower.contains("cache memory") || lower.contains("risc")) return "Computer Architecture";
        // Mathematics
        if (lower.contains("calculus") || lower.contains("differential equation") || lower.contains("integral") || lower.contains("derivative")) return "Calculus";
        if (lower.contains("linear algebra") || lower.contains("matrix") || lower.contains("eigenvalue") || lower.contains("vector space")) return "Linear Algebra";
        if (lower.contains("probability") || lower.contains("statistics") || lower.contains("distribution") || lower.contains("hypothesis")) return "Probability & Statistics";
        if (lower.contains("discrete math") || lower.contains("set theory") || lower.contains("combinatorics") || lower.contains("graph theory")) return "Discrete Mathematics";
        // Other subjects
        if (lower.contains("economics") || lower.contains("demand") || lower.contains("supply curve") || lower.contains("gdp")) return "Economics";
        if (lower.contains("management") || lower.contains("leadership") || lower.contains("organizational behavior") || lower.contains("strategy")) return "Management";
        if (lower.contains("physics") || lower.contains("velocity") || lower.contains("acceleration") || lower.contains("thermodynamics")) return "Physics";
        if (lower.contains("chemistry") || lower.contains("molecule") || lower.contains("periodic table") || lower.contains("reaction")) return "Chemistry";
        if (lower.contains("biology") || lower.contains("cell") || lower.contains("dna") || lower.contains("evolution")) return "Biology";
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

    private String truncate(String text, int maxLen) {
        if (text == null) return "";
        text = text.trim();
        return text.length() <= maxLen ? text : text.substring(0, maxLen).trim() + "...";
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