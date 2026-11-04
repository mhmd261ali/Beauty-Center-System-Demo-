const express = require('express');

const { pool } = require('../db');
const { requireAuth, requireRole } = require('../auth');
const { asyncHandler, fail, isDate, text, localToday, wholeNumber } = require('../http');
const { THERAPY_SET, doctorFor } = require('../care');
const { domainOf, assertDomain } = require('../scope');

const router = express.Router();
router.use(requireAuth);

const patientColumns = `
  p.id,
  p.full_name AS "fullName",
  p.phone,
  p.email,
  to_char(p.date_of_birth, 'YYYY-MM-DD') AS "dateOfBirth",
  p.gender,
  p.notes,
  p.therapy_type AS "therapyType",
  p.doctor_id AS "doctorId",
  (SELECT u.name FROM users u WHERE u.id = p.doctor_id) AS "doctorName",
  COALESCE(p.patient_type, 'Private') AS "patientType",
  p.sessions_allotted AS "sessionsAllotted",
  (
    SELECT COUNT(*)::int
    FROM reservations r
    WHERE r.patient_id = p.id AND r.status <> 'cancelled'
  ) AS "sessionCount",
  p.created_at AS "createdAt"
`;

function allottedSessions(patientType, value) {
  if (patientType !== 'Company' && patientType !== 'Insurance') return null;
  return wholeNumber(value, 'Number of sessions');
}

function careInput(body) {
  const therapyType = text(body.therapyType, 80, 'Specialty');
  if (therapyType && !THERAPY_SET.has(therapyType)) {
    throw fail(400, 'Choose a specialty.');
  }
  return { therapyType, doctorId: body.doctorId };
}

