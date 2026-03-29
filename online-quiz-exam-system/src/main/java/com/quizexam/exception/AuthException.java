package com.quizexam.exception;

/**
 * Thrown when authentication fails (e.g. wrong credentials).
 * Requirement 1.5
 */
public class AuthException extends AppException {

    public AuthException(String message) {
        super(message);
    }

    public AuthException(String message, Throwable cause) {
        super(message, cause);
    }
}
