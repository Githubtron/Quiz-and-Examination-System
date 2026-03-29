package com.quizexam;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import javax.sql.DataSource;
import java.sql.SQLException;

@SpringBootApplication
public class Main {
    public static void main(String[] args) {
        SpringApplication.run(Main.class, args);
    }

    /**
     * Verifies that a DataSource can establish a database connection.
     * Throws SQLException if connection fails.
     */
    public static void verifyConnectivity(DataSource dataSource) throws SQLException {
        try (var connection = dataSource.getConnection()) {
            if (connection.isValid(2)) {
                System.out.println("Database connectivity verified");
            } else {
                throw new SQLException("Database connection validation failed");
            }
        }
    }
}
