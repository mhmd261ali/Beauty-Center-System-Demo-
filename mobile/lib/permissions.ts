import type { Role } from './types';
import { PATIENT_TYPES } from './format';

export function ownSpecialty(user: { role: Role; therapyType?: string | null } | null | undefined) {
  if (!user || user.role !== 'user') return null;
  return user.therapyType ?? '';
}

export function specialtiesFor(user: { role: Role; therapyType?: string | null } | null | undefined) {
  const own = ownSpecialty(user);
  if (own == null) return PATIENT_TYPES;
  return own ? PATIENT_TYPES.filter((item) => item === own) : [];
}

export function canEdit(role: Role) {
  return role === 'admin' || role === 'sub-admin';
}

export function canDelete(role: Role) {
  return role === 'admin';
}

export function canUpload(role: Role) {
  return role === 'admin' || role === 'sub-admin';
}

export function canManageStaff(role: Role) {
  return role === 'admin';
}

export function canSeeIncome(role: Role) {
  return role === 'admin';
}
