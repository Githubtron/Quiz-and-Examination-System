package com.quizexam.exception;

/**
 * Wraps a {@link java.sql.SQLException} when a database transaction fails.
 * Requirement 12.5
 */
public class DatabaseException extends AppException {

    public DatabaseException(String message) {
        super(message);
    }

    public DatabaseException(String message, Throwable cause) {
        super(message, cause);
    }
}
