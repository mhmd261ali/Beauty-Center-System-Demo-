const express = require('express');

const { pool } = require('../db');
const { THERAPIES } = require('../care');
const { requireAuth, requireRole } = require('../auth');
const { asyncHandler, fail } = require('../http');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

const MONTH = /^\d{4}-\d{2}$/;
const TYPES = ['Private', 'Company', 'Islamic'];

function monthBounds(month) {
  const [year, part] = month.split('-').map(Number);
  const last = new Date(year, part, 0).getDate();
  return {
    from: `${month}-01`,
    to: `${month}-${String(last).padStart(2, '0')}`,
  };
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const month = String(req.query.month || '').trim();
    if (!MONTH.test(month)) throw fail(400, 'Choose a month.');
    const { from, to } = monthBounds(month);
    const { rows } = await pool.query(
      `
      SELECT
        to_char(r.scheduled_date, 'YYYY-MM-DD') AS date,
        to_char(r.start_time, 'HH24:MI') AS "startTime",
        r.amount_paid::float8 AS amount,
        p.full_name AS "patientName",
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
      WHERE r.scheduled_date >= $1::date
        AND r.scheduled_date <= $2::date
        AND r.status <> 'cancelled'
        AND r.amount_paid IS NOT NULL
      ORDER BY r.scheduled_date DESC, r.start_time, r.id
      `,
      [from, to, THERAPIES],
    );

    const categories = TYPES.map((type) => {
      const payments = rows.filter((row) => row.patientType === type);
      const days = [];
      const seen = new Map();
      payments.forEach((row) => {
        let day = seen.get(row.date);
        if (!day) {
          day = { date: row.date, total: 0, paid: [] };
          seen.set(row.date, day);
          days.push(day);
        }
        const amount = Number(row.amount) || 0;
        day.total += amount;
        day.paid.push({
          patientName: row.patientName,
          amount,
          startTime: row.startTime,
          therapyType: row.therapyType,
        });
      });
      return {
        type,
        total: days.reduce((sum, day) => sum + day.total, 0),
        days,
      };
    });

    res.json({
      month,
      from,
      to,
      total: categories.reduce((sum, item) => sum + item.total, 0),
      categories,
    });
  }),
);

module.exports = router;
