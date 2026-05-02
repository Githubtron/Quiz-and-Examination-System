package com.quizexam.exception;

/**
 * Base checked exception for all application-level errors.
 */
public class AppException extends Exception {

    public AppException(String message) {
        super(message);
    }

    public AppException(String message, Throwable cause) {
        super(message, cause);
    }
}
