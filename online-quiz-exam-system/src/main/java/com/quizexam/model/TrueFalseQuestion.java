package com.quizexam.model;

import jakarta.persistence.*;

@Entity
@DiscriminatorValue("TF")
public class TrueFalseQuestion extends Question {

    @Column(name = "correct_answer")
    private boolean correctAnswer;

    public TrueFalseQuestion() {}

    @Override
    public String getType() { return "TF"; }

    @Override
    public String getCorrectAnswerValue() { return String.valueOf(correctAnswer); }

    public boolean isCorrectAnswer() { return correctAnswer; }
    public void setCorrectAnswer(boolean correctAnswer) { this.correctAnswer = correctAnswer; }
}
