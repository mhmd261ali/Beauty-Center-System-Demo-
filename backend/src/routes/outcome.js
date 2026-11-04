const express = require('express');

const { pool } = require('../db');
const { requireAuth, requireRole } = require('../auth');
const { asyncHandler, fail, money, text } = require('../http');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

const MONTH = /^\d{4}-\d{2}$/;
const CATEGORIES = [
  { key: 'salaries', label: 'Salaries' },
  { key: 'rent', label: 'Rent' },
  { key: 'services', label: 'Services' },
  { key: 'equipment', label: 'Equipment' },
];
const MANUAL = new Set(['salaries', 'rent', 'services']);

function monthInstants(month) {
  const [year, part] = month.split('-').map(Number);
  return [new Date(year, part - 1, 1).toISOString(), new Date(year, part, 1).toISOString()];
}

async function report(month) {
  const priced = monthInstants(month);
  const [payments, equipment] = await Promise.all([
    pool.query(
      `
      SELECT id, category, label, staff_id AS "staffId", amount::float8 AS amount
      FROM outcome_payments
      WHERE month = $1
      ORDER BY created_at DESC, id DESC
      `,
      [month],
    ),
    pool.query(
      `
      SELECT
        i.id,
        i.name,
        i.therapy_type AS "therapyType",
        i.price::float8 AS amount
      FROM instruments i
      WHERE i.price > 0
        AND i.priced_at >= $1::timestamptz
        AND i.priced_at < $2::timestamptz
      ORDER BY i.priced_at DESC, i.name
      `,
      priced,
    ),
  ]);

  const categories = CATEGORIES.map((category) => {
    if (category.key === 'equipment') {
      const items = equipment.rows.map((row) => ({
        id: row.id,
        label: row.name,
        therapyType: row.therapyType,
        amount: Number(row.amount) || 0,
      }));
      return {
        ...category,
        total: items.reduce((sum, item) => sum + item.amount, 0),
        items,
      };
    }
    const items = payments.rows
      .filter((row) => row.category === category.key)
      .map((row) => ({
        id: row.id,
        label: row.label,
        staffId: row.staffId,
        amount: Number(row.amount) || 0,
      }));
    return {
      ...category,
      total: items.reduce((sum, item) => sum + item.amount, 0),
      items,
    };
  });

  return {
    month,
    total: categories.reduce((sum, category) => sum + category.total, 0),
    categories,
  };
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const month = String(req.query.month || '').trim();
    if (!MONTH.test(month)) throw fail(400, 'Choose a month.');
    res.json(await report(month));
  }),
);

async function paymentRow(client, month, payment, userId) {
  const category = String(payment.category || '').trim();
  const amount = money(payment.amount, 'Amount');
  if (!MANUAL.has(category)) throw fail(400, 'Choose salaries, rent, or services.');
  if (amount == null) throw fail(400, 'Enter the amount.');
  if (category === 'salaries') {
    const staffId = Number(payment.staffId);
    if (!Number.isInteger(staffId)) throw fail(400, 'Choose who was paid.');
    const found = await client.query('SELECT id, name FROM users WHERE id = $1', [staffId]);
    if (!found.rows[0]) throw fail(400, 'Choose who was paid.');
    await client.query(
      `
      INSERT INTO outcome_payments (month, category, label, amount, staff_id, created_by)
      VALUES ($1, 'salaries', $2, $3, $4, $5)
      `,
      [month, found.rows[0].name, amount, found.rows[0].id, userId],
    );
    return;
  }
  const label = text(payment.label, 160, 'Label');
  if (!label) throw fail(400, 'Say what this payment was for.');
  await client.query(
    `
    INSERT INTO outcome_payments (month, category, label, amount, created_by)
    VALUES ($1, $2, $3, $4, $5)
    `,
    [month, category, label, amount, userId],
  );
}

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const month = String(req.body.month || '').trim();
    const payments = Array.isArray(req.body.payments) ? req.body.payments : [req.body];
    if (!MONTH.test(month)) throw fail(400, 'Choose a month.');
    if (!payments.length) throw fail(400, 'Add a payment.');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const payment of payments) {
        await paymentRow(client, month, payment, req.user.id);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    res.status(201).json(await report(month));
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const month = String(req.query.month || '').trim();
    if (!MONTH.test(month)) throw fail(400, 'Choose a month.');
    const { rows } = await pool.query(
      'DELETE FROM outcome_payments WHERE id = $1 AND month = $2 RETURNING id',
      [req.params.id, month],
    );
    if (!rows[0]) throw fail(404, 'That payment was not found.');
    res.json(await report(month));
  }),
);

module.exports = router;
