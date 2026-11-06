const { Pool } = require('pg');
require('dotenv').config();

const poolConfig = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : {
      host: process.env.PGHOST || 'localhost',
      port: process.env.PGPORT || 5432,
      database: process.env.PGDATABASE || 'movie_ticket_booking',
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || '',
      connectionTimeoutMillis: 3000, // 3s timeout for quick failure detection
    };

const pool = new Pool(poolConfig);

// Prevent unhandled pool errors from crashing Node process when PostgreSQL is offline
pool.on('error', (err) => {
  console.log('PostgreSQL Connection Note:', err.message);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  pool
};