function patientInput(body, { requireName }) {
  const fullName = text(body.fullName, 120, 'Name');
  if (requireName && !fullName) {
    throw fail(400, 'Enter the patient name.');
  }
  if (fullName && fullName.length < 2) {
    throw fail(400, 'Enter the patient name.');
  }
  const dateOfBirth = text(body.dateOfBirth, 10, 'Date of birth');
  if (dateOfBirth && !isDate(dateOfBirth)) {
    throw fail(400, 'Use a date of birth like 1988-04-12.');
  }
  if (dateOfBirth && dateOfBirth > localToday()) {
    throw fail(400, 'Date of birth cannot be in the future.');
  }
  const gender = text(body.gender, 40, 'Gender');
  if (gender && gender !== 'Male' && gender !== 'Female') {
    throw fail(400, 'Choose male or female.');
  }
  if (requireName && !gender) {
    throw fail(400, 'Choose male or female.');
  }
  const patientType = text(body.patientType, 40, 'Patient type') || 'Private';
  if (!['Private', 'Company', 'Insurance'].includes(patientType)) {
    throw fail(400, 'Choose private, insurance, or company.');
  }
  return {
    fullName,
    phone: text(body.phone, 40, 'Phone'),
    email: text(body.email, 120, 'Email'),
    dateOfBirth,
    gender,
    notes: text(body.notes, 2000, 'Notes'),
    patientType,
    sessionsAllotted: allottedSessions(patientType, body.sessionsAllotted),
    ...careInput(body),
  };
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const term = String(req.query.q || '').trim();
    const pattern = term ? `%${term}%` : null;
    const today = isDate(req.query.today) ? req.query.today : null;
    const domain = await domainOf(req);
    const { rows } = await pool.query(
      `
      SELECT
        ${patientColumns},
        nv.visit AS "nextVisit",
        COALESCE(
          (
            SELECT array_agg(DISTINCT btrim(r.reason))
            FROM reservations r
            WHERE r.patient_id = p.id
              AND r.status <> 'cancelled'
              AND r.reason IS NOT NULL
              AND btrim(r.reason) <> ''
          ),
          '{}'::text[]
        ) AS reasons
      FROM patients p
      LEFT JOIN LATERAL (
        SELECT to_char(r.scheduled_date, 'YYYY-MM-DD') || ' · ' || to_char(r.start_time, 'HH24:MI') AS visit
        FROM reservations r
        WHERE r.patient_id = p.id
          AND r.status IN ('scheduled', 'arrived')
          AND r.scheduled_date >= COALESCE($2::date, CURRENT_DATE)
        ORDER BY r.scheduled_date, r.start_time
        LIMIT 1
      ) nv ON true
      WHERE ($1::text IS NULL OR p.full_name ILIKE $1 OR COALESCE(p.phone, '') ILIKE $1)
        AND ($3::text IS NULL OR p.therapy_type = $3)
      ORDER BY p.full_name
      LIMIT 200
      `,
      [pattern, today, domain],
    );
    res.json({ patients: rows });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT ${patientColumns} FROM patients p WHERE p.id = $1`,
      [req.params.id],
    );
    if (!rows[0]) throw fail(404, 'Patient not found.');
    assertDomain(await domainOf(req), rows[0].therapyType, 'That patient is outside your specialty.');
    res.json({ patient: rows[0] });
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = patientInput(req.body, { requireName: true });
    const domain = await domainOf(req);
    if (domain != null) input.therapyType = domain;
    const doctor = await doctorFor(input.doctorId, input.therapyType);
    const { rows } = await pool.query(
      `
      INSERT INTO patients (full_name, phone, email, date_of_birth, gender, notes, therapy_type, doctor_id, doctor, doctors, patient_type, sessions_allotted)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id
      `,
      [
        input.fullName,
        input.phone,
        input.email,
        input.dateOfBirth,
        input.gender,
        input.notes,
        input.therapyType,
        doctor.doctorId,
        doctor.doctorName,
        doctor.doctorName ? [doctor.doctorName] : [],
        input.patientType,
        input.sessionsAllotted,
      ],
    );
    const created = await pool.query(
      `SELECT ${patientColumns} FROM patients p WHERE p.id = $1`,
      [rows[0].id],
    );
    res.status(201).json({ patient: created.rows[0] });
  }),
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = await pool.query(
      'SELECT id, patient_type AS "patientType", sessions_allotted AS "sessionsAllotted", therapy_type AS "therapyType" FROM patients WHERE id = $1',
      [req.params.id],
    );
    if (!existing.rows[0]) throw fail(404, 'Patient not found.');
    const domain = await domainOf(req);
    assertDomain(domain, existing.rows[0].therapyType, 'That patient is outside your specialty.');
    const care = careInput(req.body);
    if (domain != null) care.therapyType = domain;
    const doctor = await doctorFor(care.doctorId, care.therapyType);
    const desk = req.user.role === 'admin' || req.user.role === 'sub-admin';
    if (!desk) {
      const currentType = existing.rows[0].patientType || 'Private';
      const allotted =
        req.body.sessionsAllotted == null || req.body.sessionsAllotted === ''
          ? existing.rows[0].sessionsAllotted
          : allottedSessions(currentType, req.body.sessionsAllotted);
      await pool.query(
        'UPDATE patients SET therapy_type = $1, doctor_id = $2, doctor = $3, doctors = $4, sessions_allotted = $5 WHERE id = $6',
        [care.therapyType, doctor.doctorId, doctor.doctorName, doctor.doctorName ? [doctor.doctorName] : [], allotted, req.params.id],
      );
    } else {
      const input = patientInput(req.body, { requireName: true });
      await pool.query(
        `
        UPDATE patients
        SET full_name = $1, phone = $2, email = $3, date_of_birth = $4, gender = $5, notes = $6,
            therapy_type = $7, doctor_id = $8, doctor = $9, doctors = $10, patient_type = $11, sessions_allotted = $12
        WHERE id = $13
        `,
        [
          input.fullName,
          input.phone,
          input.email,
          input.dateOfBirth,
          input.gender,
          input.notes,
          care.therapyType,
          doctor.doctorId,
          doctor.doctorName,
          doctor.doctorName ? [doctor.doctorName] : [],
          input.patientType,
          input.sessionsAllotted,
          req.params.id,
        ],
      );
    }
    const { rows } = await pool.query(
      `SELECT ${patientColumns} FROM patients p WHERE p.id = $1`,
      [req.params.id],
    );
    res.json({ patient: rows[0] });
  }),
);

router.delete(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { rowCount } = await pool.query('DELETE FROM patients WHERE id = $1', [req.params.id]);
    if (!rowCount) throw fail(404, 'Patient not found.');
    res.json({ ok: true });
  }),
);

module.exports = router;
