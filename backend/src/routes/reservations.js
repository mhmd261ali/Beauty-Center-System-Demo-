const express = require('express');

const { pool } = require('../db');
const { requireAuth, requireRole } = require('../auth');
const { asyncHandler, fail, isDate, isTime, minutes, money, text } = require('../http');
const { therapyOf, doctorFor } = require('../care');

const router = express.Router();
router.use(requireAuth);

const reservationSelect = `
  SELECT
    r.id,
    r.patient_id AS "patientId",
    p.full_name AS "patientName",
    p.phone,
    to_char(r.scheduled_date, 'YYYY-MM-DD') AS "scheduledDate",
    to_char(r.start_time, 'HH24:MI') AS "startTime",
    to_char(r.end_time, 'HH24:MI') AS "endTime",
    r.reason,
    r.status,
    r.notes,
    r.amount_paid::float8 AS "amountPaid",
    r.doctor_id AS "doctorId",
    doc.name AS "doctorName",
    u.name AS "createdByName",
    COALESCE(p.patient_type, 'Private') AS "patientType",
    COALESCE(
      p.therapy_type,
      doc.therapy_type,
      CASE
        WHEN r.reason IN ('Occupational therapy', 'Speech therapy', 'Physiotherapy') THEN r.reason
        ELSE NULL
      END
    ) AS "therapyType"
  FROM reservations r
  JOIN patients p ON p.id = r.patient_id
  LEFT JOIN users doc ON doc.id = r.doctor_id
  LEFT JOIN users u ON u.id = r.created_by
`;

async function findReservation(id) {
  const { rows } = await pool.query(`${reservationSelect} WHERE r.id = $1`, [id]);
  return rows[0] || null;
}

async function overlapsFor(reservation) {
  const { rows } = await pool.query(
    `
    ${reservationSelect}
    WHERE r.scheduled_date = $1::date
      AND r.id <> $2
      AND r.status <> 'cancelled'
      AND r.start_time < $4::time
      AND r.end_time > $3::time
    ORDER BY r.start_time
    `,
    [reservation.scheduledDate, reservation.id, reservation.startTime, reservation.endTime],
  );
  return rows;
}

