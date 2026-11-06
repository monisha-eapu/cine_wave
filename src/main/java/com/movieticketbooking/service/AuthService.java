package com.movieticketbooking.service;

import com.movieticketbooking.dao.UserDao;
import com.movieticketbooking.util.ApiException;
import com.movieticketbooking.util.JwtUtil;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

@Service
public class AuthService {
    private final UserDao userDao;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder(12);
    private final JwtUtil jwtUtil;

    public AuthService(UserDao userDao, JwtUtil jwtUtil) {
        this.userDao = userDao;
        this.jwtUtil = jwtUtil;
    }

    public Map<String, Object> register(Map<String, Object> body) {
        String name = text(body, "name");
        String email = text(body, "email");
        String password = text(body, "password");
        if (name == null || email == null || password == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Name, email, and password are required.");
        }
        if (userDao.findByEmail(email).isPresent()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Email address is already registered.");
        }

        Map<String, Object> user = userDao.create(name, email, passwordEncoder.encode(password),
                text(body, "phone") == null ? "" : text(body, "phone"));
        return Map.of("message", "Registration successful", "user", user);
    }

    public Map<String, Object> login(Map<String, Object> body) {
        String email = text(body, "email");
        String password = text(body, "password");
        if (email == null || password == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Please enter both email and password.");
        }
        Map<String, Object> user = userDao.findByEmail(email)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Invalid login credentials."));

        String storedPassword = String.valueOf(user.get("password"));
        boolean valid = storedPassword.startsWith("$2")
                ? passwordEncoder.matches(password, storedPassword)
                : password.equals(storedPassword);
        if (!valid) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Invalid login credentials.");
        }

        String role = String.valueOf(user.get("role"));
        String requestedRole = text(body, "role");
        if (requestedRole != null && !role.equals(requestedRole.toUpperCase(Locale.ROOT))) {
            throw new ApiException(HttpStatus.FORBIDDEN,
                    "Access denied. This account is registered as " + role + ".");
        }
        if (!jwtUtil.isConfigured()) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Server authentication is not configured. Please contact the administrator.");
        }

        Map<String, Object> publicUser = new LinkedHashMap<>(user);
        publicUser.remove("password");
        return Map.of("message", "Login successful", "user", publicUser,
                "token", jwtUtil.createToken(((Number) user.get("user_id")).intValue(), role));
    }

    private String text(Map<String, Object> body, String key) {
        Object value = body.get(key);
        if (value == null || String.valueOf(value).isBlank()) {
            return null;
        }
        return String.valueOf(value);
    }
}
