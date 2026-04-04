package com.quizexam.service;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.stream.Collectors;

@Service
public class DocumentTextExtractor {

    /**
     * Extracts plain text from a PDF or DOCX file.
     * Truncates to 12000 chars to stay within AI token limits.
     */
    public String extract(MultipartFile file) throws IOException {
        String filename = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase();

        String text;
        if (filename.endsWith(".pdf")) {
            text = extractPdf(file);
        } else if (filename.endsWith(".docx")) {
            text = extractDocx(file);
        } else {
            throw new IllegalArgumentException("Unsupported file type. Please upload a PDF or DOCX file.");
        }

        // Trim and cap to avoid exceeding AI token limits
        text = text.trim().replaceAll("\\s{3,}", "\n\n");
        return text.length() > 12000 ? text.substring(0, 12000) : text;
    }

    private String extractPdf(MultipartFile file) throws IOException {
        try (PDDocument doc = PDDocument.load(file.getInputStream())) {
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
}
