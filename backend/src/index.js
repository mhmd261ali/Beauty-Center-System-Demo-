const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { pool, waitForDb } = require('./db');
const { runSetup } = require('./setup');
const authRoutes = require('./routes/auth');
const patientRoutes = require('./routes/patients');
const reservationRoutes = require('./routes/reservations');
const documentRoutes = require('./routes/documents');
const userRoutes = require('./routes/users');
const doctorRoutes = require('./routes/doctors');
const instrumentRoutes = require('./routes/instruments');
const incomeRoutes = require('./routes/income');
const dashboardRoutes = require('./routes/dashboard');

const app = express();
app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/instruments', instrumentRoutes);
app.use('/api/income', incomeRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

app.use((error, _req, res, _next) => {
  if (error.status) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  if (error.code === '23505') {
    res.status(409).json({ error: 'That email is already in use.' });
    return;
  }
  console.error(error);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

async function main() {
  await waitForDb();
  const ready = await pool.query(`SELECT to_regclass('public.users') AS name`);
  if (!ready.rows[0].name) {
    console.log('First start: creating the clinic database and demo desk.');
    await runSetup();
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS instruments (
      id SERIAL PRIMARY KEY,
      therapy_type TEXT NOT NULL,
      name TEXT NOT NULL,
      used_for TEXT NOT NULL,
      file_name TEXT,
      stored_name TEXT,
      mime_type TEXT,
      added_by INTEGER REFERENCES users (id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS instruments_therapy_idx ON instruments (therapy_type, name)');
  await pool.query('ALTER TABLE documents ADD COLUMN IF NOT EXISTS staff_id INTEGER REFERENCES users (id) ON DELETE SET NULL');
  await pool.query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS patient_type TEXT`);
  await pool.query(`UPDATE patients SET patient_type = 'Private' WHERE patient_type IS NULL OR btrim(patient_type) = ''`);
  await pool.query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS sessions_allotted INTEGER`);
  await pool.query(`ALTER TABLE reservations ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(12, 2)`);
  await pool.query('DELETE FROM documents WHERE stored_name IS NULL OR file_name IS NULL');
  const port = Number(process.env.PORT || 4000);
  app.listen(port, () => {
    console.log(`Halden API listening on http://localhost:${port}`);
  });
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { app };
