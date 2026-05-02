package com.quizexam.exception;

/**
 * Thrown when input validation fails (e.g. missing fields, invalid format).
 */
public class ValidationException extends AppException {

    public ValidationException(String message) {
        super(message);
    }

    public ValidationException(String message, Throwable cause) {
        super(message, cause);
    }
}
