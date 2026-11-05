CREATE INDEX IF NOT EXISTS idx_shows_show_date
ON shows (show_date);

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_screen_show_schedule
ON shows (screen_id, show_date, show_time);
