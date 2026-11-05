# CineWave - Movie Ticket Booking System 🎬

> Runs in demo mode without PostgreSQL. For the full version, install PostgreSQL, run the SQL files in `database/`, and copy `.env.example` to `.env`.

**Prepared by:** Monisha  
**Student ID:** 251801360012  
**Institution:** Centurion University  
**Version:** 1.0 (Fullstack PostgreSQL + Express REST API + Modern Cinema Web UI)

---

## 📌 Executive Summary

The **Movie Ticket Booking System** is a fullstack web application constructed strictly according to the **Software Requirements Specification (SRS)** and **System Design Document (SDD)**. It provides a complete end-to-end cinema management and online ticketing experience:

- **Customers** can register, log in, browse movies and showtimes, select seats interactively across tier categories (**Silver**, **Gold**, **Platinum**), generate digital ticket passes with QR codes, view booking history, and cancel active tickets.
- **Date-aware booking**: browse a seven-day date strip per movie, see only that day's shows, and view show date/time on tickets and booking history. Shows cannot be booked after they start, and cancellation closes within two hours of showtime.
- **Customer dashboard**: booking totals, upcoming show count, confirmed spend, favourite genre, next-show countdown, searchable order-grouped history, and date/status filters.
- **Admin dashboard**: date-filtered KPIs and sales breakdowns, daily/movie/category charts, upcoming-show occupancy, and CSV export.
- **Admins** can manage movie listings, create show slots, assign screens, set category ticket prices, and view sales/revenue analytics reports.
- **Persistence Layer**: Native **PostgreSQL** database with unique constraints to prevent double-booking at the database tier (`idx_no_double_booking`).

---

## 🛠️ Technology Stack

| Layer | Technology Used |
| :--- | :--- |
| **Presentation (Frontend)** | HTML5, Vanilla CSS3 (Glassmorphism & Cinema Dark Palette), Modular JavaScript |
| **Backend API** | Node.js, Express.js REST API |
| **Database** | PostgreSQL (`pg` Connection Pool) |
| **Authentication** | Password verification & role-based routing (Customer / Admin) |
| **Design System** | Google Fonts ('Outfit', 'Plus Jakarta Sans'), FontAwesome 6 Icons |

---

## 🗄️ Database Architecture (PostgreSQL)

The database `movie_ticket_booking` follows the 6-table design specified in Section 3 of the SDD:

1. `users`: Customer and Admin credentials & contact information.
2. `movies`: Title, genre, language, runtime, rating, synopsis, poster URL.
3. `screens`: Theater screens/auditoriums (`Screen 1 (IMAX 70mm)`, `Screen 2 (Dolby Cinema)`).
4. `shows`: Scheduled movie screenings tied to a screen, date, time slot, and tier prices.
5. `seats`: Individual seat coordinates (`A1`-`E10`) classified into `SILVER`, `GOLD`, `PLATINUM`.
6. `bookings`: Confirmed/Cancelled tickets linked to user, show, seat, booking reference ID, and price.

### 🛡️ Double-Booking Prevention (NFR-3)

Enforced via PostgreSQL Partial Unique Index:
```sql
CREATE UNIQUE INDEX idx_no_double_booking 
ON bookings (show_id, seat_id) 
WHERE status = 'CONFIRMED';
```

---

## 🚀 Quick Start & Setup Guide

