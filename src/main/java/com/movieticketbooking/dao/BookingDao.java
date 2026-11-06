package com.movieticketbooking.dao;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Repository
public class BookingDao {
    private final JdbcTemplate jdbc;

    public BookingDao(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional
    public Map<String, Object> book(int userId, int showId, List<Integer> seatIds, String paymentMethod,
                                    String bookingRef) {
        List<Map<String, Object>> showRows = jdbc.queryForList(
                """
                SELECT *, (show_date + show_time) <= CURRENT_TIMESTAMP AS has_started
                FROM shows WHERE show_id = ? FOR UPDATE
                """,
                showId);
        if (showRows.isEmpty()) {
            return Map.of("error", "Selected show was not found.", "status", 404);
        }
        Map<String, Object> show = showRows.get(0);
        if (Boolean.TRUE.equals(show.get("has_started"))) {
            return Map.of("error", "This show has already started and can no longer be booked.", "status", 400);
        }

        String placeholders = String.join(",", java.util.Collections.nCopies(seatIds.size(), "?"));
        List<Object> queryArgs = new ArrayList<>();
        queryArgs.add(showId);
        queryArgs.addAll(seatIds);
        List<Integer> alreadyBooked = jdbc.queryForList(
                "SELECT seat_id FROM bookings WHERE show_id = ? AND seat_id IN (" + placeholders + ") AND status = 'CONFIRMED'",
                Integer.class, queryArgs.toArray());
        if (!alreadyBooked.isEmpty()) {
            return Map.of("error", "One or more selected seats were just booked by another customer. Please choose alternative seats.",
                    "status", 409);
        }

        List<Object> seatArgs = new ArrayList<>(seatIds);
        seatArgs.add(show.get("screen_id"));
        List<Map<String, Object>> seats = jdbc.queryForList(
                "SELECT seat_id, seat_number, category FROM seats WHERE seat_id IN (" + placeholders + ") AND screen_id = ?",
                seatArgs.toArray());
        if (seats.size() != seatIds.size()) {
            return Map.of("error", "One or more selected seats are invalid for this show.", "status", 400);
        }

        BigDecimal totalAmount = BigDecimal.ZERO;
        List<Map<String, Object>> createdBookings = new ArrayList<>();
        for (Map<String, Object> seat : seats) {
            String category = String.valueOf(seat.get("category"));
            BigDecimal price = (BigDecimal) show.get(switch (category) {
                case "GOLD" -> "price_gold";
                case "PLATINUM" -> "price_platinum";
                default -> "price_silver";
            });
            totalAmount = totalAmount.add(price);
            createdBookings.add(jdbc.queryForMap(
                    """
                    INSERT INTO bookings (booking_ref, user_id, show_id, seat_id, amount, payment_method, status)
                    VALUES (?, ?, ?, ?, ?, ?, 'CONFIRMED')
                    RETURNING booking_id, booking_ref, seat_id, amount, payment_method, booking_time
                    """,
                    bookingRef, userId, showId, seat.get("seat_id"), price, paymentMethod));
        }

        return Map.of(
                "bookingRef", bookingRef,
                "totalAmount", totalAmount,
                "seatsCount", createdBookings.size(),
                "show_date", show.get("show_date"),
                "show_time", show.get("show_time"),
                "bookings", createdBookings);
    }

    public List<Map<String, Object>> findUserBookings(int userId) {
        return jdbc.queryForList(
                """
                SELECT b.booking_id, b.booking_ref, b.booking_time, b.amount, b.payment_method, b.status,
                       s.show_date, s.show_time, m.title AS movie_title, m.poster_path, m.language, m.genre,
                       sc.theatre_name, sc.screen_name, st.seat_number, st.category AS seat_category
                FROM bookings b
                JOIN shows s ON b.show_id = s.show_id
                JOIN movies m ON s.movie_id = m.movie_id
                JOIN screens sc ON s.screen_id = sc.screen_id
                JOIN seats st ON b.seat_id = st.seat_id
                WHERE b.user_id = ?
                ORDER BY b.booking_time DESC
                """,
                userId);
    }

    @Transactional
    public Map<String, Object> cancel(int bookingId, int userId, boolean isAdmin) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                """
                SELECT b.booking_id, b.booking_ref, b.status, b.user_id,
                       (s.show_date + s.show_time - CURRENT_TIMESTAMP) < INTERVAL '2 hours' AS cancellation_blocked
                FROM bookings b
                JOIN shows s ON s.show_id = b.show_id
                WHERE b.booking_id = ? AND (? OR b.user_id = ?)
                FOR UPDATE OF b, s
                """,
                bookingId, isAdmin, userId);
        if (rows.isEmpty()) {
            return Map.of("error", "Booking not found.", "status", 404);
        }

        Map<String, Object> booking = rows.get(0);
        if ("CANCELLED".equals(booking.get("status"))) {
            return Map.of("error", "This booking has already been cancelled.", "status", 400);
        }
        if (Boolean.TRUE.equals(booking.get("cancellation_blocked"))) {
            return Map.of("error", "Bookings cannot be cancelled within 2 hours of the show start time.", "status", 400);
        }

        String bookingRef = String.valueOf(booking.get("booking_ref"));
        jdbc.update("UPDATE bookings SET status = 'CANCELLED' WHERE booking_ref = ? AND status = 'CONFIRMED'",
                bookingRef);
        return Map.of("message", "Booking cancelled successfully. Seats have been released.",
                "bookingRef", bookingRef);
    }
}
