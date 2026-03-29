package com.quizexam.model;

/**
 * Per-question statistics for an Exam — used to identify the hardest questions.
 */
public class QuestionStats {
    private long questionId;
    private String questionText;
    private int totalAnswered;
    private int incorrectCount;
    private double incorrectRate; // incorrectCount / totalAnswered * 100

    public QuestionStats() {}

    public QuestionStats(long questionId, String questionText,
                         int totalAnswered, int incorrectCount, double incorrectRate) {
        this.questionId = questionId;
        this.questionText = questionText;
        this.totalAnswered = totalAnswered;
        this.incorrectCount = incorrectCount;
        this.incorrectRate = incorrectRate;
    }

    public long getQuestionId() { return questionId; }
    public void setQuestionId(long questionId) { this.questionId = questionId; }

    public String getQuestionText() { return questionText; }
    public void setQuestionText(String questionText) { this.questionText = questionText; }

    public int getTotalAnswered() { return totalAnswered; }
    public void setTotalAnswered(int totalAnswered) { this.totalAnswered = totalAnswered; }

    public int getIncorrectCount() { return incorrectCount; }
    public void setIncorrectCount(int incorrectCount) { this.incorrectCount = incorrectCount; }

    public double getIncorrectRate() { return incorrectRate; }
    public void setIncorrectRate(double incorrectRate) { this.incorrectRate = incorrectRate; }
}
