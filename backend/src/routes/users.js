const express = require('express');
const bcrypt = require('bcryptjs');

const { pool } = require('../db');
const { requireAuth, requireRole } = require('../auth');
const { asyncHandler, fail, EMAIL, ROLES, text } = require('../http');
const { THERAPY_SET } = require('../care');
const { domainOf } = require('../scope');

const router = express.Router();
router.use(requireAuth);

const userColumns = `
  id, name, email, phone, role, therapy_type AS "therapyType", created_at AS "createdAt"
`;

function accountInput(body, passwordRequired) {
  const name = text(body.name, 120, 'Name');
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const role = String(body.role || '');
  const phone = text(body.phone, 40, 'Phone');
  const therapyType = text(body.therapyType, 80, 'Specialty');
  if (!name) throw fail(400, 'Enter a name.');
  if (!EMAIL.test(email)) throw fail(400, 'Enter a valid email.');
  if (passwordRequired || password) {
    if (password.length < 6) throw fail(400, 'Use a password of at least 6 characters.');
  }
  if (passwordRequired && (!phone || phone.length < 3)) throw fail(400, 'Enter a phone number.');
  if (!passwordRequired && phone && phone.length < 3) throw fail(400, 'Enter a phone number.');
  if (!ROLES.includes(role)) throw fail(400, 'Choose admin, sub-admin, or user.');
  if (therapyType && !THERAPY_SET.has(therapyType)) throw fail(400, 'Choose a specialty.');
  return { name, email, password, role, phone, therapyType };
}

router.get(
  '/',
  requireRole('admin', 'sub-admin', 'user'),
  asyncHandler(async (req, res) => {
    const domain = await domainOf(req);
    const { rows } = await pool.query(
      `
      SELECT ${userColumns}
      FROM users
      WHERE ($1::text IS NULL OR therapy_type = $1)
      ORDER BY name
      `,
      [domain],
    );
    res.json({ users: rows });
  }),
);

router.post(
  '/',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const account = accountInput(req.body, true);
    const { rows } = await pool.query(
      `
      INSERT INTO users (name, email, password_hash, role, phone, therapy_type)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING ${userColumns}
      `,
      [account.name, account.email, bcrypt.hashSync(account.password, 10), account.role, account.phone, account.therapyType],
    );
    res.status(201).json({ user: rows[0] });
  }),
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const own = Number(req.params.id) === req.user.id;
    if (req.user.role !== 'admin' && !own) throw fail(403, 'Your role cannot do that.');
    const existing = await pool.query(
      'SELECT role, therapy_type AS "therapyType" FROM users WHERE id = $1',
      [req.params.id],
    );
    if (!existing.rows[0]) throw fail(404, 'Account not found.');
    const account = accountInput(req.body, false);
    if (req.user.role !== 'admin') {
      account.role = existing.rows[0].role;
      account.therapyType = existing.rows[0].therapyType;
    }
    const values = [account.name, account.email, account.phone, account.role, account.therapyType];
    let passwordSql = '';
    if (account.password) {
      values.push(bcrypt.hashSync(account.password, 10));
      passwordSql = `, password_hash = $${values.length}`;
    }
    values.push(req.params.id);
    const { rows } = await pool.query(
      `
      UPDATE users
      SET name = $1, email = $2, phone = $3, role = $4, therapy_type = $5${passwordSql}
      WHERE id = $${values.length}
      RETURNING ${userColumns}
      `,
      values,
    );
    if (!rows.length) throw fail(404, 'Account not found.');
    res.json({ user: rows[0] });
  }),
);

router.delete(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    if (Number(req.params.id) === req.user.id) {
      throw fail(400, 'You cannot remove your own account.');
    }
    const { rowCount } = await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    if (!rowCount) throw fail(404, 'Account not found.');
    res.json({ ok: true });
  }),
);

module.exports = router;
