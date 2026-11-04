const bcrypt = require('bcryptjs');

const { pool } = require('./db');
const { uploadsDir } = require('./paths');
const { seedInstruments } = require('./seedInstruments');

const CLINICIANS = [
  ['Dr. Elena Costa', 'elena.costa@halden.clinic', 'General practice'],
  ['Dr. James Okonkwo', 'james.okonkwo@halden.clinic', 'Pediatrics'],
];

const CASES = [
  ['Amira Hassan', 'General practice', 'elena.costa@halden.clinic'],
  ['Jonah Ellis', 'General practice', 'elena.costa@halden.clinic'],
  ['Priya Raman', 'General practice', 'elena.costa@halden.clinic'],
  ['Luis Ortega', 'General practice', 'elena.costa@halden.clinic'],
  ['Omar Farouk', 'General practice', 'elena.costa@halden.clinic'],
  ['Elena Varga', 'General practice', 'elena.costa@halden.clinic'],
  ['Marcus Webb', 'General practice', 'elena.costa@halden.clinic'],
  ['Hanae Suzuki', 'Physiotherapy', 'maryam@halden.clinic'],
  ['Leila Nasser', 'Speech therapy', 'nadia@halden.clinic'],
  ['Theo Berg', 'Pediatrics', 'james.okonkwo@halden.clinic'],
];

async function widenPayerTypes() {
  await pool.query(`UPDATE patients SET patient_type = 'Insurance' WHERE patient_type = 'Islamic'`);
  const { rows } = await pool.query(`
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'patients'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%patient_type%'
  `);
  for (const row of rows) {
    await pool.query(`ALTER TABLE patients DROP CONSTRAINT ${quoteIdent(row.conname)}`);
  }
  await pool.query(`
    ALTER TABLE patients
    ADD CONSTRAINT patients_patient_type_check
    CHECK (patient_type IN ('Private', 'Company', 'Insurance'))
  `);
}

function quoteIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

async function addClinicians() {
  const password = bcrypt.hashSync('doctor123', 10);
  for (const [name, email, specialty] of CLINICIANS) {
    await pool.query(
      `
      INSERT INTO users (name, email, password_hash, role, therapy_type)
      VALUES ($1, $2, $3, 'user', $4)
      ON CONFLICT (email) DO NOTHING
      `,
      [name, email, password, specialty],
    );
  }
}

async function assignSampleCases() {
  for (const [patientName, specialty, email] of CASES) {
    await pool.query(
      `
      UPDATE patients p
      SET therapy_type = $2,
          doctor_id = u.id,
          doctor = u.name,
          doctors = ARRAY[u.name]
      FROM users u
      WHERE p.full_name = $1
        AND u.email = $3
        AND p.therapy_type IS NULL
      `,
      [patientName, specialty, email],
    );
  }
  await pool.query(`
    UPDATE reservations r
    SET doctor_id = p.doctor_id
    FROM patients p
    WHERE r.patient_id = p.id
      AND r.doctor_id IS NULL
      AND p.doctor_id IS NOT NULL
  `);
}

async function widenDemo() {
  await widenPayerTypes();
  await addClinicians();
  await assignSampleCases();
  const admin = await pool.query(`SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1`);
  const adminId = admin.rows[0]?.id;
  if (adminId) await seedInstruments((text, params) => pool.query(text, params), adminId, uploadsDir);
}

module.exports = { widenDemo };
