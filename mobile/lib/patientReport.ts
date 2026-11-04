import { ageFrom, formatClock, formatLong, formatStamp, hasSessionQuota, remainingSessions, todayISO } from './format';
import type { Patient, Reservation, User } from './types';

const STATUS_LABEL: Record<Reservation['status'], string> = {
  scheduled: 'Scheduled',
  arrived: 'In clinic',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function block(value: string | null | undefined, empty: string) {
  const text = value?.trim();
  if (!text) return `<p class="empty">${escapeHtml(empty)}</p>`;
  return `<p class="prose">${escapeHtml(text)}</p>`;
}

export function patientReportHtml(patient: Patient, visits: Reservation[], author?: User | null) {
  const kept = visits.filter((visit) => visit.status !== 'cancelled');
  const taken = visits.filter((visit) => visit.status === 'completed');
  const ahead = visits.filter((visit) => visit.status === 'scheduled' || visit.status === 'arrived');
  const cancelled = visits.filter((visit) => visit.status === 'cancelled');
  const started = [...kept].sort(
    (left, right) => left.scheduledDate.localeCompare(right.scheduledDate) || left.startTime.localeCompare(right.startTime),
  )[0];
  const age = ageFrom(patient.dateOfBirth);
  const remaining = remainingSessions(patient.sessionsAllotted, patient.sessionCount);
  const identity = [
    age != null ? `${age} years` : null,
    patient.gender,
    patient.dateOfBirth ? formatLong(patient.dateOfBirth) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const contact = [patient.phone, patient.email].filter(Boolean).join(' · ');
  const quota = hasSessionQuota(patient.patientType)
    ? remaining == null
      ? 'No session number on file.'
      : `${patient.sessionCount ?? 0} of ${patient.sessionsAllotted} used · ${remaining} remaining`
    : null;

  const sessions = [...visits]
    .sort((left, right) => left.scheduledDate.localeCompare(right.scheduledDate) || left.startTime.localeCompare(right.startTime))
    .map((visit) => {
      const note = visit.notes?.trim();
      return `
        <article class="visit">
          <header>
            <div>
              <h3>${escapeHtml(formatLong(visit.scheduledDate))}</h3>
              <p class="when">Start ${escapeHtml(formatClock(visit.startTime))} · until ${escapeHtml(formatClock(visit.endTime))}</p>
            </div>
            <span class="status ${visit.status}">${STATUS_LABEL[visit.status]}</span>
          </header>
          <dl>
            <div><dt>Clinician</dt><dd>${escapeHtml(visit.doctorName || 'Not recorded')}</dd></div>
            <div><dt>Reason</dt><dd>${escapeHtml(visit.reason?.trim() || 'Not recorded')}</dd></div>
          </dl>
          <h4>Session note</h4>
          ${note ? `<p class="prose">${escapeHtml(note)}</p>` : '<p class="empty">No note for this session.</p>'}
        </article>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Halden report — ${escapeHtml(patient.fullName)}</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #e7f3f4; color: #123033; font: 16px/1.5 "Segoe UI", sans-serif; }
    main { max-width: 800px; margin: 32px auto; background: #fff; padding: 40px 48px 56px; }
    h1 { margin: 0; font-family: Georgia, serif; font-size: 32px; font-weight: 600; }
    h2 { margin: 32px 0 12px; font-size: 13px; letter-spacing: 0.14em; text-transform: uppercase; color: #0f5c5e; }
    h3 { margin: 0; font-size: 18px; }
    h4 { margin: 12px 0 4px; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #5c7576; }
    p { margin: 0; }
    .kicker { margin: 0 0 8px; font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase; color: #0f5c5e; }
    .meta { margin-top: 8px; color: #5c7576; }
    .facts { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 24px; margin: 0; }
    .facts div { padding-top: 10px; border-top: 1px solid #c9e4e4; }
    dt { font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #5c7576; }
    dd { margin: 2px 0 0; font-size: 16px; }
    .prose { white-space: pre-wrap; }
    .empty { color: #5c7576; }
    .visit { margin-top: 16px; padding-top: 16px; border-top: 1px solid #c9e4e4; }
    .visit header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
    .when { margin-top: 4px; color: #5c7576; }
    .status { border-radius: 999px; padding: 4px 10px; font-size: 12px; white-space: nowrap; }
    .completed { background: #e7f3f4; color: #125e60; }
    .scheduled { background: #e5f7f7; color: #0f5c5e; }
    .arrived { background: #fff3e4; color: #8a4e12; }
    .cancelled { background: #fdecec; color: #9b3b36; }
    .actions { margin-top: 28px; }
    button { background: #0f5c5e; color: #fff; border: 0; border-radius: 12px; padding: 12px 16px; font: 600 15px "Segoe UI", sans-serif; cursor: pointer; }
    @media print {
      body { background: #fff; }
      main { margin: 0; max-width: none; padding: 0; }
      .actions { display: none; }
    }
  </style>
</head>
<body>
  <main>
    <p class="kicker">Halden Clinic</p>
    <h1>${escapeHtml(patient.fullName)}</h1>
    <p class="meta">${escapeHtml(identity || 'No date of birth on file')}</p>
    <p class="meta">${escapeHtml(contact || 'No phone or email')}</p>
    <p class="meta">Prepared ${escapeHtml(formatLong(todayISO()))}${author?.name ? ` by ${escapeHtml(author.name)}` : ''}</p>

    <h2>Care</h2>
    <dl class="facts">
      <div><dt>Date started</dt><dd>${started ? escapeHtml(formatLong(started.scheduledDate)) : 'Not started'}</dd></div>
      <div><dt>Sessions</dt><dd>${kept.length}</dd></div>
      <div><dt>Completed</dt><dd>${taken.length}</dd></div>
      <div><dt>Still booked</dt><dd>${ahead.length}</dd></div>
      <div><dt>Cancelled</dt><dd>${cancelled.length}</dd></div>
      <div><dt>Specialty</dt><dd>${escapeHtml(patient.therapyType || 'Not recorded')}</dd></div>
      <div><dt>Clinician</dt><dd>${escapeHtml(patient.doctorName || 'Not recorded')}</dd></div>
      <div><dt>Coverage</dt><dd>${escapeHtml(patient.patientType || 'Private')}</dd></div>
      ${quota ? `<div><dt>Session plan</dt><dd>${escapeHtml(quota)}</dd></div>` : ''}
      ${patient.createdAt ? `<div><dt>On file since</dt><dd>${escapeHtml(formatStamp(patient.createdAt))}</dd></div>` : ''}
    </dl>

    <h2>Case notes</h2>
    ${block(patient.notes, 'No case notes.')}

    <h2>Sessions</h2>
    ${sessions || '<p class="empty">No sessions yet.</p>'}

    <div class="actions">
      <button type="button" onclick="window.print()">Print or save as PDF</button>
    </div>
  </main>
</body>
</html>`;
}
