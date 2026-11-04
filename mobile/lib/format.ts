export const WIDE = 960;

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const DURATIONS = [15, 20, 30, 45, 60, 90, 120, 150, 180];

export const PATIENT_TYPES = ['General practice', 'Pediatrics', 'Physiotherapy', 'Occupational therapy', 'Speech therapy'];

export const GENDERS = ['Male', 'Female'] as const;

export const PAYER_TYPES = ['Private', 'Insurance', 'Company'] as const;

export function hasSessionQuota(type?: string | null) {
  return type === 'Company' || type === 'Insurance';
}

export function remainingSessions(allotted?: number | null, used?: number | null) {
  if (allotted == null) return null;
  return Math.max(0, allotted - (used ?? 0));
}

export function sessionQuotaLabel(used?: number | null, allotted?: number | null) {
  const taken = used ?? 0;
  if (allotted == null) {
    return `${taken} ${taken === 1 ? 'session' : 'sessions'}`;
  }
  return `${taken} of ${allotted} ${allotted === 1 ? 'session' : 'sessions'}`;
}

export const START_TIMES = Array.from({ length: 25 }, (_, index) => {
  const minutes = 7 * 60 + index * 30;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
});

export function toISO(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function todayISO() {
  return toISO(new Date());
}

export function parseISO(iso: string) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(iso: string, days: number) {
  const date = parseISO(iso);
  date.setDate(date.getDate() + days);
  return toISO(date);
}

export function formatClock(hhmm: string) {
  const [hours, mins] = hhmm.split(':').map(Number);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${String(mins).padStart(2, '0')} ${suffix}`;
}

export function addMinutes(hhmm: string, amount: number) {
  const [hours, mins] = hhmm.split(':').map(Number);
  const total = hours * 60 + mins + amount;
  if (total < 0 || total >= 24 * 60) return null;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function formatLong(iso: string) {
  return parseISO(iso).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatDay(iso: string) {
  return parseISO(iso).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function formatStamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function monthLabel(year: number, month: number) {
  return new Date(year, month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export function monthCells(year: number, month: number) {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - lead);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

export function ageFrom(dob: string | null) {
  if (!dob) return null;
  const born = parseISO(dob);
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  const nowKey = (now.getMonth() + 1) * 100 + now.getDate();
  const bornKey = (born.getMonth() + 1) * 100 + born.getDate();
  if (nowKey < bornKey) age -= 1;
  return age;
}

export function formatMoney(value: number | null | undefined) {
  const amount = Number(value) || 0;
  return amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function monthISO(year: number, monthIndex: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}

export function shiftMonthISO(month: string, amount: number) {
  const [year, part] = month.split('-').map(Number);
  const date = new Date(year, part - 1 + amount, 1);
  return monthISO(date.getFullYear(), date.getMonth());
}

export function minutesOf(hhmm: string) {
  const [hours, mins] = hhmm.split(':').map(Number);
  return hours * 60 + mins;
}
