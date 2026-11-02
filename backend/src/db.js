const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function waitForDb() {
  let lastError;
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  const message = lastError instanceof Error ? lastError.message : 'unknown error';
  throw new Error(`Postgres is not ready (${message}). Start it with: docker compose up -d`);
}

module.exports = { pool, waitForDb };
