package com.movieticketbooking.dao;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Repository
public class ShowDao {
    private final JdbcTemplate jdbc;

    public ShowDao(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<Map<String, Object>> findScreens() {
        return jdbc.queryForList("SELECT * FROM screens ORDER BY screen_id");
    }

    public List<Map<String, Object>> findShows(String date, Integer movieId) {
        StringBuilder sql = new StringBuilder("""
                SELECT s.show_id, s.show_date, s.show_time, s.price_silver, s.price_gold, s.price_platinum,
                       m.movie_id, m.title AS movie_title, m.genre, m.language, m.duration_min, m.poster_path, m.rating,
                       sc.screen_id, sc.theatre_name, sc.screen_name, sc.total_seats
                FROM shows s
                JOIN movies m ON s.movie_id = m.movie_id
                JOIN screens sc ON s.screen_id = sc.screen_id
                """);
        List<Object> args = new ArrayList<>();
        if (date != null || movieId != null) {
            sql.append(" WHERE ");
            if (date != null) {
                sql.append("s.show_date = ?::date");
                args.add(date);
            }
            if (date != null && movieId != null) {
                sql.append(" AND ");
            }
            if (movieId != null) {
                sql.append("s.movie_id = ?");
                args.add(movieId);
            }
        }
        sql.append(" ORDER BY s.show_date ASC, s.show_time ASC");
        return jdbc.queryForList(sql.toString(), args.toArray());
    }

    public Map<String, Object> findShowDetails(int showId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                """
                SELECT s.*, m.title AS movie_title, m.poster_path, m.genre, m.language,
                       sc.screen_id, sc.theatre_name, sc.screen_name, sc.total_seats
                FROM shows s
                JOIN movies m ON s.movie_id = m.movie_id
                JOIN screens sc ON s.screen_id = sc.screen_id
                WHERE s.show_id = ?
                """,
                showId);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public List<Map<String, Object>> findSeats(int screenId) {
        return jdbc.queryForList(
                "SELECT seat_id, screen_id, seat_number, category FROM seats WHERE screen_id = ? ORDER BY seat_number",
                screenId);
    }

    public Set<Integer> findConfirmedSeatIds(int showId) {
        List<Integer> ids = jdbc.queryForList(
                "SELECT seat_id FROM bookings WHERE show_id = ? AND status = 'CONFIRMED'",
                Integer.class, showId);
        return new HashSet<>(ids);
    }

    public Map<String, Object> create(Map<String, Object> show) {
        return jdbc.queryForMap(
                """
                INSERT INTO shows (movie_id, screen_id, show_date, show_time, price_silver, price_gold, price_platinum)
                VALUES (?, ?, ?::date, ?::time, ?, ?, ?)
                RETURNING *
                """,
                show.get("movie_id"), show.get("screen_id"), show.get("show_date"), show.get("show_time"),
                show.get("price_silver"), show.get("price_gold"), show.get("price_platinum"));
    }

    public boolean hasScheduleConflict(int screenId, String showDate, String showTime) {
        return Boolean.TRUE.equals(jdbc.queryForObject(
                """
                SELECT EXISTS(
                    SELECT 1 FROM shows
                    WHERE screen_id = ? AND show_date = ?::date AND show_time = ?::time
                )
                """,
                Boolean.class, screenId, showDate, showTime));
    }
}
