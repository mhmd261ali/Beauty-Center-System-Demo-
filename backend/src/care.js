const { pool } = require('./db');
const { fail } = require('./http');

const THERAPIES = ['General practice', 'Pediatrics', 'Physiotherapy', 'Occupational therapy', 'Speech therapy'];
const THERAPY_SET = new Set(THERAPIES);

function therapyOf(value) {
  const therapy = typeof value === 'string' ? value.trim() : '';
  return THERAPY_SET.has(therapy) ? therapy : null;
}

async function doctorFor(doctorId, therapyType) {
  const id = doctorId == null || doctorId === '' ? null : Number(doctorId);
  if (id != null && !Number.isInteger(id)) throw fail(400, 'Choose a clinician.');
  if (therapyType && !THERAPY_SET.has(therapyType)) throw fail(400, 'Choose a specialty.');
  if (!id) return { doctorId: null, doctorName: null };
  const { rows } = await pool.query(
    'SELECT id, name, therapy_type AS "therapyType" FROM users WHERE id = $1 AND therapy_type IS NOT NULL',
    [id],
  );
  const doctor = rows[0];
  if (!doctor) throw fail(400, 'Choose a clinician.');
  if (therapyType && doctor.therapyType !== therapyType) {
    throw fail(400, 'That clinician does not cover this specialty.');
  }
  return { doctorId: doctor.id, doctorName: doctor.name };
}

module.exports = { THERAPIES, THERAPY_SET, therapyOf, doctorFor };
