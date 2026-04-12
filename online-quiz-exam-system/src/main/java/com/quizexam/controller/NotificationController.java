package com.quizexam.controller;

import com.quizexam.model.Notification;
import com.quizexam.model.Role;
import com.quizexam.model.User;
import com.quizexam.repository.NotificationRepository;
import com.quizexam.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;

    public NotificationController(NotificationRepository notificationRepository,
                                   UserRepository userRepository) {
        this.notificationRepository = notificationRepository;
        this.userRepository = userRepository;
    }

    /** Get my notifications */
    @GetMapping
    public List<Notification> myNotifications(@AuthenticationPrincipal UserDetails principal) {
        long userId = userRepository.findByUsername(principal.getUsername()).orElseThrow().getId();
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    /** Get unread count */
    @GetMapping("/unread-count")
    public Map<String, Integer> unreadCount(@AuthenticationPrincipal UserDetails principal) {
        long userId = userRepository.findByUsername(principal.getUsername()).orElseThrow().getId();
        int count = notificationRepository.findByUserIdAndReadFalse(userId).size();
        return Map.of("count", count);
    }

    /** Mark a notification as read */
    @PutMapping("/{id}/read")
    public ResponseEntity<?> markRead(@PathVariable long id,
                                       @AuthenticationPrincipal UserDetails principal) {
        long userId = userRepository.findByUsername(principal.getUsername()).orElseThrow().getId();
        return notificationRepository.findById(id).map(n -> {
            if (n.getUserId() != userId)
                return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
            n.setRead(true);
            return ResponseEntity.ok(notificationRepository.save(n));
        }).orElse(ResponseEntity.notFound().build());
    }

    /** Mark all as read */
    @PutMapping("/read-all")
    public ResponseEntity<?> markAllRead(@AuthenticationPrincipal UserDetails principal) {
        long userId = userRepository.findByUsername(principal.getUsername()).orElseThrow().getId();
        List<Notification> unread = notificationRepository.findByUserIdAndReadFalse(userId);
        unread.forEach(n -> n.setRead(true));
        notificationRepository.saveAll(unread);
        return ResponseEntity.ok(Map.of("marked", unread.size()));
    }

    /**
     * Professor/Admin: notify all students about an exam becoming available.
     * POST /api/notifications/exam-available/{examId}
     */
    @PostMapping("/exam-available/{examId}")
    @PreAuthorize("hasAnyRole('PROFESSOR','ADMIN')")
    public ResponseEntity<?> notifyExamAvailable(@PathVariable long examId) {
        List<User> students = userRepository.findAll().stream()
            .filter(u -> u.getRole() == Role.STUDENT)
            .toList();
        List<Notification> notifications = students.stream()
            .map(s -> new Notification(s.getId(), "A new exam is now available.", examId))
            .toList();
        notificationRepository.saveAll(notifications);
        return ResponseEntity.ok(Map.of("notified", notifications.size()));
    }

    /**
     * Professor/Admin: notify all students that results are published for an exam.
     * POST /api/notifications/results-published/{examId}
     */
    @PostMapping("/results-published/{examId}")
    @PreAuthorize("hasAnyRole('PROFESSOR','ADMIN')")
    public ResponseEntity<?> notifyResultsPublished(@PathVariable long examId) {
        List<User> students = userRepository.findAll().stream()
            .filter(u -> u.getRole() == Role.STUDENT)
            .toList();
        List<Notification> notifications = students.stream()
            .map(s -> new Notification(s.getId(), "Results have been published for your exam.", examId))
            .toList();
        notificationRepository.saveAll(notifications);
        return ResponseEntity.ok(Map.of("notified", notifications.size()));
    }
}
