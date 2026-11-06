const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function getJwtSecret() {
  return process.env.JWT_SECRET;
}

function requireAuth(req, res, next) {
  const secret = getJwtSecret();
  if (!secret) {
    return res.status(500).json({ error: 'JWT_SECRET is not configured on the server.' });
  }

  const authorization = req.get('authorization') || '';
  const [scheme, token] = authorization.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'A valid access token is required.' });
  }

  try {
    const claims = jwt.verify(token, secret);
    const userId = Number(claims.sub);
    if (!Number.isInteger(userId) || userId <= 0 || !claims.role) {
      return res.status(401).json({ error: 'The access token is invalid or has expired. Please sign in again.' });
    }
    if (!['CUSTOMER', 'ADMIN'].includes(claims.role)) {
      return res.status(403).json({ error: 'Customer or admin access is required for this resource.' });
    }
    req.auth = claims;
    req.auth.userId = userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'The access token is invalid or has expired. Please sign in again.' });
  }
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.auth.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access is required for this resource.' });
    }
    next();
  });
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper to check DB connection status
app.get('/api/health', async (req, res) => {
  try {
    const result = await db.query('SELECT NOW()');
    res.json({ status: 'ok', dbTime: result.rows[0].now, message: 'Connected to PostgreSQL database' });
  } catch (err) {
    res.status(500).json({ status: 'db_offline', error: err.message });
  }
});

// ==============================================================================
// 1. AUTHENTICATION & USER MANAGEMENT (FR-1 to FR-4)
// ==============================================================================

// Customer Registration (FR-1)
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, phone } = req.body;
  
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }

  try {
    // Check if email already exists
    const existing = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email address is already registered.' });
    }

    const newUser = await db.query(
      `INSERT INTO users (name, email, password, phone, role) 
       VALUES ($1, $2, $3, $4, 'CUSTOMER') 
       RETURNING user_id, name, email, phone, role`,
      [name, email, await bcrypt.hash(password, 12), phone || '']
    );

    res.status(201).json({
      message: 'Registration successful',
      user: newUser.rows[0]
    });
  } catch (err) {
    console.error('Registration Error:', err);
    res.status(500).json({ error: 'Database error during registration.' });
  }
});

// Login (FR-2, FR-3, FR-4)
app.post('/api/auth/login', async (req, res) => {
  const { email, password, role } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Please enter both email and password.' });
  }

  try {
    const result = await db.query(
      'SELECT user_id, name, email, password, phone, role FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid login credentials.' });
    }

    const user = result.rows[0];

    const isPasswordValid = user.password.startsWith('$2')
      ? await bcrypt.compare(password, user.password)
      : password === user.password;

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid login credentials.' });
    }

    // Staff and admin accounts are issued by an administrator.
    if (role && user.role !== role.toUpperCase()) {
      return res.status(403).json({ error: `Access denied. This account is registered as ${user.role}.` });
    }

    const secret = getJwtSecret();
    if (!secret) {
      console.error('Login Error: JWT_SECRET is not configured.');
      return res.status(500).json({ error: 'Server authentication is not configured. Please contact the administrator.' });
    }

    const { password: _, ...userWithoutPassword } = user;
    const token = jwt.sign(
      { sub: String(user.user_id), role: user.role },
      secret,
      { expiresIn: '2h' }
    );

    res.json({
      message: 'Login successful',
      user: userWithoutPassword,
      token
    });
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ error: 'Database connection failed during login.' });
  }
});

// ==============================================================================
// 2. MOVIE & SHOW MANAGEMENT (FR-5 to FR-9)
// ==============================================================================

// Get all movies (FR-9)
app.get('/api/movies', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM movies ORDER BY movie_id DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Fetch Movies Error:', err);
    res.status(500).json({ error: 'Failed to retrieve movies.' });
  }
});

