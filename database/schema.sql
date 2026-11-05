-- ==============================================================================
-- Movie Ticket Booking System - PostgreSQL Schema Specification
-- Prepared for: Monisha (Centurion University) - Version 1.0
-- Companion to SRS & System Design Document (SDD)
-- ==============================================================================

-- Drop existing tables if re-initializing
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS seats CASCADE;
DROP TABLE IF EXISTS shows CASCADE;
DROP TABLE IF EXISTS screens CASCADE;
DROP TABLE IF EXISTS movies CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 1. Table: users
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    phone VARCHAR(15),
    role VARCHAR(20) NOT NULL DEFAULT 'CUSTOMER' CHECK (role IN ('CUSTOMER', 'ADMIN')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Table: movies
CREATE TABLE movies (
    movie_id SERIAL PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    genre VARCHAR(50) NOT NULL,
    language VARCHAR(30) NOT NULL,
    duration_min INT NOT NULL,
    poster_path TEXT,
    rating VARCHAR(10) DEFAULT 'PG-13',
    description TEXT
);

-- 3. Table: screens
CREATE TABLE screens (
    screen_id SERIAL PRIMARY KEY,
    theatre_name VARCHAR(100) NOT NULL DEFAULT 'CineWave Theatre',
    screen_name VARCHAR(50) NOT NULL,
    total_seats INT NOT NULL
);

-- 4. Table: shows
CREATE TABLE shows (
    show_id SERIAL PRIMARY KEY,
    movie_id INT NOT NULL REFERENCES movies(movie_id) ON DELETE CASCADE,
    screen_id INT NOT NULL REFERENCES screens(screen_id) ON DELETE CASCADE,
    show_date DATE NOT NULL,
    show_time TIME NOT NULL,
    price_silver NUMERIC(6,2) NOT NULL DEFAULT 10.00,
    price_gold NUMERIC(6,2) NOT NULL DEFAULT 15.00,
    price_platinum NUMERIC(6,2) NOT NULL DEFAULT 22.00
);

-- 5. Table: seats
CREATE TABLE seats (
    seat_id SERIAL PRIMARY KEY,
    screen_id INT NOT NULL REFERENCES screens(screen_id) ON DELETE CASCADE,
    seat_number VARCHAR(10) NOT NULL,
    category VARCHAR(20) NOT NULL CHECK (category IN ('SILVER', 'GOLD', 'PLATINUM')),
    CONSTRAINT unique_screen_seat UNIQUE (screen_id, seat_number)
);

-- 6. Table: bookings
CREATE TABLE bookings (
    booking_id SERIAL PRIMARY KEY,
    booking_ref VARCHAR(20) NOT NULL,
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    show_id INT NOT NULL REFERENCES shows(show_id) ON DELETE CASCADE,
    seat_id INT NOT NULL REFERENCES seats(seat_id) ON DELETE CASCADE,
    booking_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    amount NUMERIC(6,2) NOT NULL,
    payment_method VARCHAR(20) NOT NULL DEFAULT 'UPI' CHECK (payment_method IN ('UPI', 'CARD', 'NET_BANKING', 'CASH')),
    status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN ('CONFIRMED', 'CANCELLED'))
);

-- Double-booking prevention index (NFR-3: Reliability requirement)
-- Guarantees a seat cannot be double-booked for the same show while status is CONFIRMED
CREATE UNIQUE INDEX idx_no_double_booking 
ON bookings (show_id, seat_id) 
WHERE status = 'CONFIRMED';

-- Indexes for optimal query performance
CREATE INDEX idx_shows_movie_date ON shows(movie_id, show_date);
CREATE INDEX idx_bookings_user ON bookings(user_id);
CREATE INDEX idx_bookings_show ON bookings(show_id);
