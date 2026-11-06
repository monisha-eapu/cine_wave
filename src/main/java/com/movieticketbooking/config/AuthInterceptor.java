package com.movieticketbooking.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.movieticketbooking.model.AuthPrincipal;
import com.movieticketbooking.util.JwtUtil;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.io.IOException;
import java.util.Map;
import java.util.regex.Pattern;

@Component
public class AuthInterceptor implements HandlerInterceptor {
    public static final String PRINCIPAL_ATTRIBUTE = AuthPrincipal.class.getName();
    private static final Pattern ADMIN_MOVIE_PATH = Pattern.compile("^/api/movies/\\d+$");
    private static final Pattern USER_BOOKING_PATH = Pattern.compile("^/api/bookings/user/[^/]+$");
    private static final Pattern CANCEL_BOOKING_PATH = Pattern.compile("^/api/bookings/cancel/[^/]+$");

    private final JwtUtil jwtUtil;
    private final ObjectMapper objectMapper;

    public AuthInterceptor(JwtUtil jwtUtil, ObjectMapper objectMapper) {
        this.jwtUtil = jwtUtil;
        this.objectMapper = objectMapper;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)
            throws IOException {
        String method = request.getMethod();
        String path = request.getRequestURI();
        boolean adminOnly = ("POST".equals(method) && ("/api/movies".equals(path) || "/api/shows".equals(path)))
                || (("PUT".equals(method) || "DELETE".equals(method)) && ADMIN_MOVIE_PATH.matcher(path).matches())
                || ("GET".equals(method) && "/api/admin/reports".equals(path));
        boolean protectedPath = adminOnly
                || ("POST".equals(method) && ("/api/bookings".equals(path) || CANCEL_BOOKING_PATH.matcher(path).matches()))
                || ("GET".equals(method) && USER_BOOKING_PATH.matcher(path).matches());
        if (!protectedPath) {
            return true;
        }

        if (!jwtUtil.isConfigured()) {
            writeError(response, 500, "JWT_SECRET is not configured on the server.");
            return false;
        }

        String authorization = request.getHeader("Authorization");
        if (authorization == null || !authorization.startsWith("Bearer ")
                || authorization.substring(7).isBlank() || authorization.substring(7).contains(" ")) {
            writeError(response, 401, "A valid access token is required.");
            return false;
        }

        AuthPrincipal principal;
        try {
            principal = jwtUtil.verify(authorization.substring(7));
        } catch (JwtException | IllegalArgumentException exception) {
            writeError(response, 401, "The access token is invalid or has expired. Please sign in again.");
            return false;
        } catch (IllegalStateException exception) {
            writeError(response, 500, "JWT_SECRET is not configured on the server.");
            return false;
        }

        if (adminOnly && !"ADMIN".equals(principal.role())) {
            writeError(response, 403, "Admin access is required for this resource.");
            return false;
        }
        request.setAttribute(PRINCIPAL_ATTRIBUTE, principal);
        return true;
    }

    private void writeError(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        objectMapper.writeValue(response.getOutputStream(), Map.of("error", message));
    }
}
