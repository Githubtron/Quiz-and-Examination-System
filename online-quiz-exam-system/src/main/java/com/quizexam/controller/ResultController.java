package com.quizexam.controller;

import com.quizexam.model.Attempt;
import com.quizexam.model.Result;
import com.quizexam.model.User;
import com.quizexam.repository.AttemptRepository;
import com.quizexam.repository.ResultRepository;
import com.quizexam.repository.UserRepository;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.io.ByteArrayOutputStream;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.util.List;

@RestController
@RequestMapping("/api/results")
public class ResultController {

    private final ResultRepository resultRepository;
    private final UserRepository userRepository;
    private final AttemptRepository attemptRepository;

    public ResultController(ResultRepository resultRepository, UserRepository userRepository,
                             AttemptRepository attemptRepository) {
        this.resultRepository = resultRepository;
        this.userRepository = userRepository;
        this.attemptRepository = attemptRepository;
    }

    /** Student: get my results */
    @GetMapping("/my")
    @PreAuthorize("hasRole('STUDENT')")
    public List<Result> myResults(@AuthenticationPrincipal UserDetails principal) {
        long studentId = userRepository.findByUsername(principal.getUsername()).orElseThrow().getId();
        return resultRepository.findByStudentId(studentId);
    }

    /** Professor/Admin: get results for a specific exam */
    @GetMapping("/exam/{examId}")
    @PreAuthorize("hasAnyRole('PROFESSOR','ADMIN')")
    public List<Result> byExam(@PathVariable long examId) {
        return resultRepository.findByExamId(examId);
    }

    /** Get all results (admin) */
    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public List<Result> all() {
        return resultRepository.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Result> get(@PathVariable long id) {
        return resultRepository.findById(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    /**
     * GET /api/results/exam/{examId}/export/csv
     * Export exam results as CSV.
     */
    @GetMapping("/exam/{examId}/export/csv")
    @PreAuthorize("hasAnyRole('PROFESSOR','ADMIN')")
    public ResponseEntity<byte[]> exportCsv(@PathVariable long examId) {
        List<Result> results = resultRepository.findByExamId(examId);
        StringWriter sw = new StringWriter();
        PrintWriter pw = new PrintWriter(sw);
        pw.println("StudentId,Username,AttemptId,TotalScore,MaxScore,Percentage,SubmittedAt");
        for (Result r : results) {
            Attempt attempt = attemptRepository.findById(r.getAttemptId()).orElse(null);
            long studentId = attempt != null ? attempt.getStudentId() : 0;
            String username = userRepository.findById(studentId).map(User::getUsername).orElse("unknown");
            String submittedAt = attempt != null && attempt.getSubmittedAt() != null
                ? attempt.getSubmittedAt().toString() : "";
            pw.printf("%d,%s,%d,%.2f,%d,%.2f,%s%n",
                studentId, username, r.getAttemptId(),
                r.getTotalScore(), r.getMaxScore(), r.getPercentage(), submittedAt);
        }
        pw.flush();
        byte[] bytes = sw.toString().getBytes();
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"results-exam-" + examId + ".csv\"")
            .contentType(MediaType.parseMediaType("text/csv"))
            .body(bytes);
    }

    /**
     * GET /api/results/exam/{examId}/export/pdf
     * Export exam results as PDF using Apache PDFBox.
     */
    @GetMapping("/exam/{examId}/export/pdf")
    @PreAuthorize("hasAnyRole('PROFESSOR','ADMIN')")
    public ResponseEntity<byte[]> exportPdf(@PathVariable long examId) throws Exception {
        List<Result> results = resultRepository.findByExamId(examId);

        try (PDDocument doc = new PDDocument()) {
            PDPage page = new PDPage(PDRectangle.A4);
            doc.addPage(page);

            PDType1Font boldFont = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
            PDType1Font regularFont = new PDType1Font(Standard14Fonts.FontName.HELVETICA);

            try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
                float margin = 50;
                float y = page.getMediaBox().getHeight() - margin;
                float rowHeight = 20;

                // Title
                cs.beginText();
                cs.setFont(boldFont, 14);
                cs.newLineAtOffset(margin, y);
                cs.showText("Exam Results — Exam ID: " + examId);
                cs.endText();
                y -= 30;

                // Header row
                cs.beginText();
                cs.setFont(boldFont, 10);
                cs.newLineAtOffset(margin, y);
                cs.showText(String.format("%-20s %-12s %-12s %-12s", "Username", "Score", "MaxScore", "Percentage"));
                cs.endText();
                y -= rowHeight;

                // Data rows
                for (Result r : results) {
                    if (y < margin + rowHeight) {
                        y = margin + rowHeight; // clamp to bottom margin
                    }
                    Attempt attempt = attemptRepository.findById(r.getAttemptId()).orElse(null);
                    long studentId = attempt != null ? attempt.getStudentId() : 0;
                    String username = userRepository.findById(studentId).map(User::getUsername).orElse("unknown");
                    cs.beginText();
                    cs.setFont(regularFont, 10);
                    cs.newLineAtOffset(margin, y);
                    cs.showText(String.format("%-20s %-12.2f %-12d %-12.2f",
                        username, r.getTotalScore(), r.getMaxScore(), r.getPercentage()));
                    cs.endText();
                    y -= rowHeight;
                }
            }

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            doc.save(baos);
            return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"results-exam-" + examId + ".pdf\"")
                .contentType(MediaType.APPLICATION_PDF)
                .body(baos.toByteArray());
        }
    }

