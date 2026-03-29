package com.quizexam.controller;

import com.quizexam.model.Result;
import com.quizexam.repository.ResultRepository;
import com.quizexam.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/results")
public class ResultController {

    private final ResultRepository resultRepository;
    private final UserRepository userRepository;

    public ResultController(ResultRepository resultRepository, UserRepository userRepository) {
        this.resultRepository = resultRepository;
        this.userRepository = userRepository;
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
}
