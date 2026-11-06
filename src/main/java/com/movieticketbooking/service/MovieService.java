package com.movieticketbooking.service;

import com.movieticketbooking.dao.MovieDao;
import com.movieticketbooking.util.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class MovieService {
    private final MovieDao movieDao;

    public MovieService(MovieDao movieDao) {
        this.movieDao = movieDao;
    }

    public List<Map<String, Object>> findAll() {
        return movieDao.findAll();
    }

    public List<Object> findAvailableDates(int movieId) {
        if (!movieDao.exists(movieId)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Movie not found.");
        }
        return movieDao.findAvailableDates(movieId);
    }

    public Map<String, Object> create(Map<String, Object> body) {
        String title = value(body, "title");
        String genre = value(body, "genre");
        String language = value(body, "language");
        Integer duration = integer(body.get("duration_min"));
        if (title == null || genre == null || language == null || duration == null || duration <= 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    "Title, genre, language, and duration are required.");
        }
        Map<String, Object> movie = movieFields(body, title, genre, language, duration);
        return Map.of("message", "Movie added successfully", "movie", movieDao.create(movie));
    }

    public Map<String, Object> update(int movieId, Map<String, Object> body) {
        Integer duration = integer(body.get("duration_min"));
        Map<String, Object> movie = movieFields(
                body, value(body, "title"), value(body, "genre"), value(body, "language"), duration);
        Map<String, Object> updated = movieDao.update(movieId, movie);
        if (updated == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Movie not found.");
        }
        return Map.of("message", "Movie updated successfully", "movie", updated);
    }

    public Map<String, Object> delete(int movieId) {
        movieDao.delete(movieId);
        return Map.of("message", "Movie deleted successfully.");
    }

    private Map<String, Object> movieFields(Map<String, Object> body, String title, String genre,
                                            String language, Integer duration) {
        Map<String, Object> fields = new LinkedHashMap<>();
        fields.put("title", title);
        fields.put("genre", genre);
        fields.put("language", language);
        fields.put("duration_min", duration);
        fields.put("poster_path", value(body, "poster_path") == null ? "" : value(body, "poster_path"));
        fields.put("rating", value(body, "rating") == null ? "PG-13" : value(body, "rating"));
        fields.put("description", value(body, "description") == null ? "" : value(body, "description"));
        return fields;
    }

    private String value(Map<String, Object> body, String key) {
        Object value = body.get(key);
        return value == null || String.valueOf(value).isBlank() ? null : String.valueOf(value);
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
}
