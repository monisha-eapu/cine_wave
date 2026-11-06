package com.movieticketbooking.dao;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@Repository
public class UserDao {
    private final JdbcTemplate jdbc;

    public UserDao(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<Map<String, Object>> findByEmail(String email) {
        List<Map<String, Object>> users = jdbc.queryForList(
                "SELECT user_id, name, email, password, phone, role FROM users WHERE email = ?",
                email);
        return users.stream().findFirst();
    }

    public Map<String, Object> create(String name, String email, String passwordHash, String phone) {
        return jdbc.queryForMap(
                """
                INSERT INTO users (name, email, password, phone, role)
                VALUES (?, ?, ?, ?, 'CUSTOMER')
                RETURNING user_id, name, email, phone, role
                """,
                name, email, passwordHash, phone);
    }
}
