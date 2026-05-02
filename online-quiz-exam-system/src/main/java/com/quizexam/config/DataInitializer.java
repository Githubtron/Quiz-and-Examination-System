package com.quizexam.config;

import com.quizexam.model.Role;
import com.quizexam.model.User;
import com.quizexam.repository.UserRepository;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class DataInitializer {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public DataInitializer(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void seedDemoUsers() {
        seedUser("admin",       "admin@quizexam.com",   "admin123",        Role.ADMIN);
        seedUser("prof_test",   "prof@quizexam.com",    "testprof12345",   Role.PROFESSOR);
        seedUser("student_test","student@quizexam.com", "teststudent12345",Role.STUDENT);
    }

    private void seedUser(String username, String email, String password, Role role) {
        if (userRepository.existsByUsername(username)) return;
        User user = new User();
        user.setUsername(username);
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setRole(role);
        userRepository.save(user);
        System.out.printf("Demo user created: %s (%s)%n", username, role);
    }
}
