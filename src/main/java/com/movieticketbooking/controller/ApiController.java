package com.movieticketbooking.controller;

import com.movieticketbooking.dao.ShowDao;
import com.movieticketbooking.model.AuthPrincipal;
import com.movieticketbooking.service.AuthService;
import com.movieticketbooking.service.BookingService;
import com.movieticketbooking.service.MovieService;
import com.movieticketbooking.service.ReportService;
import com.movieticketbooking.service.ShowService;
import com.movieticketbooking.util.ApiException;
import com.movieticketbooking.config.AuthInterceptor;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import jakarta.servlet.http.HttpServletRequest;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class ApiController {
    private final JdbcTemplate jdbc;
    private final AuthService authService;
    private final MovieService movieService;
    private final ShowService showService;
    private final BookingService bookingService;
    private final ReportService reportService;

    public ApiController(JdbcTemplate jdbc, AuthService authService, MovieService movieService,
                         ShowService showService, BookingService bookingService, ReportService reportService) {
        this.jdbc = jdbc;
        this.authService = authService;
        this.movieService = movieService;
        this.showService = showService;
        this.bookingService = bookingService;
        this.reportService = reportService;
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        try {
            Object dbTime = jdbc.queryForObject("SELECT NOW()", Object.class);
            return ResponseEntity.ok(Map.of("status", "ok", "dbTime", dbTime,
                    "message", "Connected to PostgreSQL database"));
        } catch (DataAccessException exception) {
            String message = exception.getMostSpecificCause() == null
                    ? exception.getMessage() : exception.getMostSpecificCause().getMessage();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("status", "db_offline", "error", message));
        }
    }

    @PostMapping("/auth/register")
    public ResponseEntity<Map<String, Object>> register(@RequestBody Map<String, Object> body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.register(body));
    }

    @PostMapping("/auth/login")
    public Map<String, Object> login(@RequestBody Map<String, Object> body) {
        return authService.login(body);
    }

    @GetMapping("/movies")
    public List<Map<String, Object>> movies() {
        return movieService.findAll();
    }

    @GetMapping("/movies/{id}/dates")
    public List<Object> movieDates(@PathVariable int id) {
        if (id <= 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Movie ID must be a positive integer.");
        }
        return movieService.findAvailableDates(id);
    }

    @PostMapping("/movies")
    public ResponseEntity<Map<String, Object>> createMovie(@RequestBody Map<String, Object> body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(movieService.create(body));
    }

    @PutMapping("/movies/{id}")
    public Map<String, Object> updateMovie(@PathVariable int id, @RequestBody Map<String, Object> body) {
        return movieService.update(id, body);
    }

    @DeleteMapping("/movies/{id}")
    public Map<String, Object> deleteMovie(@PathVariable int id) {
        return movieService.delete(id);
    }

    @GetMapping("/screens")
    public List<Map<String, Object>> screens() {
        return showService.findScreens();
    }

    @GetMapping("/shows")
    public List<Map<String, Object>> shows(@RequestParam(required = false) String date,
                                           @RequestParam(name = "movie_id", required = false) String movieId) {
        return showService.findShows(date, movieId);
    }

    @PostMapping("/shows")
    public ResponseEntity<Map<String, Object>> createShow(@RequestBody Map<String, Object> body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(showService.create(body));
    }

    @GetMapping("/shows/{id}/seats")
    public Map<String, Object> seats(@PathVariable int id) {
        if (id <= 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Show ID must be a positive integer.");
        }
        return showService.seatMap(id);
    }

    @PostMapping("/bookings")
    public ResponseEntity<Map<String, Object>> createBooking(HttpServletRequest request,
                                                              @RequestBody Map<String, Object> body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(bookingService.book(principal(request), body));
    }

    @GetMapping("/bookings/user/{userId}")
    public List<Map<String, Object>> userBookings(HttpServletRequest request, @PathVariable String userId) {
        return bookingService.findUserBookings(principal(request), userId);
    }

    @PostMapping("/bookings/cancel/{id}")
    public Map<String, Object> cancelBooking(HttpServletRequest request, @PathVariable String id) {
        return bookingService.cancel(principal(request), id);
    }

    @GetMapping("/admin/reports")
    public Map<String, Object> reports(@RequestParam(required = false) String from,
                                       @RequestParam(required = false) String to) {
        return reportService.createReport(from, to);
    }

    private AuthPrincipal principal(HttpServletRequest request) {
        Object principal = request.getAttribute(AuthInterceptor.PRINCIPAL_ATTRIBUTE);
        if (!(principal instanceof AuthPrincipal authPrincipal)) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "A valid access token is required.");
        }
        return authPrincipal;
    }
}
