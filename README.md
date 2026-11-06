# CineWave - Movie Ticket Booking System 🎬

> Runs in demo mode without PostgreSQL. For the full version, install PostgreSQL, run the SQL files in `database/`, and copy `.env.example` to `.env`.

**Prepared by:** Monisha  
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
| **Backend API** | Java 17, Spring Boot REST API |
| **Database** | PostgreSQL (JDBC / HikariCP connection pool) |
| **Authentication** | BCrypt password hashing, JWT tokens, role-based access (Customer / Admin) |
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
- **Java**: JDK 17 or higher ([Download Java](https://adoptium.net/))
- **Maven**: 3.9 or higher ([Install Maven](https://maven.apache.org/install.html))
- **PostgreSQL**: v12.0 or higher for persistent database mode ([Download PostgreSQL](https://www.postgresql.org/))

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

Spring Boot loads the copied `.env` file when present. Set `JWT_SECRET` to a private, randomly generated value of at least 32 characters. `DATABASE_URL` accepts `jdbc:postgresql://...` or `postgresql://...`; otherwise the individual `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, and `PGPASSWORD` settings are used. Login returns a signed token that expires after two hours. Registration hashes passwords with BCrypt; existing legacy password hashes remain supported.

---

### 4️⃣ Build & Launch the Java Backend

In the project root directory:

```bash
# Build the Spring Boot application
mvn clean package

# Start the packaged Java backend
java -jar target/cinewave-1.0.0.jar
```

The Spring Boot startup log will show the embedded server running on port `3000`.

Open your browser and navigate to: **`http://localhost:3000`**

> 💡 **Fallback / Demo Mode:** The Java server can start when PostgreSQL is unavailable; `/api/health` then reports `db_offline`. The frontend in `public/` automatically uses its browser-local demo data for movies, showtimes, seat maps, booking history, dashboards, demo Quick Login buttons, and the booking flow. Demo activity is local to the browser and does not create database accounts or server JWTs.

The HTML, CSS, and JavaScript frontend remains in `public/` and is served by Spring Boot. The former Node.js backend files are preserved under `legacy-node/`; they are not used to start the Java application.

### Java Source Files

The web backend entry point is `src/main/java/com/movieticketbooking/Main.java`. The existing `Movie.java`, `Show.java`, and `User.java` model classes are retained under `src/main/java/com/movieticketbooking/model/`. `MainApp.java` is the original Swing screen and is retained separately; run `Main` to start the web backend.

---

### Demo Logins

The customer and admin profiles offered by the offline Quick Login buttons are demo accounts only. They are password-free, in-memory profiles and are not usable for PostgreSQL/API authentication. No default database login accounts are seeded; register a customer through the app and have a trusted operator provision any admin account securely.

---

## 🔌 REST API Endpoints Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Check PostgreSQL availability |
| `POST` | `/api/auth/register` | Register a customer account with a BCrypt-hashed password |
| `POST` | `/api/auth/login` | Authenticate credentials and return user, role, and a 2-hour JWT |
| `GET` | `/api/movies` | Fetch all movies |
| `GET` | `/api/movies/:id/dates` | List upcoming show dates for a movie |
| `POST` | `/api/movies` | (Admin JWT required) Add a movie |
| `PUT` | `/api/movies/:id` | (Admin JWT required) Update a movie |
| `DELETE` | `/api/movies/:id` | (Admin JWT required) Delete a movie |
| `GET` | `/api/screens` | Fetch screens |
| `GET` | `/api/shows?date=YYYY-MM-DD&movie_id=:id` | Fetch shows with movie and screen information |
| `POST` | `/api/shows` | (Admin JWT required) Schedule a show |
| `GET` | `/api/shows/:id/seats` | Get a show's seat map and availability |
| `POST` | `/api/bookings` | (JWT required) Book multiple seats transactionally |
| `GET` | `/api/bookings/user/:userId` | (JWT required) Fetch the user's booking history |
| `POST` | `/api/bookings/cancel/:id` | (JWT required) Cancel a booking reference |
| `GET` | `/api/admin/reports?from=YYYY-MM-DD&to=YYYY-MM-DD` | (Admin JWT required) Fetch sales, revenue, and occupancy reports |

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
- **Institution:** Centurion University
- **Project:** Movie Ticket Booking System (SRS & SDD Implementation)
