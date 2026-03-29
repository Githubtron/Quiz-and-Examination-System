package com.quizexam.exception;

/**
 * Thrown when an exam cannot be edited or deleted because it has submitted attempts.
 * Requirement 3.6
 */
public class ExamHasAttemptsException extends AppException {

    public ExamHasAttemptsException(String message) {
        super(message);
    }

    public ExamHasAttemptsException(String message, Throwable cause) {
        super(message, cause);
    }
}