app.get('/api/movies/:id/dates', async (req, res) => {
  const movieId = Number(req.params.id);
  if (!Number.isInteger(movieId) || movieId <= 0) {
    return res.status(400).json({ error: 'Movie ID must be a positive integer.' });
  }

  try {
    const movie = await db.query('SELECT movie_id FROM movies WHERE movie_id = $1', [movieId]);
    if (movie.rows.length === 0) {
      return res.status(404).json({ error: 'Movie not found.' });
    }

    const result = await db.query(
      `      SELECT DISTINCT show_date
      FROM shows
      WHERE movie_id = $1
        AND show_date >= CURRENT_DATE
      ORDER BY show_date`,
      [movieId]
    );
    res.json(result.rows.map(row => row.show_date));
  } catch (err) {
    console.error('Fetch Movie Show Dates Error:', err);
    res.status(500).json({ error: 'Failed to retrieve available show dates.' });
  }
});

// Admin Add Movie (FR-5)
app.post('/api/movies', requireAdmin, async (req, res) => {
  const { title, genre, language, duration_min, poster_path, rating, description } = req.body;

  if (!title || !genre || !language || !duration_min) {
    return res.status(400).json({ error: 'Title, genre, language, and duration are required.' });
  }

  try {
    const result = await db.query(
      `INSERT INTO movies (title, genre, language, duration_min, poster_path, rating, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [title, genre, language, parseInt(duration_min), poster_path || '', rating || 'PG-13', description || '']
    );

    res.status(201).json({ message: 'Movie added successfully', movie: result.rows[0] });
  } catch (err) {
    console.error('Add Movie Error:', err);
    res.status(500).json({ error: 'Failed to add new movie.' });
  }
});

// Admin Update Movie (FR-6)
app.put('/api/movies/:id', requireAdmin, async (req, res) => {
  const movieId = req.params.id;
  const { title, genre, language, duration_min, poster_path, rating, description } = req.body;

  try {
    const result = await db.query(
      `UPDATE movies 
       SET title=$1, genre=$2, language=$3, duration_min=$4, poster_path=$5, rating=$6, description=$7
       WHERE movie_id=$8
       RETURNING *`,
      [title, genre, language, duration_min, poster_path, rating, description, movieId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Movie not found.' });
    }

    res.json({ message: 'Movie updated successfully', movie: result.rows[0] });
  } catch (err) {
    console.error('Update Movie Error:', err);
    res.status(500).json({ error: 'Failed to update movie.' });
  }
});

// Admin Delete Movie (FR-6)
app.delete('/api/movies/:id', requireAdmin, async (req, res) => {
  const movieId = req.params.id;
  try {
    await db.query('DELETE FROM movies WHERE movie_id = $1', [movieId]);
    res.json({ message: 'Movie deleted successfully.' });
  } catch (err) {
    console.error('Delete Movie Error:', err);
    res.status(500).json({ error: 'Failed to delete movie.' });
  }
});

// Get all screens
app.get('/api/screens', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM screens ORDER BY screen_id');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load screens.' });
  }
});

// Get shows with movie details (FR-9)
app.get('/api/shows', async (req, res) => {
  const { date, movie_id } = req.query;
  if (date !== undefined && !isValidDate(date)) {
    return res.status(400).json({ error: 'Date must be a valid date in YYYY-MM-DD format.' });
  }
  if (movie_id !== undefined && (!/^\d+$/.test(movie_id) || Number(movie_id) <= 0)) {
    return res.status(400).json({ error: 'Movie ID must be a positive integer.' });
  }

  try {
    const filters = [];
    const params = [];
    if (date !== undefined) {
      params.push(date);
      filters.push(`s.show_date = $${params.length}::date`);
    }
    if (movie_id !== undefined) {
      params.push(Number(movie_id));
      filters.push(`s.movie_id = $${params.length}`);
    }

    const queryText = `
      SELECT s.show_id, s.show_date, s.show_time, s.price_silver, s.price_gold, s.price_platinum,
             m.movie_id, m.title AS movie_title, m.genre, m.language, m.duration_min, m.poster_path, m.rating,
              sc.screen_id, sc.theatre_name, sc.screen_name, sc.total_seats
      FROM shows s
      JOIN movies m ON s.movie_id = m.movie_id
      JOIN screens sc ON s.screen_id = sc.screen_id
      ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
      ORDER BY s.show_date ASC, s.show_time ASC
    `;
    const result = await db.query(queryText, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Fetch Shows Error:', err);
    res.status(500).json({ error: 'Failed to retrieve shows.' });
  }
});

// Admin Create Show (FR-7, FR-8)
app.post('/api/shows', requireAdmin, async (req, res) => {
  const { movie_id, screen_id, show_date, show_time, price_silver, price_gold, price_platinum } = req.body;

  if (!movie_id || !screen_id || !show_date || !show_time) {
    return res.status(400).json({ error: 'Movie, screen, date, and time are required.' });
  }
  if (!isValidDate(show_date) || !/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(show_time)) {
    return res.status(400).json({ error: 'Please provide a valid show date and time.' });
  }

  try {
    const pastCheck = await db.query(
      'SELECT ($1::date + $2::time) <= CURRENT_TIMESTAMP AS is_past',
      [show_date, show_time]
    );
    if (pastCheck.rows[0].is_past) {
      return res.status(400).json({ error: 'A show cannot be scheduled in the past.' });
    }

    const duplicate = await db.query(
      `SELECT show_id FROM shows
       WHERE screen_id = $1 AND show_date = $2::date AND show_time = $3::time
       LIMIT 1`,
      [screen_id, show_date, show_time]
    );
    if (duplicate.rows.length > 0) {
      return res.status(409).json({ error: 'This screen already has a show scheduled at that date and time.' });
    }

    const result = await db.query(
      `INSERT INTO shows (movie_id, screen_id, show_date, show_time, price_silver, price_gold, price_platinum)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        movie_id, 
        screen_id, 
        show_date, 
        show_time, 
        price_silver || 10.00, 
        price_gold || 15.00, 
        price_platinum || 22.00
      ]
    );

    res.status(201).json({ message: 'Show created successfully', show: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'This screen already has a show scheduled at that date and time.' });
    }
    console.error('Create Show Error:', err);
    res.status(500).json({ error: 'Failed to schedule show.' });
  }
});

