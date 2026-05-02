package com.quizexam.repository;

import com.quizexam.model.StudentExamPaper;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface StudentExamPaperRepository extends JpaRepository<StudentExamPaper, Long> {
    List<StudentExamPaper> findAllByStudentIdAndExamIdOrderByIdDesc(long studentId, long examId);
    
    List<StudentExamPaper> findByExamId(long examId);
    
    default void deleteOldDuplicates(long studentId, long examId) {
        List<StudentExamPaper> papers = findAllByStudentIdAndExamIdOrderByIdDesc(studentId, examId);
        if (papers.size() > 1) {
            // Keep the first one (most recent), delete the rest
            deleteAll(papers.subList(1, papers.size()));
        }
    }
}
