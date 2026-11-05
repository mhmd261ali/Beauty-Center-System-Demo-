const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');

const { pool } = require('../db');
const { requireAuth, requireRole } = require('../auth');
const { asyncHandler, fail, text } = require('../http');
const { uploadsDir } = require('../paths');

const ALLOWED = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/rtf',
  'application/octet-stream',
]);

fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, uploadsDir),
    filename: (_req, file, callback) => {
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
      callback(null, `${Date.now()}-${safe || 'document'}`);
    },
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED.has(file.mimetype)) {
      callback(fail(400, 'Use a PDF, image, text, or Word file.'));
      return;
    }
    callback(null, true);
  },
});

const router = express.Router();
router.use(requireAuth);

const documentSelect = `
  SELECT
    d.id,
    d.name,
    d.description,
    d.patient_id AS "patientId",
    p.full_name AS "patientName",
    d.staff_id AS "staffId",
    s.name AS "staffName",
    COALESCE(p.therapy_type, s.therapy_type) AS "therapyType",
    d.file_name AS "fileName",
    d.stored_name AS "storedName",
    d.mime_type AS "mimeType",
    d.uploaded_by AS "uploadedById",
    u.name AS "uploadedByName",
    to_char(d.created_at AT TIME ZONE 'Asia/Beirut', 'YYYY-MM-DD') AS "createdDate",
    d.created_at AS "createdAt"
  FROM documents d
  LEFT JOIN patients p ON p.id = d.patient_id
  LEFT JOIN users s ON s.id = d.staff_id
  LEFT JOIN users u ON u.id = d.uploaded_by
`;

router.get(
  '/people',
  asyncHandler(async (_req, res) => {
    const [patients, staff] = await Promise.all([
      pool.query(
        `
        SELECT
          p.id,
          p.full_name AS "fullName",
          p.therapy_type AS "therapyType",
          (
            SELECT COUNT(*)::int
            FROM documents d
            WHERE d.patient_id = p.id AND d.stored_name IS NOT NULL
          ) AS documents
        FROM patients p
        ORDER BY p.full_name
        `,
      ),
      pool.query(
        `
        SELECT
          u.id,
          u.name,
          u.therapy_type AS "therapyType",
          (
            SELECT COUNT(*)::int
            FROM documents d
            WHERE d.staff_id = u.id AND d.stored_name IS NOT NULL
          ) AS documents
        FROM users u
        ORDER BY u.name
        `,
      ),
    ]);
    res.json({ patients: patients.rows, staff: staff.rows });
  }),
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const term = String(req.query.q || '').trim();
    const pattern = term ? `%${term}%` : null;
    const patientId = req.query.patientId ? Number(req.query.patientId) : null;
    const staffId = req.query.staffId ? Number(req.query.staffId) : null;
    if (req.query.patientId && !Number.isInteger(patientId)) throw fail(400, 'Unknown patient.');
    if (req.query.staffId && !Number.isInteger(staffId)) throw fail(400, 'Unknown staff member.');
    const archive = req.query.archive === '1';
    const { rows } = await pool.query(
      `
      ${documentSelect}
      WHERE d.stored_name IS NOT NULL
        AND ($1::text IS NULL OR d.name ILIKE $1)
        AND ($2::int IS NULL OR d.patient_id = $2)
        AND ($3::int IS NULL OR d.staff_id = $3)
        AND ($4::boolean = false OR (d.patient_id IS NULL AND d.staff_id IS NULL))
      ORDER BY d.created_at DESC
      LIMIT 200
      `,
      [pattern, patientId, staffId, archive],
    );
    res.json({
      documents: rows.map(({ storedName, ...document }) => document),
    });
  }),
);

router.post(
  '/',
  requireRole('admin', 'sub-admin'),
  (req, res, next) => {
    upload.single('file')(req, res, (error) => {
      if (!error) return next();
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Files must be 15 MB or smaller.' });
      }
      if (error.status) return res.status(error.status).json({ error: error.message });
      return next(error);
    });
  },
  asyncHandler(async (req, res) => {
    const name = text(req.body.name, 160, 'Document name');
    if (!name) throw fail(400, 'Name the document.');
    if (!req.file) throw fail(400, 'Attach a file.');
    const description = text(req.body.description, 2000, 'Description');
    let patientId = null;
    let staffId = null;
    if (req.body.patientId && req.body.staffId) throw fail(400, 'Choose a patient or a staff member, not both.');
    if (req.body.patientId) {
      patientId = Number(req.body.patientId);
      if (!Number.isInteger(patientId)) throw fail(400, 'Unknown patient.');
      const found = await pool.query('SELECT id FROM patients WHERE id = $1', [patientId]);
      if (!found.rows[0]) throw fail(404, 'Patient not found.');
    }
    if (req.body.staffId) {
      staffId = Number(req.body.staffId);
      if (!Number.isInteger(staffId)) throw fail(400, 'Unknown staff member.');
      const found = await pool.query('SELECT id FROM users WHERE id = $1', [staffId]);
      if (!found.rows[0]) throw fail(404, 'Staff member not found.');
    }
    const { rows } = await pool.query(
      `
      INSERT INTO documents (name, description, patient_id, staff_id, file_name, stored_name, mime_type, uploaded_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
      `,
      [
        name,
        description,
        patientId,
        staffId,
        req.file ? req.file.originalname : null,
        req.file ? req.file.filename : null,
        req.file ? req.file.mimetype : null,
        req.user.id,
      ],
    );
    const created = await pool.query(`${documentSelect} WHERE d.id = $1`, [rows[0].id]);
    const { storedName, ...document } = created.rows[0];
    res.status(201).json({ document });
  }),
);

router.get(
  '/:id/file',
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      'SELECT file_name, stored_name FROM documents WHERE id = $1',
      [req.params.id],
    );
    const row = rows[0];
    if (!row || !row.stored_name) throw fail(404, 'That document has no file.');
    const full = path.resolve(uploadsDir, path.basename(row.stored_name));
    if (!full.startsWith(path.resolve(uploadsDir))) throw fail(400, 'Cannot open that file.');
    if (!fs.existsSync(full)) throw fail(404, 'The file is missing from the server.');
    res.download(full, row.file_name || 'document');
  }),
);

router.delete(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      'DELETE FROM documents WHERE id = $1 RETURNING stored_name',
      [req.params.id],
    );
    if (!rows[0]) throw fail(404, 'Document not found.');
    if (rows[0].stored_name) {
      const full = path.resolve(uploadsDir, path.basename(rows[0].stored_name));
      if (full.startsWith(path.resolve(uploadsDir)) && fs.existsSync(full)) fs.unlinkSync(full);
    }
    res.json({ ok: true });
  }),
);

module.exports = router;
