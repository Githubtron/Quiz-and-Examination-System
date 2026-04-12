package com.quizexam.repository;

import com.quizexam.model.Notification;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface NotificationRepository extends JpaRepository<Notification, Long> {
    List<Notification> findByUserIdOrderByCreatedAtDesc(long userId);
    List<Notification> findByUserIdAndReadFalse(long userId);
}
