package com.quizexam.exception;

/**
 * Thrown when a registration attempt uses a username or email already in use.
 */
public class DuplicateUserException extends AppException {

    public DuplicateUserException(String message) {
        super(message);
    }

    public DuplicateUserException(String message, Throwable cause) {
        super(message, cause);
    }
}
