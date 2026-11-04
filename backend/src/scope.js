const { pool } = require('./db');
const { fail } = require('./http');

async function domainOf(req) {
  const { rows } = await pool.query(
    'SELECT role, therapy_type AS "therapyType" FROM users WHERE id = $1',
    [req.user.id],
  );
  const user = rows[0];
  if (!user || user.role !== 'user') return null;
  return user.therapyType || '';
}

function assertDomain(domain, therapyType, message) {
  if (domain == null) return;
  if (!therapyType || therapyType !== domain) {
    throw fail(403, message || 'That is outside your specialty.');
  }
}

module.exports = { domainOf, assertDomain };
