const express = require('express');

const { pool } = require('../db');
const { requireAuth } = require('../auth');
const { THERAPY_SET } = require('../care');
const { asyncHandler, fail } = require('../http');

const router = express.Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const therapy = typeof req.query.therapy === 'string' ? req.query.therapy.trim() : '';
    if (therapy && !THERAPY_SET.has(therapy)) throw fail(400, 'Choose a therapy type.');
    const params = [];
    let where = 'WHERE therapy_type IS NOT NULL';
    if (therapy) {
      params.push(therapy);
      where += ' AND therapy_type = $1';
    }
    const { rows } = await pool.query(
      `
      SELECT id, name, therapy_type AS "therapyType"
      FROM users
      ${where}
      ORDER BY therapy_type, name
      `,
      params,
    );
    res.json({ doctors: rows });
  }),
);

module.exports = router;