function scheduleFrom(body) {
  const scheduledDate = text(body.scheduledDate, 10, 'Date');
  const startTime = text(body.startTime, 5, 'Start time');
  const endTime = text(body.endTime, 5, 'End time');
  if (!scheduledDate || !isDate(scheduledDate)) throw fail(400, 'Choose a valid date.');
  if (!startTime || !isTime(startTime) || !endTime || !isTime(endTime)) {
    throw fail(400, 'Use times like 09:30.');
  }
  if (minutes(endTime) <= minutes(startTime)) {
    throw fail(400, 'The visit has to end after it starts.');
  }
  return {
    scheduledDate,
    startTime,
    endTime,
    reason: text(body.reason, 200, 'Reason'),
    notes: text(body.notes, 2000, 'Notes'),
    amountPaid: money(body.amountPaid, 'Amount paid'),
  };
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const clauses = [];
    const params = [];
    if (isDate(req.query.date)) {
      params.push(req.query.date);
      clauses.push(`r.scheduled_date = $${params.length}::date`);
    }
    if (isDate(req.query.from)) {
      params.push(req.query.from);
      clauses.push(`r.scheduled_date >= $${params.length}::date`);
    }
    if (isDate(req.query.to)) {
      params.push(req.query.to);
      clauses.push(`r.scheduled_date <= $${params.length}::date`);
    }
    if (req.query.patientId) {
      const patientId = Number(req.query.patientId);
      if (!Number.isInteger(patientId)) throw fail(400, 'Unknown patient.');
      params.push(patientId);
      clauses.push(`r.patient_id = $${params.length}`);
    }
    const pending = req.query.pending === '1';
    if (pending) {
      params.push(clinicNow());
      clauses.push(`r.status = 'scheduled'`);
      clauses.push(`(r.scheduled_date + r.end_time) <= $${params.length}::timestamp`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const order = pending
      ? 'ORDER BY r.scheduled_date DESC, r.start_time DESC, r.id DESC'
      : 'ORDER BY r.scheduled_date, r.start_time, r.id';
    const { rows } = await pool.query(`${reservationSelect} ${where} ${order}`, params);
    res.json({ reservations: rows });
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const schedule = scheduleFrom(req.body);
    const status = req.body.status || 'scheduled';
    if (!['scheduled', 'completed', 'cancelled'].includes(status)) {
      throw fail(400, 'Unknown visit status.');
    }
    if (status !== 'scheduled' && !['admin', 'sub-admin'].includes(req.user.role)) {
      throw fail(403, 'Your role can book a visit, but not close one.');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const patientId = Number(req.body.patientId);
      if (!Number.isInteger(patientId)) throw fail(400, 'Choose a registered patient.');
      const found = await client.query('SELECT id, therapy_type FROM patients WHERE id = $1', [patientId]);
      if (!found.rows[0]) throw fail(404, 'Patient not found.');
      if (req.body.openSlot) {
        const startMinutes = minutes(schedule.startTime);
        const endMinutes = minutes(schedule.endTime);
        if (startMinutes < 7 * 60 || endMinutes > 16 * 60) {
          throw fail(400, 'Choose a time between 7:00 AM and 4:00 PM.');
        }
        const clash = await client.query(
          `
          SELECT id FROM reservations
          WHERE scheduled_date = $1::date
            AND status <> 'cancelled'
            AND start_time < $3::time
            AND end_time > $2::time
          LIMIT 1
          `,
          [schedule.scheduledDate, schedule.startTime, schedule.endTime],
        );
        if (clash.rows[0]) throw fail(409, 'That time is already booked.');
      }
      const openSlot = Boolean(req.body.openSlot);
      const therapy = therapyOf(schedule.reason) || therapyOf(found.rows[0].therapy_type);
      const doctor = await doctorFor(req.body.doctorId, therapy);
      if (therapy && !doctor.doctorId) throw fail(400, 'Choose a doctor for this therapy.');

      const created = await client.query(
        `
        INSERT INTO reservations (
          patient_id, scheduled_date, start_time, end_time, reason, status, notes, doctor_id, created_by, amount_paid
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id
        `,
        [
          patientId,
          schedule.scheduledDate,
          schedule.startTime,
          schedule.endTime,
          schedule.reason,
          status,
          schedule.notes,
          doctor.doctorId,
          req.user.id,
          schedule.amountPaid,
        ],
      );
      await client.query('COMMIT');
      const reservation = await findReservation(created.rows[0].id);
      const overlaps = await overlapsFor(reservation);
      res.status(201).json({ reservation, overlaps });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }),
);

function clinicNow() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

function sessionEnded(reservation) {
  const end = new Date(`${reservation.scheduledDate}T${reservation.endTime}`);
  return !Number.isNaN(end.getTime()) && end.getTime() <= Date.now();
}

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const current = await findReservation(req.params.id);
    if (!current) throw fail(404, 'Visit not found.');
    const submitting = req.user.role === 'user';
    if (submitting) {
      if (req.body.status !== 'completed') throw fail(403, 'Submit the finished session.');
      if (current.status !== 'scheduled') {
        throw fail(400, 'That session is already closed.');
      }
      if (!sessionEnded(current)) throw fail(400, 'That session has not finished yet.');
    } else if (req.user.role !== 'admin' && req.user.role !== 'sub-admin') {
      throw fail(403, 'Your role cannot do that.');
    }
    const next = submitting
      ? {
          scheduledDate: current.scheduledDate,
          startTime: current.startTime,
          endTime: current.endTime,
          reason: current.reason,
          notes: req.body.notes === undefined ? current.notes : text(req.body.notes, 2000, 'Notes'),
          status: 'completed',
          amountPaid: current.amountPaid,
        }
      : {
          scheduledDate: req.body.scheduledDate ?? current.scheduledDate,
          startTime: req.body.startTime ?? current.startTime,
          endTime: req.body.endTime ?? current.endTime,
          reason: req.body.reason === undefined ? current.reason : text(req.body.reason, 200, 'Reason'),
          notes: req.body.notes === undefined ? current.notes : text(req.body.notes, 2000, 'Notes'),
          status: req.body.status ?? current.status,
          amountPaid: req.body.amountPaid === undefined ? current.amountPaid : money(req.body.amountPaid, 'Amount paid'),
        };
    if (!isDate(next.scheduledDate) || !isTime(next.startTime) || !isTime(next.endTime)) {
      throw fail(400, 'Check the date and times.');
    }
    if (minutes(next.endTime) <= minutes(next.startTime)) {
      throw fail(400, 'The visit has to end after it starts.');
    }
    if (!['scheduled', 'completed', 'cancelled'].includes(next.status)) {
      throw fail(400, 'Unknown visit status.');
    }
    await pool.query(
      `
      UPDATE reservations
      SET scheduled_date = $1, start_time = $2, end_time = $3, reason = $4, notes = $5, status = $6, amount_paid = $7
      WHERE id = $8
      `,
      [next.scheduledDate, next.startTime, next.endTime, next.reason, next.notes, next.status, next.amountPaid, req.params.id],
    );
    const reservation = await findReservation(req.params.id);
    res.json({ reservation, overlaps: await overlapsFor(reservation) });
  }),
);

router.delete(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { rowCount } = await pool.query('DELETE FROM reservations WHERE id = $1', [req.params.id]);
    if (!rowCount) throw fail(404, 'Visit not found.');
    res.json({ ok: true });
  }),
);

module.exports = router;
