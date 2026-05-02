package com.quizexam.controller;

import com.quizexam.model.Category;
import com.quizexam.repository.CategoryRepository;
import com.quizexam.repository.ExamTemplateRepository;
import com.quizexam.repository.QuestionRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Comparator;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/categories")
public class CategoryController {

    private final CategoryRepository categoryRepository;
    private final QuestionRepository questionRepository;
    private final ExamTemplateRepository examTemplateRepository;

    public CategoryController(CategoryRepository categoryRepository,
                              QuestionRepository questionRepository,
                              ExamTemplateRepository examTemplateRepository) {
        this.categoryRepository = categoryRepository;
        this.questionRepository = questionRepository;
        this.examTemplateRepository = examTemplateRepository;
    }

    @GetMapping
    public List<Category> list() {
        return categoryRepository.findAll().stream()
            .sorted(Comparator.comparing(Category::getName, String.CASE_INSENSITIVE_ORDER))
            .toList();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Category> get(@PathVariable long id) {
        return categoryRepository.findById(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('PROFESSOR','ADMIN')")
    public ResponseEntity<?> create(@Valid @RequestBody CategoryRequest req) {
        String name = req.name().trim();
        if (categoryRepository.existsByNameIgnoreCase(name)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Category with this name already exists"));
        }
        Category category = new Category();
        category.setName(name);
        category.setDescription(req.description());
        return ResponseEntity.ok(categoryRepository.save(category));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('PROFESSOR','ADMIN')")
    public ResponseEntity<?> update(@PathVariable long id, @Valid @RequestBody CategoryRequest req) {
        String name = req.name().trim();
        var duplicate = categoryRepository.findByNameIgnoreCase(name);
        if (duplicate.isPresent() && duplicate.get().getId() != id) {
            return ResponseEntity.badRequest().body(Map.of("error", "Category with this name already exists"));
        }
        return categoryRepository.findById(id).map(category -> {
            category.setName(name);
            category.setDescription(req.description());
            return ResponseEntity.ok(categoryRepository.save(category));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('PROFESSOR','ADMIN')")
    public ResponseEntity<?> delete(@PathVariable long id) {
        if (!categoryRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        if (questionRepository.existsByCategoryId(id)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Category is in use by existing questions"));
        }
        if (examTemplateRepository.existsByCategoryId(id)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Category is in use by exam templates"));
        }
        categoryRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    public record CategoryRequest(
        @NotBlank String name,
        String description
    ) {}
}
