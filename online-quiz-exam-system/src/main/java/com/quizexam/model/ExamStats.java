package com.quizexam.model;

/**
 * Aggregated statistics for an Exam across all submitted Results.
 */
public class ExamStats {
    private long examId;
    private double averageScore;
    private double medianScore;
    private double highestScore;
    private double lowestScore;
    private double passPercentage;
    private int totalAttempts;

    public ExamStats() {}

    public ExamStats(long examId, double averageScore, double medianScore,
                     double highestScore, double lowestScore,
                     double passPercentage, int totalAttempts) {
        this.examId = examId;
        this.averageScore = averageScore;
        this.medianScore = medianScore;
        this.highestScore = highestScore;
        this.lowestScore = lowestScore;
        this.passPercentage = passPercentage;
        this.totalAttempts = totalAttempts;
    }

    public long getExamId() { return examId; }
    public void setExamId(long examId) { this.examId = examId; }

    public double getAverageScore() { return averageScore; }
    public void setAverageScore(double averageScore) { this.averageScore = averageScore; }

    public double getMedianScore() { return medianScore; }
    public void setMedianScore(double medianScore) { this.medianScore = medianScore; }

    public double getHighestScore() { return highestScore; }
    public void setHighestScore(double highestScore) { this.highestScore = highestScore; }

    public double getLowestScore() { return lowestScore; }
    public void setLowestScore(double lowestScore) { this.lowestScore = lowestScore; }

    public double getPassPercentage() { return passPercentage; }
    public void setPassPercentage(double passPercentage) { this.passPercentage = passPercentage; }

    public int getTotalAttempts() { return totalAttempts; }
    public void setTotalAttempts(int totalAttempts) { this.totalAttempts = totalAttempts; }
}
