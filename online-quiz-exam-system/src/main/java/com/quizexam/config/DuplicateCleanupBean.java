package com.quizexam.config;

import jakarta.persistence.EntityManager;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class DuplicateCleanupBean {

    private final EntityManager entityManager;

    public DuplicateCleanupBean(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void cleanupDuplicates() {
        try {
            // Use a temporary table workaround for MySQL's self-reference restrictions
            // Create temp table with IDs to keep
            entityManager.createNativeQuery(
                "CREATE TEMPORARY TABLE temp_keep_ids AS " +
                "SELECT MAX(id) as id FROM student_exam_papers GROUP BY student_id, exam_id"
            ).executeUpdate();

            // Delete duplicates
            entityManager.createNativeQuery(
                "DELETE FROM student_exam_papers WHERE id NOT IN (SELECT id FROM temp_keep_ids)"
            ).executeUpdate();

            // Clean up temp table
            entityManager.createNativeQuery("DROP TEMPORARY TABLE temp_keep_ids").executeUpdate();

            // Repeat for attempts
            entityManager.createNativeQuery(
                "CREATE TEMPORARY TABLE temp_keep_ids_attempts AS " +
                "SELECT MAX(id) as id FROM attempts GROUP BY student_id, exam_id"
            ).executeUpdate();

            entityManager.createNativeQuery(
                "DELETE FROM attempts WHERE id NOT IN (SELECT id FROM temp_keep_ids_attempts)"
            ).executeUpdate();

            entityManager.createNativeQuery("DROP TEMPORARY TABLE temp_keep_ids_attempts").executeUpdate();

            entityManager.flush();
        } catch (Exception e) {
            // Log but don't fail startup if cleanup has issues - will be handled at runtime
            System.err.println("Note: Duplicate cleanup at startup failed (will be handled at runtime): " + e.getMessage());
        }
    }
}
