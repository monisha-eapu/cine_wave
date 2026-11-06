package com.movieticketbooking.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;

import javax.sql.DataSource;
import java.net.URI;

@Configuration
public class DatabaseConfig {
    @Bean
    public DataSource dataSource(Environment environment) {
        String url = environment.getProperty("DATABASE_URL");
        if (url == null || url.isBlank()) {
            String host = environment.getProperty("PGHOST", "localhost");
            String port = environment.getProperty("PGPORT", "5432");
            String database = environment.getProperty("PGDATABASE", "movie_ticket_booking");
            url = "jdbc:postgresql://" + host + ":" + port + "/" + database;
        } else if (url.startsWith("postgres://")) {
            url = "jdbc:postgresql://" + url.substring("postgres://".length());
        } else if (url.startsWith("postgresql://")) {
            url = "jdbc:postgresql://" + url.substring("postgresql://".length());
        }

        if (!url.startsWith("jdbc:postgresql://")) {
            throw new IllegalArgumentException(
                    "DATABASE_URL must use PostgreSQL format (postgresql:// or jdbc:postgresql://).");
        }

        String databaseUrl = environment.getProperty("DATABASE_URL");
        String username = environment.getProperty("PGUSER", "postgres");
        String password = environment.getProperty("PGPASSWORD", "");
        if (databaseUrl != null && !databaseUrl.isBlank()) {
            String userInfo = URI.create(url.substring("jdbc:".length())).getUserInfo();
            if (userInfo != null) {
                String[] credentials = userInfo.split(":", 2);
                username = credentials[0];
                password = credentials.length == 2 ? credentials[1] : "";
            }
        }

        HikariConfig config = new HikariConfig();
        config.setJdbcUrl(url);
        config.setUsername(username);
        config.setPassword(password);
        config.setConnectionTimeout(2_000);
        config.setInitializationFailTimeout(-1);
        return new HikariDataSource(config);
    }
}
