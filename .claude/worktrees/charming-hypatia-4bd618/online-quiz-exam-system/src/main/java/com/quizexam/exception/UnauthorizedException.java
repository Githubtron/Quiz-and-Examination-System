package com.quizexam.exception;

/**
 * Thrown when a user attempts an action they are not authorized to perform.
 */
public class UnauthorizedException extends AppException {

    public UnauthorizedException(String message) {
        super(message);
    }

    public UnauthorizedException(String message, Throwable cause) {
        super(message, cause);
    }
}
