package com.quizexam.exception;

/**
 * Thrown when a student attempts to start an exam outside its scheduled window.
 * Requirement 4.2
 */
public class ExamNotAvailableException extends AppException {

    public ExamNotAvailableException(String message) {
        super(message);
    }

    public ExamNotAvailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
