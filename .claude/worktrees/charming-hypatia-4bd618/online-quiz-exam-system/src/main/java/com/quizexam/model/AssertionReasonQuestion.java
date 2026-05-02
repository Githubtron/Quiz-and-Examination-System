package com.quizexam.model;

import jakarta.persistence.*;

@Entity
@DiscriminatorValue("AR")
public class AssertionReasonQuestion extends Question {

    @Column(columnDefinition = "TEXT")
    private String assertion;

    @Column(columnDefinition = "TEXT")
    private String reason;

    @Column(name = "correct_choice")
    private int correctChoice; // 0-3 matching AR_CHOICES

    public AssertionReasonQuestion() {}

    @Override
    public String getType() { return "AR"; }

    @Override
    public String getCorrectAnswerValue() { return String.valueOf(correctChoice); }

    public String getAssertion() { return assertion; }
    public void setAssertion(String assertion) { this.assertion = assertion; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }

    public int getCorrectChoice() { return correctChoice; }
    public void setCorrectChoice(int correctChoice) { this.correctChoice = correctChoice; }
}