### 1️⃣ Prerequisites
- **Node.js**: v14.0 or higher ([Download Node.js](https://nodejs.org/))
- **PostgreSQL**: v12.0 or higher ([Download PostgreSQL](https://www.postgresql.org/))

---

### 2️⃣ PostgreSQL Database Setup

Open PostgreSQL terminal (`psql`) or PgAdmin and run:

```sql
-- Create Database
CREATE DATABASE movie_ticket_booking;

-- Connect to database
\c movie_ticket_booking;
```

Execute the schema and seed scripts:

```bash
# Using psql command line
psql -U postgres -d movie_ticket_booking -f database/schema.sql
psql -U postgres -d movie_ticket_booking -f database/migration_add_show_schedule_indexes.sql
psql -U postgres -d movie_ticket_booking -f database/seed.sql
```

The migration adds a show-date index and a unique screen/date/time schedule index. It does not remove existing rows. If applying it to an existing database fails because duplicate screen/date/time entries already exist, review and resolve those records before rerunning the migration.

---

### 3️⃣ Environment Configuration

For PostgreSQL mode, copy `.env.example` to `.env` and replace the placeholders with your local PostgreSQL connection details and a private random JWT secret. Do not commit `.env`.

```powershell
Copy-Item .env.example .env
```

Set JWT_SECRET to a private, randomly generated secret before starting the server. DATABASE_URL can be used instead of the individual PG* settings. Login returns a signed token that expires after two hours. Registration hashes passwords with bcrypt; existing legacy password hashes remain supported.

---

### 4️⃣ Install Dependencies & Launch Backend API

In the project root directory:

```bash
# Install dependencies
npm install

# Start the Express server
npm start
```

Output:
```
=======================================================
🎬 Movie Ticket Booking System API Server running
📍 URL: http://localhost:3000
=======================================================
```

Open your browser and navigate to: **`http://localhost:3000`**

> 💡 **Fallback / Demo Mode:** If PostgreSQL is not running, the web frontend automatically initializes an interactive in-memory demo state with sample movies, showtimes, seat maps, booking history, dashboards, and role-based Quick Login buttons. These sessions and any bookings made in them are local demo data only; they do not create database accounts or issue server JWTs.

---

### Demo Logins

The customer and admin profiles offered by the offline Quick Login buttons are demo accounts only. They are password-free, in-memory profiles and are not usable for PostgreSQL/API authentication. No default database login accounts are seeded; register a customer through the app and have a trusted operator provision any admin account securely.

---

## 🔌 REST API Endpoints Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register a customer account with a bcrypt-hashed password |
| `POST` | `/api/auth/login` | Authenticate credentials and return user, role, and a 2-hour JWT |
| `GET` | `/api/movies` | Fetch list of all active movies |
| `POST` | `/api/movies` | (Admin JWT required) Add new movie listing |
| `PUT` | `/api/movies/:id` | (Admin JWT required) Update movie listing |
| `DELETE` | `/api/movies/:id` | (Admin JWT required) Delete movie listing |
| `GET` | `/api/shows?date=YYYY-MM-DD&movie_id=:id` | Fetch shows with movie and screen info; either filter is optional |
| `GET` | `/api/movies/:id/dates` | List distinct upcoming show dates for a movie, starting today |
| `POST` | `/api/shows` | (Admin JWT required) Schedule a show and set tier pricing; rejects past shows (400) and screen/time conflicts (409) |
| `GET` | `/api/shows/:id/seats` | Get visual seat matrix for a show with real-time availability |
| `POST` | `/api/bookings` | Execute atomic multi-seat booking transaction; rejects shows that have started and returns `show_date` and `show_time` |
| `GET` | `/api/bookings/user/:userId` | Get customer booking history |
| `POST` | `/api/bookings/cancel/:id` | Cancel all seats in the booking reference; returns 400 within two hours of showtime |
| `GET` | `/api/admin/reports?from=YYYY-MM-DD&to=YYYY-MM-DD` | (Admin JWT required) Get filtered sales KPIs, daily revenue, per-movie/category sales, today's revenue, upcoming occupancy, and upcoming shows; dates are optional and inclusive, filtered by booking time |

Send the login token as `Authorization: Bearer <token>` on admin movie write, show creation, and report requests. Requests without a valid Admin token receive HTTP 401 or 403.

---

## 🎯 Verification Matrix against SRS Requirements

| SRS ID | Requirement Title | Implementation Details | Status |
| :--- | :--- | :--- | :---: |
| **FR-1** | Customer Registration | Register form with input validation and DB insert | ✅ Complete |
| **FR-2/3/4** | Login Validation | Login modal supporting Customer & Admin roles | ✅ Complete |
| **FR-5/6** | Admin Movie Management | Admin Portal tab for adding/deleting movies with posters | ✅ Complete |
| **FR-7/8** | Show & Price Management | Form to create shows with Silver/Gold/Platinum tier pricing | ✅ Complete |
| **FR-9** | Movie & Show Listing | Responsive grid filterable by genre and search text | ✅ Complete |
| **FR-10/11** | Interactive Seat Selection | 5x10 curved screen matrix with category color coding | ✅ Complete |
| **FR-12/13** | Price Calc & Ticket Pass | Live total amount breakdown & digital ticket pass card | ✅ Complete |
| **FR-14/15** | Booking History & Cancellation | View history list and cancel ticket with seat release | ✅ Complete |
| **NFR-3** | Double-Booking Prevention | PostgreSQL unique constraint + transaction validation | ✅ Complete |

### 📊 Dashboard Verification

- **Customer demo:** When PostgreSQL is offline, click **Demo Customer** Quick Login, then open **My Bookings** to see summary cards, the next-show countdown, booking history, and filters. When PostgreSQL is online, register or sign in with a database-backed customer account.
- **Admin demo:** When PostgreSQL is offline, click **Demo Admin** Quick Login, then open **Admin Portal**. Use **Today**, **7 days**, **30 days**, or set a custom From/To range. Verify the KPIs, charts, sales tables, upcoming occupancy table, and **Export CSV**. This client-side demo role does not grant API admin access.
- **Reports API:** Request `/api/admin/reports?from=YYYY-MM-DD&to=YYYY-MM-DD`; invalid dates and a From date after To should return HTTP 400. Date range filtering applies to booking timestamps; today's revenue and upcoming occupancy are separately calculated.

---

## 👩‍🎓 Author & Course Info

- **Developer:** Monisha
- **Student ID:** 251801360012
- **Institution:** Centurion University
- **Project:** Movie Ticket Booking System (SRS & SDD Implementation)
