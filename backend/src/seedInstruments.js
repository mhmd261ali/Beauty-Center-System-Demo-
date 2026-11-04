const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ITEMS = [
  ['General practice', 'Stethoscope', 'Listening to the heart, lungs, and abdomen.', [61, 92, 158]],
  ['General practice', 'Blood pressure cuff', 'Routine pressure checks at the start of a visit.', [30, 64, 120]],
  ['Pediatrics', 'Otoscope', 'Looking in the ears during a child visit.', [140, 72, 140]],
  ['Pediatrics', 'Growth chart', 'Tracking height and weight against age.', [196, 150, 196]],
  ['Occupational therapy', 'Weighted vest', 'Gives steady pressure so a child can sit and work.', [75, 187, 188]],
  ['Occupational therapy', 'Therapy putty', 'Builds hand strength, pinch, and finger isolation.', [15, 92, 94]],
  ['Occupational therapy', 'Sensory brush', 'Deep pressure before a session to help regulation.', [154, 220, 220]],
  ['Occupational therapy', 'Pegboard', 'Fine motor control and grading of force.', [212, 241, 240]],
  ['Speech therapy', 'Picture cards', 'Naming, describing, and building sentences.', [224, 154, 69]],
  ['Speech therapy', 'Oral motor kit', 'Lip, jaw, and tongue exercises.', [138, 78, 18]],
  ['Speech therapy', 'Articulation mirror', 'Lets the patient see how sounds are made.', [240, 203, 160]],
  ['Speech therapy', 'Story sequence cards', 'Practice narrative order and retelling.', [255, 228, 196]],
  ['Physiotherapy', 'Gait belt', 'Safe support during standing and walking.', [61, 154, 98]],
  ['Physiotherapy', 'Resistance bands', 'Strength and stretch work for limbs and core.', [27, 107, 64]],
  ['Physiotherapy', 'Balance pad', 'Stability, ankle control, and proprioception.', [163, 212, 180]],
  ['Physiotherapy', 'Therapy ball', 'Core work, sitting balance, and weight shift.', [212, 240, 220]],
];

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i += 1) {
    crc ^= buf[i];
    for (let k = 0; k < 8; k += 1) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const payload = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(payload));
  return Buffer.concat([len, payload, crc]);
}

function solidPng(size, [r, g, b]) {
  const stride = size * 3 + 1;
  const raw = Buffer.alloc(stride * size);
  const inner = Math.round(size * 0.18);
  for (let y = 0; y < size; y += 1) {
    const row = y * stride;
    raw[row] = 0;
    for (let x = 0; x < size; x += 1) {
      const edge = x < inner || y < inner || x >= size - inner || y >= size - inner;
      const i = row + 1 + x * 3;
      raw[i] = edge ? Math.max(0, r - 28) : r;
      raw[i + 1] = edge ? Math.max(0, g - 28) : g;
      raw[i + 2] = edge ? Math.max(0, b - 28) : b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

async function seedInstruments(query, adminId, uploadsDir) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  for (const [therapyType, name, usedFor, color] of ITEMS) {
    const found = await query('SELECT id FROM instruments WHERE therapy_type = $1 AND name = $2', [therapyType, name]);
    if (found.rows[0]) continue;
    const storedName = `seed-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
    fs.writeFileSync(path.join(uploadsDir, storedName), solidPng(192, color));
    await query(
      `
      INSERT INTO instruments (therapy_type, name, used_for, file_name, stored_name, mime_type, added_by)
      VALUES ($1, $2, $3, $4, $5, 'image/png', $6)
      `,
      [therapyType, name, usedFor, `${name}.png`, storedName, adminId],
    );
  }
}

module.exports = { seedInstruments, ITEMS };
