package com.quizexam.model;

import jakarta.persistence.*;
import java.util.ArrayList;
import java.util.List;

@Entity
@DiscriminatorValue("MCQ")
public class MCQ extends Question {

    @Column(name = "correct_index")
    private int correctIndex;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "mcq_options", joinColumns = @JoinColumn(name = "question_id"))
    @OrderColumn(name = "option_index")
    @Column(name = "option_text", nullable = false, columnDefinition = "TEXT")
    private List<String> optionTexts = new ArrayList<>();

    public MCQ() {}

    @Override
    public String getType() { return "MCQ"; }

    @Override
    public String getCorrectAnswerValue() { return String.valueOf(correctIndex); }

    public int getCorrectIndex() { return correctIndex; }
    public void setCorrectIndex(int correctIndex) { this.correctIndex = correctIndex; }

    public List<String> getOptionTexts() { return optionTexts; }
    public void setOptionTexts(List<String> optionTexts) { this.optionTexts = optionTexts; }
}
