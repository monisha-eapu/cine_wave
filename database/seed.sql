-- ==============================================================================
-- Movie Ticket Booking System - PostgreSQL Seed Data Script
-- ==============================================================================

-- 1. Insert Blockbuster Movies
INSERT INTO movies (title, genre, language, duration_min, poster_path, rating, description) VALUES
(
  'Oppenheimer', 
  'Biography / Drama', 
  'English', 
  180, 
  'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=600&q=80', 
  'R', 
  'The story of American scientist J. Robert Oppenheimer and his role in the development of the atomic bomb.'
),
(
  'Dune: Part Two', 
  'Sci-Fi / Action', 
  'English', 
  166, 
  'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&q=80', 
  'PG-13', 
  'Paul Atreides unites with Chani and the Fremen while seeking revenge against the conspirators who destroyed his family.'
),
(
  'Avatar: The Way of Water', 
  'Sci-Fi / Adventure', 
  'English', 
  192, 
  'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=600&q=80', 
  'PG-13', 
  'Jake Sully lives with his newfound family formed on the extrasolar moon Pandora once a familiar threat returns.'
),
(
  'Interstellar', 
  'Sci-Fi / Drama', 
  'English', 
  169, 
  'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=600&q=80', 
  'PG-13', 
  'When Earth becomes uninhabitable, a team of explorers undertakes the most important mission in human history.'
);

-- 2. Insert Theatres and Screens
INSERT INTO screens (theatre_name, screen_name, total_seats) VALUES
('CineWave Grand Theatre', 'Screen 1 (IMAX 70mm)', 50),
('CineWave Grand Theatre', 'Screen 2 (Dolby Cinema)', 50);

-- 3. Generate Seats for Screen 1 and Screen 2 (5 rows x 10 cols = 50 seats per screen)
-- Rows A & B: Silver ($10), Rows C & D: Gold ($15), Row E: Platinum ($22)
DO $$
DECLARE
    s_id INT;
    r_char TEXT;
    r_idx INT;
    c_idx INT;
    cat TEXT;
    seat_str TEXT;
BEGIN
    FOR s_id IN 1..2 LOOP
        FOR r_idx IN 1..5 LOOP
            CASE r_idx
                WHEN 1 THEN r_char := 'A'; cat := 'SILVER';
                WHEN 2 THEN r_char := 'B'; cat := 'SILVER';
                WHEN 3 THEN r_char := 'C'; cat := 'GOLD';
                WHEN 4 THEN r_char := 'D'; cat := 'GOLD';
                WHEN 5 THEN r_char := 'E'; cat := 'PLATINUM';
            END CASE;
            
            FOR c_idx IN 1..10 LOOP
                seat_str := r_char || c_idx;
                INSERT INTO seats (screen_id, seat_number, category) 
                VALUES (s_id, seat_str, cat)
                ON CONFLICT (screen_id, seat_number) DO NOTHING;
            END FOR;
        END FOR;
    END LOOP;
END $$;

-- 4. Insert Shows for Movies
INSERT INTO shows (movie_id, screen_id, show_date, show_time, price_silver, price_gold, price_platinum) VALUES
(1, 1, CURRENT_DATE + 0, '10:00:00', 12.00, 18.00, 25.00),
(1, 1, CURRENT_DATE + 1, '14:30:00', 12.00, 18.00, 25.00),
(1, 1, CURRENT_DATE + 2, '19:00:00', 15.00, 22.00, 30.00),
(2, 2, CURRENT_DATE + 3, '11:15:00', 10.00, 15.00, 22.00),
(2, 2, CURRENT_DATE + 4, '16:00:00', 10.00, 15.00, 22.00),
(2, 2, CURRENT_DATE + 5, '20:30:00', 14.00, 20.00, 28.00),
(3, 1, CURRENT_DATE + 6, '13:00:00', 11.00, 16.00, 24.00),
(4, 2, CURRENT_DATE + 0, '18:15:00', 12.00, 17.00, 25.00);
