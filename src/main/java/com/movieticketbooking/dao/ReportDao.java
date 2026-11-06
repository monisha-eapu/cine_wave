package com.movieticketbooking.dao;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Repository
public class ReportDao {
    private final JdbcTemplate jdbc;

    public ReportDao(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Map<String, Object> createReport(String from, String to) {
        List<Object> rangeArgs = new ArrayList<>();
        StringBuilder range = new StringBuilder("b.status = 'CONFIRMED'");
        if (from != null) {
            range.append(" AND b.booking_time >= ?::date");
            rangeArgs.add(from);
        }
        if (to != null) {
            range.append(" AND b.booking_time < (?::date + INTERVAL '1 day')");
            rangeArgs.add(to);
        }

        Map<String, Object> summary = jdbc.queryForMap(
                """
                SELECT COALESCE(SUM(b.amount), 0) AS total_revenue,
                       COUNT(*) AS total_tickets_sold,
                       COUNT(DISTINCT b.booking_ref) AS total_orders
                FROM bookings b
                WHERE
                """ + range,
                rangeArgs.toArray());
        Map<String, Object> todayRevenue = jdbc.queryForMap(
                """
                SELECT COALESCE(SUM(amount), 0) AS today_revenue
                FROM bookings
                WHERE status = 'CONFIRMED'
                  AND booking_time >= CURRENT_DATE
                  AND booking_time < CURRENT_DATE + INTERVAL '1 day'
                """);
        Map<String, Object> occupancy = jdbc.queryForMap(
                """
                SELECT COALESCE(
                    100.0 * SUM(CASE WHEN sold.seats_sold > 0 THEN sold.seats_sold ELSE 0 END)
                    / NULLIF(SUM(s.total_seats), 0), 0
                ) AS occupancy_rate
                FROM shows s
                LEFT JOIN (
                    SELECT show_id, COUNT(*) AS seats_sold
                    FROM bookings
                    WHERE status = 'CONFIRMED'
                    GROUP BY show_id
                ) sold ON sold.show_id = s.show_id
                WHERE (s.show_date + s.show_time) > CURRENT_TIMESTAMP
                """);
        summary.put("today_revenue", todayRevenue.get("today_revenue"));
        summary.put("occupancy_rate", occupancy.get("occupancy_rate"));

        List<Map<String, Object>> movieSales = jdbc.queryForList(
                """
                SELECT m.title, m.genre,
                       COUNT(b.booking_id) AS tickets_sold,
                       COALESCE(SUM(b.amount), 0) AS revenue
                FROM movies m
                LEFT JOIN shows s ON m.movie_id = s.movie_id
                LEFT JOIN bookings b ON s.show_id = b.show_id AND
                """ + range + """
                GROUP BY m.movie_id, m.title, m.genre
                ORDER BY revenue DESC
                """,
                rangeArgs.toArray());
        List<Map<String, Object>> categorySales = jdbc.queryForList(
                """
                SELECT st.category,
                       COUNT(b.booking_id) AS tickets_sold,
                       COALESCE(SUM(b.amount), 0) AS revenue
                FROM seats st
                JOIN bookings b ON st.seat_id = b.seat_id AND
                """ + range + """
                GROUP BY st.category
                ORDER BY CASE st.category
                    WHEN 'SILVER' THEN 1 WHEN 'GOLD' THEN 2 WHEN 'PLATINUM' THEN 3 ELSE 4 END
                """,
                rangeArgs.toArray());
        List<Map<String, Object>> dailyRevenue = jdbc.queryForList(
                """
                WITH bounds AS (
                    SELECT COALESCE(?::date, CURRENT_DATE - INTERVAL '29 days')::date AS start_date,
                           COALESCE(?::date, CURRENT_DATE)::date AS end_date
                ),
                days AS (
                    SELECT generate_series(start_date, end_date, INTERVAL '1 day')::date AS report_date
                    FROM bounds
                )
                SELECT days.report_date, COALESCE(SUM(b.amount), 0) AS revenue
                FROM days
                LEFT JOIN bookings b
                  ON b.status = 'CONFIRMED'
                 AND b.booking_time >= days.report_date
                 AND b.booking_time < days.report_date + INTERVAL '1 day'
                GROUP BY days.report_date
                ORDER BY days.report_date
                """,
                from, to);
        List<Map<String, Object>> upcomingShows = jdbc.queryForList(
                """
                SELECT s.show_id, s.show_date, s.show_time, m.title AS movie_title,
                       sc.theatre_name, sc.screen_name, sc.total_seats,
                       COUNT(b.booking_id) AS seats_sold
                FROM shows s
                JOIN movies m ON m.movie_id = s.movie_id
                JOIN screens sc ON sc.screen_id = s.screen_id
                LEFT JOIN bookings b ON b.show_id = s.show_id AND b.status = 'CONFIRMED'
                WHERE (s.show_date + s.show_time) > CURRENT_TIMESTAMP
                GROUP BY s.show_id, s.show_date, s.show_time, m.title,
                         sc.theatre_name, sc.screen_name, sc.total_seats
                ORDER BY s.show_date, s.show_time
                LIMIT 50
                """);

        return Map.of(
                "summary", summary,
                "movieSales", movieSales,
                "categorySales", categorySales,
                "dailyRevenue", dailyRevenue,
                "upcomingShows", upcomingShows);
    }
}
