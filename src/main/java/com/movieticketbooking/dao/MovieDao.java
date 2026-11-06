package com.movieticketbooking.dao;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Repository
public class MovieDao {
    private final JdbcTemplate jdbc;

    public MovieDao(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<Map<String, Object>> findAll() {
        return jdbc.queryForList("SELECT * FROM movies ORDER BY movie_id DESC");
    }

    public boolean exists(int movieId) {
        return Boolean.TRUE.equals(jdbc.queryForObject(
                "SELECT EXISTS(SELECT 1 FROM movies WHERE movie_id = ?)", Boolean.class, movieId));
    }

    public List<Object> findAvailableDates(int movieId) {
        return new ArrayList<>(jdbc.queryForList(
                """
                SELECT DISTINCT show_date
                FROM shows
                WHERE movie_id = ? AND show_date >= CURRENT_DATE
                ORDER BY show_date
                """,
                Object.class, movieId));
    }

    public Map<String, Object> create(Map<String, Object> movie) {
        return jdbc.queryForMap(
                """
                INSERT INTO movies (title, genre, language, duration_min, poster_path, rating, description)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                RETURNING *
                """,
                movie.get("title"), movie.get("genre"), movie.get("language"), movie.get("duration_min"),
                movie.get("poster_path"), movie.get("rating"), movie.get("description"));
    }

    public Map<String, Object> update(int movieId, Map<String, Object> movie) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                """
                UPDATE movies
                SET title = ?, genre = ?, language = ?, duration_min = ?, poster_path = ?, rating = ?, description = ?
                WHERE movie_id = ?
                RETURNING *
                """,
                movie.get("title"), movie.get("genre"), movie.get("language"), movie.get("duration_min"),
                movie.get("poster_path"), movie.get("rating"), movie.get("description"), movieId);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public void delete(int movieId) {
        jdbc.update("DELETE FROM movies WHERE movie_id = ?", movieId);
    }
}
