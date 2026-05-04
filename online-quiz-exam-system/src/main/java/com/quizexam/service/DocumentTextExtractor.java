package com.quizexam.service;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class DocumentTextExtractor {

    private static final Logger log = LoggerFactory.getLogger(DocumentTextExtractor.class);

    /**
     * Extracts plain text from a PDF or DOCX file.
     * Truncates to 12000 chars to stay within AI token limits.
     */
    public String extract(MultipartFile file) throws IOException {
        String filename = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase();
        log.info("Extracting text from file: {} ({} bytes)", file.getOriginalFilename(), file.getSize());

        String text;
        if (filename.endsWith(".pdf")) {
            text = extractPdf(file);
        } else if (filename.endsWith(".docx")) {
            text = extractDocx(file);
        } else {
            throw new IllegalArgumentException("Unsupported file type. Please upload a PDF or DOCX file.");
        }

        text = text.trim().replaceAll("\\s{3,}", "\n\n");
        String cleaned = cleanForAi(text);
        String result = cleaned.length() > 12000 ? cleaned.substring(0, 12000) : cleaned;

        log.info("Extraction complete: {} chars extracted, {} chars after cleaning from '{}'",
            text.length(), result.length(), file.getOriginalFilename());

        // Step 1: Print extracted text to console for debugging
        System.out.println("=== EXTRACTED TEXT (" + result.length() + " chars) ===");
        System.out.println(result.length() > 1000 ? result.substring(0, 1000) + "\n...[truncated]" : result);
        System.out.println("=== END EXTRACTED TEXT ===");

        if (result.isBlank()) {
            log.warn("WARNING: Extracted text is EMPTY for file '{}'. Document may be image-based.", file.getOriginalFilename());
        }

        return result;
    }

    private String extractPdf(MultipartFile file) throws IOException {
        try (PDDocument doc = Loader.loadPDF(file.getInputStream().readAllBytes())) {
            PDFTextStripper stripper = new PDFTextStripper();
            return stripper.getText(doc);
        }
    }

    private String extractDocx(MultipartFile file) throws IOException {
        try (XWPFDocument doc = new XWPFDocument(file.getInputStream())) {
            return doc.getParagraphs().stream()
                    .map(XWPFParagraph::getText)
                    .collect(Collectors.joining("\n"));
        }
    }

    private String cleanForAi(String rawText) {
        String[] lines = rawText.split("\\R+");
        List<String> cleaned = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>(); // deduplicate repeated headers/footers
        int skipFollowingMetadataLines = 0;

        for (String line : lines) {
            String normalized = line.replaceAll("\\s+", " ").trim();
            if (normalized.isEmpty()) continue;

            if (skipFollowingMetadataLines > 0) {
                skipFollowingMetadataLines--;
                continue;
            }

            if (startsMetadataSection(normalized)) {
                skipFollowingMetadataLines = 2;
                continue;
            }

            if (isMetadataLine(normalized)) continue;
            if (normalized.length() < 20) continue;

            // Skip exact duplicates (repeated running headers/footers in PDFs)
            String key = normalized.toLowerCase(Locale.ROOT);
            if (!seen.add(key)) continue;

            cleaned.add(normalized);
        }

        if (!cleaned.isEmpty()) return String.join("\n", cleaned);

        // Fallback if strict filtering removes everything.
        List<String> relaxed = new ArrayList<>();
        for (String line : lines) {
            String normalized = line.replaceAll("\\s+", " ").trim();
            if (normalized.isEmpty()) continue;
            if (isMetadataLine(normalized)) continue;
            if (normalized.length() < 30) continue;
            relaxed.add(normalized);
        }
        return String.join("\n", relaxed);
    }

    private boolean startsMetadataSection(String line) {
        String lower = line.toLowerCase(Locale.ROOT);
        return lower.contains("prepared by")
            || lower.contains("approved by")
            || lower.contains("checked by")
            || lower.contains("verified by");
    }

    private boolean isMetadataLine(String line) {
        String lower = line.toLowerCase(Locale.ROOT);

        if (lower.matches(".*\\bpage\\s*\\d+\\s*(of\\s*\\d+)?\\b.*")) return true;
        if (line.matches(".*\\b\\d{2}[A-Z]{2,}\\d{2,}[A-Z0-9]*\\b.*")) return true; // e.g. 22CSE44
        if (line.matches(".*\\b[A-Z]{2,}[0-9]{2,}[A-Z0-9]*\\b.*")) return true;     // generic course code

        if (lower.contains("department of")
            || lower.contains("school of")
            || lower.contains("faculty of")
            || lower.contains("university")
            || lower.contains("course code")
            || lower.contains("course title")
            || lower.contains("academic year")
            || lower.contains("semester")
            || lower.contains("regulation")
            || lower.contains("hod")
            || lower.contains("professor")
            || lower.contains("prepared by")
            || lower.contains("approved by")) {
            return true;
        }

        return lower.startsWith("dr.")
            || lower.startsWith("prof.")
            || lower.startsWith("mr.")
            || lower.startsWith("mrs.")
            || lower.startsWith("ms.");
    }
}
