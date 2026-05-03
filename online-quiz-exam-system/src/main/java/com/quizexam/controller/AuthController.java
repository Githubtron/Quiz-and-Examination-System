package com.quizexam.controller;

import com.quizexam.model.Role;
import com.quizexam.model.User;
import com.quizexam.repository.UserRepository;
import com.quizexam.security.JwtUtils;
import com.quizexam.security.LoginRateLimiter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthenticationManager authManager;
    private final JwtUtils jwtUtils;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final LoginRateLimiter loginRateLimiter;

    public AuthController(AuthenticationManager authManager, JwtUtils jwtUtils,
                          UserRepository userRepository, PasswordEncoder passwordEncoder,
                          LoginRateLimiter loginRateLimiter) {
        this.authManager = authManager;
        this.jwtUtils = jwtUtils;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.loginRateLimiter = loginRateLimiter;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest req, HttpServletRequest httpRequest) {
        String clientIp = httpRequest.getRemoteAddr();
        if (!loginRateLimiter.isAllowed(clientIp)) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .body(Map.of("error", "Too many login attempts. Please try again in 1 minute."));
        }
        Authentication auth = authManager.authenticate(
            new UsernamePasswordAuthenticationToken(req.username(), req.password()));
        String token = jwtUtils.generateToken(((UserDetails) auth.getPrincipal()).getUsername());
        User user = userRepository.findByUsername(req.username()).orElseThrow();
        return ResponseEntity.ok(Map.of(
            "token", token,
            "userId", user.getId(),
            "username", user.getUsername(),
            "role", user.getRole().name(),
            "email", user.getEmail()
        ));
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest req) {
        if (userRepository.existsByUsername(req.username()))
            return ResponseEntity.badRequest().body(Map.of("error", "Username already taken"));
        if (userRepository.existsByEmail(req.email()))
            return ResponseEntity.badRequest().body(Map.of("error", "Email already in use"));

        Role role;
        try { role = Role.valueOf(req.role().toUpperCase()); }
        catch (IllegalArgumentException e) { role = Role.STUDENT; }
        if (role == Role.ADMIN)
            return ResponseEntity.badRequest().body(Map.of("error", "Cannot self-register as ADMIN"));

        User user = new User();
        user.setUsername(req.username());
        user.setEmail(req.email());
        user.setPasswordHash(passwordEncoder.encode(req.password()));
        user.setRole(role);
        userRepository.save(user);
        return ResponseEntity.ok(Map.of("message", "Registration successful"));
    }

    public record LoginRequest(@NotBlank String username, @NotBlank String password) {}
    public record RegisterRequest(
        @NotBlank @Size(min = 3, max = 50) String username,
        @NotBlank @Email String email,
        @NotBlank @Size(min = 8) String password,
        String role
    ) {}
}
