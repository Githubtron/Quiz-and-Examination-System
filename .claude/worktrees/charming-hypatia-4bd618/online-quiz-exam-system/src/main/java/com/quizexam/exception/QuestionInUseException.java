package com.quizexam.exception;

/**
 * Thrown when a question cannot be deleted because it is assigned to an active exam.
 * Requirement 2.8
 */
public class QuestionInUseException extends AppException {

    public QuestionInUseException(String message) {
        super(message);
    }

    public QuestionInUseException(String message, Throwable cause) {
        super(message, cause);
    }
}
