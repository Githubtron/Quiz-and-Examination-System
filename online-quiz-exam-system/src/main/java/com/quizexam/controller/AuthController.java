package com.quizexam.controller;

import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseToken;
import com.quizexam.model.Role;
import com.quizexam.model.User;
import com.quizexam.repository.UserRepository;
import com.quizexam.security.JwtUtils;
import com.quizexam.security.LoginRateLimiter;
import com.quizexam.service.FirebaseAuthService;
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
import java.util.UUID;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthenticationManager authManager;
    private final JwtUtils jwtUtils;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final LoginRateLimiter loginRateLimiter;
    private final FirebaseAuthService firebaseAuthService;

    public AuthController(AuthenticationManager authManager, JwtUtils jwtUtils,
                          UserRepository userRepository, PasswordEncoder passwordEncoder,
                          LoginRateLimiter loginRateLimiter,
                          FirebaseAuthService firebaseAuthService) {
        this.authManager = authManager;
        this.jwtUtils = jwtUtils;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.loginRateLimiter = loginRateLimiter;
        this.firebaseAuthService = firebaseAuthService;
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

    /**
     * Firebase login: the frontend sends a Firebase ID token; we verify it,
     * find-or-create a local user, and return our own JWT so the rest of the
     * app works exactly as before.
     */
    @PostMapping("/firebase-login")
    public ResponseEntity<?> firebaseLogin(@RequestBody FirebaseLoginRequest req) {
        if (req.idToken() == null || req.idToken().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Missing Firebase ID token"));
        }

        FirebaseToken decoded;
        try {
            decoded = firebaseAuthService.verifyIdToken(req.idToken());
        } catch (FirebaseAuthException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("error", "Invalid or expired Firebase token"));
        } catch (IllegalStateException e) {
            // Firebase Admin SDK was not initialised (missing service-account file)
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(Map.of("error", "Firebase authentication is not configured on the server. " +
                             "Please add firebase-service-account.json to the backend resources folder."));
        }

        // ── Resolve email ─────────────────────────────────────────────────────
        String email = decoded.getEmail();
        if (email == null || email.isBlank()) {
            // Phone-auth users have no email — synthesise a stable placeholder
            email = "phone_" + decoded.getUid() + "@firebase.quizmaster.local";
        }

        // ── Find or create local user ─────────────────────────────────────────
        final String resolvedEmail = email;
        User user = userRepository.findByEmail(resolvedEmail).orElseGet(() -> {
            // Derive a username: prefer display name, then email prefix, then UID prefix
            String displayName = decoded.getName();
            String base = (displayName != null && !displayName.isBlank())
                ? displayName.toLowerCase().replaceAll("[^a-z0-9]", "_")
                : resolvedEmail.contains("@") ? resolvedEmail.split("@")[0] : decoded.getUid().substring(0, 8);

            // Ensure username is unique
            String username = base;
            int suffix = 2;
            while (userRepository.existsByUsername(username)) {
                username = base + "_" + suffix++;
            }

            User newUser = new User();
            newUser.setUsername(username);
            newUser.setEmail(resolvedEmail);
            // Firebase-authed users don't need a local password — set a random one
            newUser.setPasswordHash(passwordEncoder.encode(UUID.randomUUID().toString()));
            newUser.setRole(Role.STUDENT);   // default role; admins can promote later
            return userRepository.save(newUser);
        });

        String token = jwtUtils.generateToken(user.getUsername());
        return ResponseEntity.ok(Map.of(
            "token",    token,
            "userId",   user.getId(),
            "username", user.getUsername(),
            "role",     user.getRole().name(),
            "email",    user.getEmail()
        ));
    }

    /**
     * Demo login: returns a real JWT for a pre-seeded demo user based on role.
     * No password required — intended for presentations / UI demos only.
     * Both STUDENT ("alex_demo") and PROFESSOR ("dr_demo") are seeded by DataInitializer.
     */
    @PostMapping("/demo-login")
    public ResponseEntity<?> demoLogin(@RequestBody DemoLoginRequest req) {
        if (req.role() == null || req.role().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Missing role"));
        }
        String username = switch (req.role().toUpperCase()) {
            case "STUDENT"   -> "alex_demo";
            case "PROFESSOR" -> "dr_demo";
            case "ADMIN"     -> "admin_demo";
            default -> null;
        };
        if (username == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid demo role. Use STUDENT, PROFESSOR, or ADMIN"));
        }
        User user = userRepository.findByUsername(username).orElse(null);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(Map.of("error", "Demo user not found. Backend may still be initialising — retry in a moment."));
        }
        String token = jwtUtils.generateToken(user.getUsername());
        return ResponseEntity.ok(Map.of(
            "token",    token,
            "userId",   user.getId(),
            "username", user.getUsername(),
            "role",     user.getRole().name(),
            "email",    user.getEmail()
        ));
    }

    public record DemoLoginRequest(String role) {}
    public record FirebaseLoginRequest(String idToken) {}

    public record LoginRequest(@NotBlank String username, @NotBlank String password) {}
    public record RegisterRequest(
        @NotBlank @Size(min = 3, max = 50) String username,
        @NotBlank @Email String email,
        @NotBlank @Size(min = 8) String password,
        String role
    ) {}
}
