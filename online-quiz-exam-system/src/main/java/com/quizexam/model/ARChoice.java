package com.quizexam.model;

/**
 * The five fixed relationship choices for an Assertion-Reason question.
 * Maps to correct_choice values 1–5 in the database.
 */
public enum ARChoice {
    /** Both assertion and reason are true, and the reason is the correct explanation of the assertion. */
    BOTH_TRUE_REASON_CORRECT(1),
    /** Both assertion and reason are true, but the reason is NOT the correct explanation of the assertion. */
    BOTH_TRUE_REASON_INCORRECT(2),
    /** Assertion is true but the reason is false. */
    ASSERTION_TRUE_REASON_FALSE(3),
    /** Assertion is false but the reason is true. */
    ASSERTION_FALSE_REASON_TRUE(4),
    /** Both assertion and reason are false. */
    BOTH_FALSE(5);

    private final int value;

    ARChoice(int value) {
        this.value = value;
    }

    public int getValue() {
        return value;
    }

    public static ARChoice fromValue(int value) {
        for (ARChoice choice : values()) {
            if (choice.value == value) {
                return choice;
            }
        }
        throw new IllegalArgumentException("Invalid ARChoice value: " + value);
    }
}