// ==============================================================================
// 3. SEAT MAP & BOOKING ENGINE (FR-10 to FR-15)
// ==============================================================================

// Get Seat Map for a Show with Real-Time Availability (FR-10)
app.get('/api/shows/:id/seats', async (req, res) => {
  const showId = req.params.id;

  try {
    // 1. Fetch Show & Screen information
    const showRes = await db.query(
      `SELECT s.*, m.title as movie_title, sc.screen_name, sc.total_seats
       FROM shows s
       JOIN movies m ON s.movie_id = m.movie_id
       JOIN screens sc ON s.screen_id = sc.screen_id
       WHERE s.show_id = $1`,
      [showId]
    );

    if (showRes.rows.length === 0) {
      return res.status(404).json({ error: 'Show not found.' });
    }

    const show = showRes.rows[0];

    // 2. Fetch all seats for this screen
    const seatsRes = await db.query(
      'SELECT seat_id, screen_id, seat_number, category FROM seats WHERE screen_id = $1 ORDER BY seat_number',
      [show.screen_id]
    );

    // 3. Fetch all currently booked seat_ids for this show where status = 'CONFIRMED'
    const bookedRes = await db.query(
      'SELECT seat_id FROM bookings WHERE show_id = $1 AND status = $2',
      [showId, 'CONFIRMED']
    );

    const bookedSeatIds = new Set(bookedRes.rows.map(r => r.seat_id));

    // 4. Combine seats with availability status
    const seatMap = seatsRes.rows.map(seat => ({
      seat_id: seat.seat_id,
      seat_number: seat.seat_number,
      category: seat.category,
      is_booked: bookedSeatIds.has(seat.seat_id)
    }));

    res.json({
      show,
      seats: seatMap
    });
  } catch (err) {
    console.error('Fetch Seat Map Error:', err);
    res.status(500).json({ error: 'Failed to load seat availability map.' });
  }
});

