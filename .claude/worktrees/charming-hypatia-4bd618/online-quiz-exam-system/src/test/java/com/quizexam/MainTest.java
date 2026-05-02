package com.quizexam;

import org.h2.jdbcx.JdbcDataSource;
import org.junit.jupiter.api.Test;

import javax.sql.DataSource;
import java.sql.SQLException;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for Main.verifyConnectivity.
 * Requirements 12.2, 12.3
 */
class MainTest {

    private DataSource h2DataSource() {
        JdbcDataSource ds = new JdbcDataSource();
        ds.setURL("jdbc:h2:mem:testdb;DB_CLOSE_DELAY=-1");
        ds.setUser("sa");
        ds.setPassword("");
        return ds;
    }

    @Test
    void verifyConnectivity_succeeds_with_valid_h2_datasource() {
        assertDoesNotThrow(() -> Main.verifyConnectivity(h2DataSource()));
    }

    @Test
    void verifyConnectivity_throws_when_datasource_unavailable() {
        // Use an invalid JDBC URL to simulate a connection failure
        JdbcDataSource ds = new JdbcDataSource();
        ds.setURL("jdbc:h2:tcp://localhost:9999/nonexistent");
        ds.setUser("sa");
        ds.setPassword("");

        assertThrows(SQLException.class, () -> Main.verifyConnectivity(ds));
    }
}
