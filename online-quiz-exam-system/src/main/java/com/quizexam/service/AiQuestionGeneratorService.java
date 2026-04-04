package com.quizexam.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import java.util.Map;

/**
 * Calls Google Gemini API to generate MCQ questions from document text.
 * Set GEMINI_API_KEY environment variable (or app.gemini.api-key in application.properties).
 * Get a free key at: https://aistudio.google.com/app/apikey
 */
@Service
public class AiQuestionGeneratorService {

    @Value("${app.gemini.api-key:}")
    private String apiKey;

    private static final String GEMINI_URL =
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=";

    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newHttpClient();

    /**
     * Generates MCQ questions from the given text.
     * Returns a list of GeneratedQuestion DTOs.
     */
    public List<GeneratedQuestion> generate(String documentText, int count) throws IOException, InterruptedException {
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException(
                "Gemini API key not configured. Set app.gemini.api-key in application.properties or GEMINI_API_KEY env variable.");
        }

        String prompt = buildPrompt(documentText, count);

        // Build Gemini request body
        Map<String, Object> body = Map.of(
            "contents", List.of(Map.of(
                "parts", List.of(Map.of("text", prompt))
            )),
            "generationConfig", Map.of(
                "temperature", 0.7,
                "maxOutputTokens", 4096
            )
        );

        String requestJson = mapper.writeValueAsString(body);

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(GEMINI_URL + apiKey))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(requestJson))
            .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            throw new IOException("Gemini API error " + response.statusCode() + ": " + response.body());
        }

        return parseResponse(response.body());
    }

    private String buildPrompt(String text, int count) {
        return """
            You are an expert educator. Based on the following document text, generate exactly %d multiple-choice questions (MCQs).
            
            Rules:
            - Each question must have exactly 4 options (A, B, C, D)
            - Only one option is correct
            - Questions should test understanding, not just memorization
            - Vary difficulty: mix EASY, MEDIUM, HARD
            - Return ONLY a valid JSON array, no markdown, no explanation
            
            JSON format (return exactly this structure):
            [
              {
                "text": "Question text here?",
                "options": ["Option A", "Option B", "Option C", "Option D"],
                "correctIndex": 0,
                "difficulty": "MEDIUM",
                "subject": "inferred subject",
                "topic": "inferred topic"
              }
            ]
            
            Document text:
            %s
            """.formatted(count, text);
    }

    private List<GeneratedQuestion> parseResponse(String responseBody) throws IOException {
        JsonNode root = mapper.readTree(responseBody);
        String rawText = root
            .path("candidates").get(0)
            .path("content")
            .path("parts").get(0)
            .path("text").asText();

        // Strip markdown code fences if present
        rawText = rawText.trim();
        if (rawText.startsWith("```")) {
            rawText = rawText.replaceAll("^```[a-z]*\\n?", "").replaceAll("```$", "").trim();
        }

        return mapper.readValue(rawText, new TypeReference<List<GeneratedQuestion>>() {});
    }

    /** DTO for a generated question (not yet saved to DB) */
    public record GeneratedQuestion(
        String text,
        List<String> options,
        int correctIndex,
        String difficulty,
        String subject,
        String topic
    ) {}
}