// Confirm Booking with Atomic Transaction (FR-11, FR-12, FR-13, NFR-3)
app.post('/api/bookings', requireAuth, async (req, res) => {
  const { show_id, seat_ids, payment_method } = req.body;
  const user_id = req.auth.userId;
  const allowedPaymentMethods = ['UPI', 'CARD', 'NET_BANKING', 'CASH'];

  if (!show_id || !Array.isArray(seat_ids) || seat_ids.length === 0) {
    return res.status(400).json({ error: 'Show ID and at least one seat are required.' });
  }
  if (!allowedPaymentMethods.includes(payment_method)) {
    return res.status(400).json({ error: 'Please select a valid payment method.' });
  }

  let client;
  let transactionStarted = false;

  try {
    client = await db.getClient();
    await client.query('BEGIN'); // Start PostgreSQL transaction
    transactionStarted = true;

    // 1. Get show pricing info
    const showRes = await client.query(
      `SELECT *, (show_date + show_time) <= CURRENT_TIMESTAMP AS has_started
       FROM shows
       WHERE show_id = $1
       FOR UPDATE`,
      [show_id]
    );
    if (showRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Selected show was not found.' });
    }
    const show = showRes.rows[0];
    if (show.has_started) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This show has already started and can no longer be booked.' });
    }

    // 2. Re-verify that NONE of the requested seats are already booked (NFR-3 Race-condition safety)
    const doubleCheck = await client.query(
      `SELECT seat_id FROM bookings 
       WHERE show_id = $1 AND seat_id = ANY($2::int[]) AND status = 'CONFIRMED'`,
      [show_id, seat_ids]
    );

    if (doubleCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ 
        error: 'One or more selected seats were just booked by another customer. Please choose alternative seats.' 
      });
    }

    // 3. Fetch seat details to compute total amount
    const seatsRes = await client.query(
      'SELECT seat_id, seat_number, category FROM seats WHERE seat_id = ANY($1::int[])',
      [seat_ids]
    );

    const bookingRef = 'BK-' + Math.floor(100000 + Math.random() * 900000);
    const createdBookings = [];
    let totalAmount = 0;

    for (const seat of seatsRes.rows) {
      let price = parseFloat(show.price_silver);
      if (seat.category === 'GOLD') price = parseFloat(show.price_gold);
      if (seat.category === 'PLATINUM') price = parseFloat(show.price_platinum);

      totalAmount += price;

      const insertRes = await client.query(
        `INSERT INTO bookings (booking_ref, user_id, show_id, seat_id, amount, payment_method, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'CONFIRMED')
         RETURNING booking_id, booking_ref, seat_id, amount, payment_method, booking_time`,
        [bookingRef, user_id, show_id, seat.seat_id, price, payment_method]
      );

      createdBookings.push(insertRes.rows[0]);
    }

    await client.query('COMMIT'); // Commit transaction
    transactionStarted = false;

    res.status(201).json({
      message: 'Booking confirmed successfully!',
      bookingRef,
      totalAmount,
      seatsCount: createdBookings.length,
      show_date: show.show_date,
      show_time: show.show_time,
      bookings: createdBookings
    });
  } catch (err) {
    if (client && transactionStarted) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        console.error('Booking Rollback Error:', rollbackErr);
      }
    }
    console.error('Booking Transaction Error:', err);
    res.status(client ? 500 : 503).json({
      error: client ? 'Booking failed due to a database error.' : 'Booking service is unavailable.'
    });
  } finally {
    if (client) client.release();
  }
});

// View Customer Booking History (FR-14)
app.get('/api/bookings/user/:userId', requireAuth, async (req, res) => {
  const userId = Number(req.params.userId);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ error: 'User ID must be a positive integer.' });
  }
  if (req.auth.role !== 'ADMIN' && userId !== req.auth.userId) {
    return res.status(403).json({ error: 'You can only view your own bookings.' });
  }

  try {
    const queryText = `
            SELECT b.booking_id, b.booking_ref, b.booking_time, b.amount, b.payment_method, b.status,
             s.show_date, s.show_time,
             m.title AS movie_title, m.poster_path, m.language, m.genre,
              sc.theatre_name, sc.screen_name,
             st.seat_number, st.category AS seat_category
      FROM bookings b
      JOIN shows s ON b.show_id = s.show_id
      JOIN movies m ON s.movie_id = m.movie_id
      JOIN screens sc ON s.screen_id = sc.screen_id
      JOIN seats st ON b.seat_id = st.seat_id
      WHERE b.user_id = $1
      ORDER BY b.booking_time DESC
    `;
    const result = await db.query(queryText, [userId]);
    res.json(result.rows);
  } catch (err) {
    console.error('Fetch Booking History Error:', err);
    res.status(500).json({ error: 'Failed to retrieve booking history.' });
  }
});

