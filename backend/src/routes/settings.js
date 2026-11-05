const express = require('express');

const { pool } = require('../db');
const { requireAuth, requireRole } = require('../auth');
const { asyncHandler, fail, isTime, text } = require('../http');
const { listTherapies } = require('../care');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

const REMINDER_HOURS = [1, 2, 6, 12, 24, 48];
const REMINDER_TIMES = ['07:00', '08:00', '09:00', '12:00', '16:00', '17:00', '18:00', '19:00', '20:00'];

async function readSettings() {
  const { rows } = await pool.query(
    `
    SELECT
      reminder_mode AS mode,
      reminder_hours AS "reminderHours",
      to_char(reminder_time, 'HH24:MI') AS "reminderTime"
    FROM clinic_settings
    WHERE id = 1
    `,
  );
  const row = rows[0];
  return {
    mode: row && row.mode === 'tomorrow' ? 'tomorrow' : 'before',
    reminderHours: row ? Number(row.reminderHours) : 24,
    reminderTime: row?.reminderTime || '18:00',
  };
}

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json({ settings: await readSettings(), choices: REMINDER_HOURS, times: REMINDER_TIMES });
  }),
);

router.patch(
  '/',
  asyncHandler(async (req, res) => {
    const mode = req.body.mode === 'tomorrow' ? 'tomorrow' : 'before';
    const reminderHours = Number(req.body.reminderHours);
    const reminderTime = String(req.body.reminderTime || '').trim();
    if (mode === 'before' && !REMINDER_HOURS.includes(reminderHours)) {
      throw fail(400, 'Choose 1, 2, 6, 12, 24, or 48 hours.');
    }
    if (mode === 'tomorrow' && (!isTime(reminderTime) || !REMINDER_TIMES.includes(reminderTime))) {
      throw fail(400, 'Choose a time for tomorrow’s reminders.');
    }
    const current = await readSettings();
    await pool.query(
      `
      INSERT INTO clinic_settings (id, reminder_hours, reminder_mode, reminder_time)
      VALUES (1, $1, $2, $3)
      ON CONFLICT (id) DO UPDATE SET
        reminder_hours = EXCLUDED.reminder_hours,
        reminder_mode = EXCLUDED.reminder_mode,
        reminder_time = EXCLUDED.reminder_time
      `,
      [
        mode === 'before' ? reminderHours : current.reminderHours,
        mode,
        mode === 'tomorrow' ? reminderTime : current.reminderTime,
      ],
    );
    res.json({ settings: await readSettings() });
  }),
);

router.get(
  '/therapies',
  asyncHandler(async (_req, res) => {
    res.json({ therapies: await listTherapies() });
  }),
);

router.post(
  '/therapies',
  asyncHandler(async (req, res) => {
    const name = text(req.body.name, 80, 'Therapy');
    if (!name) throw fail(400, 'Name the therapy.');
    const existing = await pool.query('SELECT id FROM therapies WHERE lower(name) = lower($1)', [name]);
    if (existing.rows[0]) throw fail(409, 'That therapy is already on the list.');
    const { rows } = await pool.query('INSERT INTO therapies (name) VALUES ($1) RETURNING id, name', [name]);
    res.status(201).json({ therapy: rows[0], therapies: await listTherapies() });
  }),
);

module.exports = router;
