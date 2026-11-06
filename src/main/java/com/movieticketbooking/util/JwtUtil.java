package com.movieticketbooking.util;

import com.movieticketbooking.model.AuthPrincipal;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;

@Component
public class JwtUtil {
    private final String secret;

    public JwtUtil(@Value("${jwt.secret:}") String secret) {
        this.secret = secret;
    }

    public String createToken(int userId, String role) {
        return Jwts.builder()
                .subject(Integer.toString(userId))
                .claim("role", role)
                .issuedAt(new Date())
                .expiration(Date.from(Instant.now().plusSeconds(2 * 60 * 60)))
                .signWith(signingKey(), Jwts.SIG.HS256)
                .compact();
    }

    public AuthPrincipal verify(String token) {
        Claims claims = Jwts.parser()
                .verifyWith(signingKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();

        int userId;
        try {
            userId = Integer.parseInt(claims.getSubject());
        } catch (NumberFormatException exception) {
            throw new JwtException("Invalid user ID claim.", exception);
        }
        String role = claims.get("role", String.class);
        if (userId <= 0 || !("CUSTOMER".equals(role) || "ADMIN".equals(role))) {
            throw new JwtException("Invalid access token claims.");
        }
        return new AuthPrincipal(userId, role);
    }

    public boolean isConfigured() {
        return secret != null && !secret.isBlank();
    }

    private SecretKey signingKey() {
        if (!isConfigured()) {
            throw new IllegalStateException("JWT_SECRET is not configured.");
        }
        return Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }
}