// Cancel Booking (FR-15)
app.post('/api/bookings/cancel/:id', requireAuth, async (req, res) => {
  const bookingId = Number(req.params.id);
  if (!Number.isInteger(bookingId) || bookingId <= 0) {
    return res.status(400).json({ error: 'Booking ID must be a positive integer.' });
  }
  let client;
  let transactionStarted = false;

  try {
    client = await db.getClient();
    await client.query('BEGIN');
    transactionStarted = true;
    const check = await client.query(
      `SELECT b.booking_id, b.booking_ref, b.status, b.user_id,
              (s.show_date + s.show_time - CURRENT_TIMESTAMP) < INTERVAL '2 hours' AS cancellation_blocked
       FROM bookings b
       JOIN shows s ON s.show_id = b.show_id
       WHERE b.booking_id = $1
         AND ($2::boolean OR b.user_id = $3)
       FOR UPDATE OF b, s`,
      [bookingId, req.auth.role === 'ADMIN', req.auth.userId]
    );
    if (check.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Booking not found.' });
    }

    const booking = check.rows[0];

    if (booking.status === 'CANCELLED') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This booking has already been cancelled.' });
    }
    if (booking.cancellation_blocked) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Bookings cannot be cancelled within 2 hours of the show start time.' });
    }

    await client.query(
      `UPDATE bookings SET status = 'CANCELLED'
       WHERE booking_ref = $1 AND status = 'CONFIRMED'`,
      [booking.booking_ref]
    );
    await client.query('COMMIT');
    transactionStarted = false;

    res.json({ message: 'Booking cancelled successfully. Seats have been released.', bookingRef: booking.booking_ref });
  } catch (err) {
    if (client && transactionStarted) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        console.error('Cancel Booking Rollback Error:', rollbackErr);
      }
    }
    console.error('Cancel Booking Error:', err);
    res.status(client ? 500 : 503).json({
      error: client ? 'Failed to cancel booking.' : 'Cancellation service is unavailable.'
    });
  } finally {
    if (client) client.release();
  }
});

// ==============================================================================
// 4. ADMIN SALES & REVENUE REPORTS (UC-7)
// ==============================================================================

