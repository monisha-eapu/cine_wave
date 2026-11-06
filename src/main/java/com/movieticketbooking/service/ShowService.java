package com.movieticketbooking.service;

import com.movieticketbooking.dao.ShowDao;
import com.movieticketbooking.util.ApiException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class ShowService {
    private static final Set<String> CATEGORIES = Set.of("SILVER", "GOLD", "PLATINUM");
    private final ShowDao showDao;

    public ShowService(ShowDao showDao) {
        this.showDao = showDao;
    }

    public List<Map<String, Object>> findScreens() {
        return showDao.findScreens();
    }

    public List<Map<String, Object>> findShows(String date, String movieIdValue) {
        Integer movieId = null;
        if (date != null && !isValidDate(date)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Date must be a valid date in YYYY-MM-DD format.");
        }
        if (movieIdValue != null) {
            try {
                movieId = Integer.valueOf(movieIdValue);
            } catch (NumberFormatException exception) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Movie ID must be a positive integer.");
            }
            if (movieId <= 0 || !movieIdValue.matches("\\d+")) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Movie ID must be a positive integer.");
            }
        }
        return showDao.findShows(date, movieId);
    }

    public Map<String, Object> create(Map<String, Object> body) {
        Integer movieId = integer(body.get("movie_id"));
        Integer screenId = integer(body.get("screen_id"));
        String showDate = text(body.get("show_date"));
        String showTime = text(body.get("show_time"));
        if (movieId == null || screenId == null || movieId <= 0 || screenId <= 0
                || showDate == null || showTime == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Movie, screen, date, and time are required.");
        }
        if (!isValidDate(showDate) || !showTime.matches("^(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d)?$")) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Please provide a valid show date and time.");
        }
        LocalTime time = LocalTime.parse(showTime);
        if (!LocalDateTime.of(LocalDate.parse(showDate), time).isAfter(LocalDateTime.now())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "A show cannot be scheduled in the past.");
        }
        if (showDao.hasScheduleConflict(screenId, showDate, showTime)) {
            throw new ApiException(HttpStatus.CONFLICT,
                    "This screen already has a show scheduled at that date and time.");
        }

        Map<String, Object> show = new LinkedHashMap<>();
        show.put("movie_id", movieId);
        show.put("screen_id", screenId);
        show.put("show_date", showDate);
        show.put("show_time", showTime);
        show.put("price_silver", price(body.get("price_silver"), "10.00"));
        show.put("price_gold", price(body.get("price_gold"), "15.00"));
        show.put("price_platinum", price(body.get("price_platinum"), "22.00"));
        try {
            return Map.of("message", "Show created successfully", "show", showDao.create(show));
        } catch (DuplicateKeyException exception) {
            throw new ApiException(HttpStatus.CONFLICT,
                    "This screen already has a show scheduled at that date and time.");
        }
    }

    public Map<String, Object> seatMap(int showId) {
        Map<String, Object> show = showDao.findShowDetails(showId);
        if (show == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Show not found.");
        }
        int screenId = ((Number) show.get("screen_id")).intValue();
        Set<Integer> bookedIds = showDao.findConfirmedSeatIds(showId);
        List<Map<String, Object>> seats = new ArrayList<>();
        for (Map<String, Object> seat : showDao.findSeats(screenId)) {
            Map<String, Object> item = new LinkedHashMap<>(seat);
            item.put("is_booked", bookedIds.contains(((Number) seat.get("seat_id")).intValue()));
            seats.add(item);
        }
        return Map.of("show", show, "seats", seats);
    }

    private boolean isValidDate(String value) {
        if (!value.matches("^\\d{4}-\\d{2}-\\d{2}$")) {
            return false;
        }
        try {
            LocalDate.parse(value);
            return true;
        } catch (DateTimeParseException exception) {
            return false;
        }
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

    private String text(Object value) {
        return value == null || String.valueOf(value).isBlank() ? null : String.valueOf(value);
    }

    private String price(Object value, String fallback) {
        if (value == null || String.valueOf(value).isBlank()) {
            return fallback;
        }
        try {
            if (new java.math.BigDecimal(String.valueOf(value)).signum() <= 0) {
                return fallback;
            }
            return String.valueOf(value);
        } catch (NumberFormatException exception) {
            return fallback;
        }
    }
}
