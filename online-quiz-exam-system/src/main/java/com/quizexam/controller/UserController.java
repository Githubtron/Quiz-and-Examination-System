package com.quizexam.controller;

import com.quizexam.model.Role;
import com.quizexam.model.User;
import com.quizexam.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public UserController(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    /** Get current user profile */
    @GetMapping("/me")
    public ResponseEntity<User> me(@AuthenticationPrincipal UserDetails principal) {
        return userRepository.findByUsername(principal.getUsername())
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    /** Update current user profile */
    @PutMapping("/me")
    public ResponseEntity<User> updateMe(@RequestBody Map<String, String> updates,
                                         @AuthenticationPrincipal UserDetails principal) {
        User user = userRepository.findByUsername(principal.getUsername()).orElseThrow();
        if (updates.containsKey("email")) user.setEmail(updates.get("email"));
        if (updates.containsKey("password") && !updates.get("password").isBlank())
            user.setPasswordHash(passwordEncoder.encode(updates.get("password")));
        return ResponseEntity.ok(userRepository.save(user));
    }

    /** Admin: list all users */
    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public List<User> listAll() {
        return userRepository.findAll();
    }

    /** Admin: delete user */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> delete(@PathVariable long id) {
        userRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    /** Admin: create admin user */
    @PostMapping("/admin")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> createAdmin(@RequestBody Map<String, String> body) {
        if (userRepository.existsByUsername(body.get("username")))
            return ResponseEntity.badRequest().body(Map.of("error", "Username taken"));
        User user = new User();
        user.setUsername(body.get("username"));
        user.setEmail(body.get("email"));
        user.setPasswordHash(passwordEncoder.encode(body.get("password")));
        user.setRole(Role.ADMIN);
        return ResponseEntity.ok(userRepository.save(user));
    }
}