    /**
     * GET /api/results/{id}/export/pdf
     * Export a single result as PDF.
     */
    @GetMapping("/{id}/export/pdf")
    public ResponseEntity<byte[]> exportSinglePdf(@PathVariable long id, @AuthenticationPrincipal UserDetails principal) throws Exception {
        Result result = resultRepository.findById(id).orElseThrow();
        Attempt attempt = attemptRepository.findById(result.getAttemptId()).orElse(null);
        long studentId = attempt != null ? attempt.getStudentId() : 0;
        User user = userRepository.findByUsername(principal.getUsername()).orElseThrow();
        
        if (user.getRole() == com.quizexam.model.Role.STUDENT && user.getId() != studentId) {
            return ResponseEntity.status(403).build();
        }

        try (PDDocument doc = new PDDocument()) {
            PDPage page = new PDPage(PDRectangle.A4);
            doc.addPage(page);

            PDType1Font boldFont = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
            PDType1Font regularFont = new PDType1Font(Standard14Fonts.FontName.HELVETICA);

            try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
                float margin = 50;
                float y = page.getMediaBox().getHeight() - margin;
                float rowHeight = 20;

                cs.beginText();
                cs.setFont(boldFont, 16);
                cs.newLineAtOffset(margin, y);
                cs.showText("QuizMaster Result Report");
                cs.endText();
                y -= 40;

                cs.beginText();
                cs.setFont(regularFont, 12);
                cs.newLineAtOffset(margin, y);
                cs.showText("Attempt ID: #" + result.getAttemptId());
                cs.newLineAtOffset(0, -rowHeight);
                cs.showText("Student: " + userRepository.findById(studentId).map(User::getUsername).orElse("unknown"));
                cs.newLineAtOffset(0, -rowHeight);
                cs.showText("Total Score: " + result.getTotalScore() + " / " + result.getMaxScore());
                cs.newLineAtOffset(0, -rowHeight);
                cs.showText("Percentage: " + String.format("%.2f", result.getPercentage()) + "%");
                cs.newLineAtOffset(0, -rowHeight);
                cs.showText("Status: " + (result.getPercentage() >= 50 ? "PASS" : "FAIL"));
                cs.endText();
            }

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            doc.save(baos);
            return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"result-attempt-" + result.getAttemptId() + ".pdf\"")
                .contentType(MediaType.APPLICATION_PDF)
                .body(baos.toByteArray());
        }
    }
}
