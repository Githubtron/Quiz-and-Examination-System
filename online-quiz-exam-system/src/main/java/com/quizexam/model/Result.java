package com.quizexam.model;

import jakarta.persistence.*;

@Entity
@Table(name = "results")
public class Result {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private long id;

    @Column(name = "attempt_id", nullable = false, unique = true)
    private long attemptId;

    @Column(name = "total_score")
    private double totalScore;

    @Column(name = "max_score")
    private int maxScore;

    private double percentage;

    @Column(name = "detail_json", columnDefinition = "TEXT")
    private String detailJson;

    public Result() {}

    public long getId() { return id; }
    public void setId(long id) { this.id = id; }

    public long getAttemptId() { return attemptId; }
    public void setAttemptId(long attemptId) { this.attemptId = attemptId; }

    public double getTotalScore() { return totalScore; }
    public void setTotalScore(double totalScore) { this.totalScore = totalScore; }

    public int getMaxScore() { return maxScore; }
    public void setMaxScore(int maxScore) { this.maxScore = maxScore; }

    public double getPercentage() { return percentage; }
    public void setPercentage(double percentage) { this.percentage = percentage; }

    public String getDetailJson() { return detailJson; }
    public void setDetailJson(String detailJson) { this.detailJson = detailJson; }
}
