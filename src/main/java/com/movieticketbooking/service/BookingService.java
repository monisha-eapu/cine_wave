package com.movieticketbooking.service;

import com.movieticketbooking.dao.BookingDao;
import com.movieticketbooking.model.AuthPrincipal;
import com.movieticketbooking.util.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class BookingService {
    private static final Set<String> PAYMENT_METHODS = Set.of("UPI", "CARD", "NET_BANKING", "CASH");
    private static final SecureRandom RANDOM = new SecureRandom();
    private final BookingDao bookingDao;

    public BookingService(BookingDao bookingDao) {
        this.bookingDao = bookingDao;
    }

    public Map<String, Object> book(AuthPrincipal principal, Map<String, Object> body) {
        Integer showId = integer(body.get("show_id"));
        List<Integer> seatIds = integers(body.get("seat_ids"));
        String paymentMethod = body.get("payment_method") == null
                ? null : String.valueOf(body.get("payment_method"));
        if (showId == null || showId <= 0 || seatIds == null || seatIds.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Show ID and at least one seat are required.");
        }
        if (!PAYMENT_METHODS.contains(paymentMethod)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Please select a valid payment method.");
        }

        String bookingRef = "BK-" + (100_000 + RANDOM.nextInt(900_000));
        Map<String, Object> result = bookingDao.book(
                principal.userId(), showId, seatIds, paymentMethod, bookingRef);
        if (result.containsKey("error")) {
            throw new ApiException(HttpStatus.valueOf(((Number) result.get("status")).intValue()),
                    String.valueOf(result.get("error")));
        }
        Map<String, Object> response = new LinkedHashMap<>(result);
        response.put("message", "Booking confirmed successfully!");
        return response;
    }

    public List<Map<String, Object>> findUserBookings(AuthPrincipal principal, String userIdValue) {
        Integer userId = integer(userIdValue);
        if (userId == null || userId <= 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "User ID must be a positive integer.");
        }
        if (!"ADMIN".equals(principal.role()) && userId != principal.userId()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "You can only view your own bookings.");
        }
        return bookingDao.findUserBookings(userId);
    }

    public Map<String, Object> cancel(AuthPrincipal principal, String bookingIdValue) {
        Integer bookingId = integer(bookingIdValue);
        if (bookingId == null || bookingId <= 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Booking ID must be a positive integer.");
        }
        Map<String, Object> result = bookingDao.cancel(
                bookingId, principal.userId(), "ADMIN".equals(principal.role()));
        if (result.containsKey("error")) {
            throw new ApiException(HttpStatus.valueOf(((Number) result.get("status")).intValue()),
                    String.valueOf(result.get("error")));
        }
        return result;
    }

    private Integer integer(Object value) {
        if (value == null) {
            return null;
        }
        try {
            return Integer.valueOf(String.valueOf(value));
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private List<Integer> integers(Object value) {
        if (!(value instanceof List<?> values)) {
            return null;
        }
        List<Integer> result = new ArrayList<>();
        for (Object item : values) {
            Integer id = integer(item);
            if (id == null || id <= 0) {
                return null;
            }
            result.add(id);
        }
        return result;
    }
}
