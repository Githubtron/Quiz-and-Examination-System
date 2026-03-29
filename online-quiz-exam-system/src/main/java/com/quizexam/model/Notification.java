package com.quizexam.model;

import java.time.LocalDateTime;

public class Notification {
    private long id;
    private long userId;
    private String message;
    private Long examId; // nullable
    private LocalDateTime createdAt;
    private boolean read;

    public Notification() {}

    public Notification(long id, long userId, String message, Long examId,
                        LocalDateTime createdAt, boolean read) {
        this.id = id;
        this.userId = userId;
        this.message = message;
        this.examId = examId;
        this.createdAt = createdAt;
        this.read = read;
    }

    public long getId() { return id; }
    public void setId(long id) { this.id = id; }

    public long getUserId() { return userId; }
    public void setUserId(long userId) { this.userId = userId; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public Long getExamId() { return examId; }
    public void setExamId(Long examId) { this.examId = examId; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public boolean isRead() { return read; }
    public void setRead(boolean read) { this.read = read; }
}
