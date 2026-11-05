const { pool } = require('./db');
const { fail } = require('./http');

const THERAPIES = ['Occupational therapy', 'Speech therapy', 'Physiotherapy'];
const THERAPY_SET = new Set(THERAPIES);

function therapyOf(value) {
  const therapy = typeof value === 'string' ? value.trim() : '';
  return THERAPY_SET.has(therapy) ? therapy : null;
}

async function doctorFor(doctorId, therapyType) {
  const id = doctorId == null || doctorId === '' ? null : Number(doctorId);
  if (id != null && !Number.isInteger(id)) throw fail(400, 'Choose a doctor.');
  if (therapyType && !THERAPY_SET.has(therapyType)) throw fail(400, 'Choose a therapy type.');
  if (!id) return { doctorId: null, doctorName: null };
  const { rows } = await pool.query(
    'SELECT id, name, therapy_type AS "therapyType" FROM users WHERE id = $1 AND therapy_type IS NOT NULL',
    [id],
  );
  const doctor = rows[0];
  if (!doctor) throw fail(400, 'Choose a doctor.');
  if (therapyType && doctor.therapyType !== therapyType) {
    throw fail(400, 'That doctor does not follow this therapy.');
  }
  return { doctorId: doctor.id, doctorName: doctor.name };
}

async function listTherapies() {
  const { rows } = await pool.query('SELECT id, name FROM therapies ORDER BY name');
  return rows;
}

async function resolveTherapy(value) {
  const therapy = typeof value === 'string' ? value.trim() : '';
  if (!therapy) return null;
  const { rows } = await pool.query('SELECT name FROM therapies WHERE lower(name) = lower($1)', [therapy]);
  return rows[0]?.name ?? null;
}

module.exports = { THERAPIES, THERAPY_SET, therapyOf, doctorFor, listTherapies, resolveTherapy };