app.get('/api/admin/reports', requireAdmin, async (req, res) => {
  const { from, to } = req.query;
  if ((from !== undefined && !isValidDate(from)) || (to !== undefined && !isValidDate(to))) {
    return res.status(400).json({ error: 'Date filters must use a valid YYYY-MM-DD format.' });
  }
  if (from && to && from > to) {
    return res.status(400).json({ error: 'The from date must be on or before the to date.' });
  }

  const params = [];
  const rangeConditions = ["b.status = 'CONFIRMED'"];
  if (from) {
    params.push(from);
    rangeConditions.push(`b.booking_time >= $${params.length}::date`);
  }
  if (to) {
    params.push(to);
    rangeConditions.push(`b.booking_time < ($${params.length}::date + INTERVAL '1 day')`);
  }
  const salesFilter = rangeConditions.join(' AND ');

  try {
    const [summaryRes, todayRevenueRes, movieSalesRes, categorySalesRes, dailyRevenueRes, occupancyRes, upcomingShowsRes] = await Promise.all([
      db.query(
        `SELECT COALESCE(SUM(b.amount), 0) AS total_revenue,
                COUNT(*) AS total_tickets_sold,
                COUNT(DISTINCT b.booking_ref) AS total_orders
         FROM bookings b
         WHERE ${salesFilter}`,
        params
      ),
      db.query(
        `SELECT COALESCE(SUM(amount), 0) AS today_revenue
         FROM bookings
         WHERE status = 'CONFIRMED' AND booking_time >= CURRENT_DATE
           AND booking_time < CURRENT_DATE + INTERVAL '1 day'`
      ),
      db.query(
      `SELECT m.title, m.genre, 
             COUNT(b.booking_id) AS tickets_sold,
             COALESCE(SUM(b.amount), 0) AS revenue
      FROM movies m
      LEFT JOIN shows s ON m.movie_id = s.movie_id
      LEFT JOIN bookings b ON s.show_id = b.show_id AND ${salesFilter}
      GROUP BY m.movie_id, m.title, m.genre
      ORDER BY revenue DESC`,
      params
      ),
      db.query(
      `SELECT st.category,
             COUNT(b.booking_id) AS tickets_sold,
             COALESCE(SUM(b.amount), 0) AS revenue
      FROM seats st
      JOIN bookings b ON st.seat_id = b.seat_id AND ${salesFilter}
      GROUP BY st.category
      ORDER BY CASE st.category WHEN 'SILVER' THEN 1 WHEN 'GOLD' THEN 2 WHEN 'PLATINUM' THEN 3 ELSE 4 END`,
      params
      ),
      db.query(
        `WITH bounds AS (
           SELECT COALESCE($1::date, CURRENT_DATE - INTERVAL '29 days')::date AS start_date,
                  COALESCE($2::date, CURRENT_DATE)::date AS end_date
         ),
         days AS (
           SELECT generate_series(start_date, end_date, INTERVAL '1 day')::date AS report_date
           FROM bounds
         )
         SELECT days.report_date, COALESCE(SUM(b.amount), 0) AS revenue
         FROM days
         LEFT JOIN bookings b
           ON b.status = 'CONFIRMED'
          AND b.booking_time >= days.report_date
          AND b.booking_time < days.report_date + INTERVAL '1 day'
         GROUP BY days.report_date
         ORDER BY days.report_date`,
        [from || null, to || null]
      ),
      db.query(
        `SELECT COALESCE(
           100.0 * SUM(CASE WHEN sold.seats_sold > 0 THEN sold.seats_sold ELSE 0 END)
           / NULLIF(SUM(s.total_seats), 0), 0
         ) AS occupancy_rate
         FROM shows s
         LEFT JOIN (
           SELECT show_id, COUNT(*) AS seats_sold
           FROM bookings
           WHERE status = 'CONFIRMED'
           GROUP BY show_id
         ) sold ON sold.show_id = s.show_id
         WHERE (s.show_date + s.show_time) > CURRENT_TIMESTAMP`
      ),
      db.query(
        `SELECT s.show_id, s.show_date, s.show_time, m.title AS movie_title,
                sc.theatre_name, sc.screen_name, sc.total_seats,
                COUNT(b.booking_id) AS seats_sold
         FROM shows s
         JOIN movies m ON m.movie_id = s.movie_id
         JOIN screens sc ON sc.screen_id = s.screen_id
         LEFT JOIN bookings b ON b.show_id = s.show_id AND b.status = 'CONFIRMED'
         WHERE (s.show_date + s.show_time) > CURRENT_TIMESTAMP
         GROUP BY s.show_id, s.show_date, s.show_time, m.title,
                  sc.theatre_name, sc.screen_name, sc.total_seats
         ORDER BY s.show_date, s.show_time
         LIMIT 50`
      )
    ]);

    res.json({
      summary: {
        ...summaryRes.rows[0],
        today_revenue: todayRevenueRes.rows[0].today_revenue,
        occupancy_rate: occupancyRes.rows[0].occupancy_rate
      },
      movieSales: movieSalesRes.rows,
      categorySales: categorySalesRes.rows,
      dailyRevenue: dailyRevenueRes.rows,
      upcomingShows: upcomingShowsRes.rows
    });
  } catch (err) {
    console.error('Admin Reports Error:', err);
    res.status(500).json({ error: 'Failed to generate sales reports.' });
  }
});

// Fallback route for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🎬 Movie Ticket Booking System API Server running`);
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`=======================================================`);
});
