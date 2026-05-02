package com.quizexam.exception;

/**
 * Thrown when a student tries to start an exam they have already completed.
 * Requirement 5.8
 */
public class AlreadyAttemptedException extends AppException {

    public AlreadyAttemptedException(String message) {
        super(message);
    }

    public AlreadyAttemptedException(String message, Throwable cause) {
        super(message, cause);
    }
}
