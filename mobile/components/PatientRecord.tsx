import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { addMinutes, ageFrom, DURATIONS, formatLong, PATIENT_TYPES, PAYER_TYPES, START_TIMES, hasSessionQuota, latinRun, remainingSessions, todayISO } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { canEdit } from '../lib/permissions';
import type { Doctor, Patient, Reservation, VisitStatus } from '../lib/types';
import { SessionCounts, SessionList } from './SessionList';
import { Banner, Button, Chip, Field, TherapyPill, font, therapySurface } from './ui';

export function PatientRecord({ patientId, showBack }: { patientId: number; showBack?: boolean }) {
  const { user } = useAuth();
  const router = useRouter();
  const { t, nameAlign } = useI18n();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [visits, setVisits] = useState<Reservation[]>([]);
  const [notes, setNotes] = useState('');
  const [patientType, setPatientType] = useState<(typeof PAYER_TYPES)[number]>('Private');
  const [sessionsAllotted, setSessionsAllotted] = useState<number | null>(null);
  const [therapy, setTherapy] = useState<string | null>(null);
  const [doctorId, setDoctorId] = useState<number | null>(null);
  const [doctorName, setDoctorName] = useState<string | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [editingCare, setEditingCare] = useState(false);
  const [therapyChoice, setTherapyChoice] = useState<string | null>(null);
  const [doctorChoice, setDoctorChoice] = useState<number | null>(null);
  const [typeChoice, setTypeChoice] = useState<(typeof PAYER_TYPES)[number] | null>(null);
  const [allottedChoice, setAllottedChoice] = useState('');
  const [sessionDoctorId, setSessionDoctorId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [start, setStart] = useState('09:00');
  const [duration, setDuration] = useState(30);
  const [reason, setReason] = useState('');
  const [sessionNotes, setSessionNotes] = useState('');
  const [status, setStatus] = useState<VisitStatus>(user && canEdit(user.role) ? 'completed' : 'scheduled');
  const editable = user ? canEdit(user.role) : false;

  const load = useCallback(async () => {
    setError(null);
    try {
      const [person, history, roster] = await Promise.all([
        api.patient(patientId),
        api.reservations({ patientId }),
        api.doctors(),
      ]);
      const left = remainingSessions(person.patient.sessionsAllotted, person.patient.sessionCount);
      setPatient(person.patient);
      setNotes(person.patient.notes ?? '');
      setPatientType(person.patient.patientType === 'Company' || person.patient.patientType === 'Islamic' ? person.patient.patientType : 'Private');
      setSessionsAllotted(person.patient.sessionsAllotted ?? null);
      setAllottedChoice(left != null ? String(left) : '');
      setTherapy(person.patient.therapyType ?? null);
      setDoctorId(person.patient.doctorId ?? null);
      setDoctorName(person.patient.doctorName ?? null);
      setSessionDoctorId(person.patient.doctorId ?? null);
      setDoctors(roster.doctors);
      setEditingCare(false);
      setTherapyChoice(null);
      setDoctorChoice(null);
      setTypeChoice(null);
      setVisits(history.reservations);
    } catch (reasonError) {
      setError(reasonError instanceof Error ? reasonError.message : 'Could not load this patient.');
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function saveRecord(next?: {
    therapyType?: string | null;
    doctorId?: number | null;
    patientType?: (typeof PAYER_TYPES)[number];
    sessionsAllotted?: number | null;
  }) {
    if (!patient) return;
    const therapyType = next && 'therapyType' in next ? next.therapyType ?? null : therapy;
    const nextDoctorId = next && 'doctorId' in next ? next.doctorId ?? null : doctorId;
    const nextType = next && 'patientType' in next ? next.patientType ?? 'Private' : patientType;
    const nextAllotted =
      next && 'sessionsAllotted' in next
        ? next.sessionsAllotted ?? null
        : hasSessionQuota(nextType)
          ? sessionsAllotted
          : null;
    setError(null);
    try {
      const result = await api.updatePatient(patient.id, {
        ...patient,
        notes: notes.trim() || null,
        patientType: nextType,
        sessionsAllotted: hasSessionQuota(nextType) ? nextAllotted : null,
        therapyType,
        doctorId: nextDoctorId,
      });
      const left = remainingSessions(result.patient.sessionsAllotted, result.patient.sessionCount);
      setPatient(result.patient);
      setNotes(result.patient.notes ?? '');
      setPatientType(result.patient.patientType === 'Company' || result.patient.patientType === 'Islamic' ? result.patient.patientType : 'Private');
      setSessionsAllotted(result.patient.sessionsAllotted ?? null);
      setAllottedChoice(left != null ? String(left) : '');
      setTherapy(result.patient.therapyType ?? null);
      setDoctorId(result.patient.doctorId ?? null);
      setDoctorName(result.patient.doctorName ?? null);
      setSessionDoctorId(result.patient.doctorId ?? null);
      return true;
    } catch (reasonError) {
      setError(reasonError instanceof Error ? reasonError.message : 'Could not save the record.');
      return false;
    }
  }

  function beginCareEdit() {
    setTherapyChoice(therapy);
    setDoctorChoice(doctorId);
    setTypeChoice(patientType);
    const left = remainingSessions(sessionsAllotted, patient?.sessionCount);
    setAllottedChoice(left != null ? String(left) : '');
    setEditingCare(true);
  }

  function chooseTherapy(item: string) {
    setTherapyChoice(item);
    setDoctorChoice((current) => (doctors.some((doctor) => doctor.id === current && doctor.therapyType === item) ? current : null));
  }

  function cancelCareEdit() {
    setEditingCare(false);
    setTherapyChoice(null);
    setDoctorChoice(null);
    setTypeChoice(null);
    const left = remainingSessions(sessionsAllotted, patient?.sessionCount);
    setAllottedChoice(left != null ? String(left) : '');
  }

  async function saveCare() {
    if (!therapyChoice || !typeChoice) return;
    const covered = hasSessionQuota(typeChoice);
    const left = covered ? Number(allottedChoice.trim()) : null;
    if (covered && (allottedChoice.trim() === '' || !Number.isInteger(left) || (left ?? 0) < 0)) {
      setError('Enter how many sessions remain.');
      return;
    }
    const allotted = covered ? (patient?.sessionCount ?? 0) + (left ?? 0) : null;
    const saved = await saveRecord({
      therapyType: therapyChoice,
      doctorId: doctorChoice,
      patientType: typeChoice,
      sessionsAllotted: allotted,
    });
    if (saved) setEditingCare(false);
  }

  async function addSession() {
    const end = addMinutes(start, duration);
    if (!end) {
      setError('That session runs past midnight.');
      return;
    }
    if (therapy && !sessionDoctorId) {
      setError('Choose the doctor for this therapy.');
      return;
    }
    setError(null);
    try {
      await api.createReservation({
        patientId,
        scheduledDate: date,
        startTime: start,
        endTime: end,
        reason: reason.trim() || null,
        notes: sessionNotes.trim() || null,
        doctorId: sessionDoctorId,
        status: editable ? status : 'scheduled',
      });
      setReason('');
      setSessionNotes('');
      setAdding(false);
      await load();
    } catch (reasonError) {
      setError(reasonError instanceof Error ? reasonError.message : 'Could not add the session.');
    }
  }

  const today = todayISO();
  const notesChanged = (notes.trim() || null) !== (patient?.notes?.trim() || null);
  const remaining = remainingSessions(sessionsAllotted, patient?.sessionCount);
  const allottedDirty =
    hasSessionQuota(typeChoice) &&
    allottedChoice.trim() !== (remaining != null ? String(remaining) : '');
  const careChanged =
    therapyChoice !== therapy ||
    doctorChoice !== doctorId ||
    typeChoice !== patientType ||
    allottedDirty;
  const upcoming = visits.filter((visit) => visit.scheduledDate >= today && visit.status === 'scheduled');
  const history = visits
    .filter((visit) => !upcoming.some((item) => item.id === visit.id))
    .sort((left, right) => right.scheduledDate.localeCompare(left.scheduledDate) || right.startTime.localeCompare(left.startTime));
  const age = ageFrom(patient?.dateOfBirth ?? null);

  return (
    <ScrollView className="flex-1 bg-paper" contentContainerStyle={{ padding: 24, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
      {showBack ? (
        <Pressable accessibilityRole="button" onPress={() => router.back()} className="mb-4 self-start">
          <Text style={font.medium} className="text-sm text-moss">
            {t('Back to patients')}
          </Text>
        </Pressable>
      ) : null}
      {loading ? (
        <Text style={font.sans} className="text-mute">
          {t('Opening the record…')}
        </Text>
      ) : null}
      {error ? <Banner tone="error">{error}</Banner> : null}
      {patient ? (
        <View>
          <View className="flex-row items-start justify-between">
            <View className="me-3 flex-1">
              <Text style={font.medium} className="text-xs uppercase tracking-widest text-moss">
                {t('Patient')}
              </Text>
              <Text style={[font.display, nameAlign]} className="mt-1 text-4xl text-ink">
                {patient.fullName}
              </Text>
            </View>
            <TherapyPill therapy={therapy} />
          </View>
          <Text style={font.sans} className="mt-2 text-base leading-6 text-mute">
            {[age != null ? (age === 1 ? t('1 year') : t('{n} years', { n: age })) : null, patient.gender ? t(patient.gender) : null, patient.dateOfBirth ? formatLong(patient.dateOfBirth) : null]
              .filter(Boolean)
              .join(' · ') || t('No date of birth on file')}
          </Text>
          <Text style={font.sans} className="mt-1 text-base text-mute">
            {[patient.phone, patient.email].filter(Boolean).join(' · ')
              ? latinRun([patient.phone, patient.email].filter(Boolean).join(' · '))
              : t('No phone or email')}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/documents/patient/${patientId}`)}
            className="mt-4 self-start rounded-full bg-pine px-4 py-2"
          >
            <Text style={font.medium} className="text-sm text-card">
              {t('See documents')}
            </Text>
          </Pressable>

          <View className="mt-5 rounded-2xl border p-4" style={therapySurface(therapy)}>
            <View className="mb-2 flex-row items-center justify-between">
              <Text style={font.medium} className="text-xs uppercase tracking-widest text-moss">
                {t('Therapy')}
              </Text>
              {editingCare ? null : (
                <Pressable accessibilityRole="button" accessibilityLabel="Edit therapy, doctor, and type" onPress={beginCareEdit}>
                  <Text style={font.medium} className="text-sm text-moss">
                    {t('Edit')}
                  </Text>
                </Pressable>
              )}
            </View>
            {editingCare ? (
              <View className="flex-row flex-wrap">
                {PATIENT_TYPES.map((item) => (
                  <Chip key={item} label={item} active={therapyChoice === item} onPress={() => chooseTherapy(item)} />
                ))}
              </View>
            ) : (
              <Text style={font.sans} className="text-base text-ink">
                {therapy ? t(therapy) : t('No therapy yet.')}
              </Text>
            )}
            <Text style={font.medium} className="mb-2 mt-4 text-xs uppercase tracking-widest text-moss">
              {t('Doctor')}
            </Text>
            {editingCare ? (
              <View className="flex-row flex-wrap">
                {doctors
                  .filter((doctor) => doctor.therapyType === therapyChoice)
                  .map((doctor) => (
                    <Chip key={doctor.id} label={doctor.name} raw active={doctorChoice === doctor.id} onPress={() => setDoctorChoice(doctor.id)} />
                  ))}
              </View>
            ) : (
              <Text style={[font.sans, nameAlign]} className="text-base text-ink">
                {doctorName || t('No doctor yet.')}
              </Text>
            )}
            <Text style={font.medium} className="mb-2 mt-4 text-xs uppercase tracking-widest text-moss">
              {t('Patient type')}
            </Text>
            {editingCare ? (
              <View>
                <View className="flex-row flex-wrap">
                  {PAYER_TYPES.map((item) => (
                    <Chip key={item} label={item} active={typeChoice === item} onPress={() => setTypeChoice(item)} />
                  ))}
                </View>
                {hasSessionQuota(typeChoice) ? (
                  <View className="mt-3">
                    <Field
                      label="Remaining sessions"
                      value={allottedChoice}
                      onChangeText={setAllottedChoice}
                      keyboardType="number-pad"
                      placeholder="8"
                    />
                  </View>
                ) : null}
                <View className="mt-3 flex-row">
                  {careChanged ? (
                    <View className="me-3 flex-1">
                      <Button label="Save" disabled={!therapyChoice || !typeChoice} onPress={() => void saveCare()} />
                    </View>
                  ) : null}
                  <View className="flex-1">
                    <Button label="Cancel" tone="ghost" onPress={cancelCareEdit} />
                  </View>
                </View>
              </View>
            ) : (
              <View>
                <Text style={font.sans} className="text-base text-ink">
                  {t(patientType)}
                </Text>
                {hasSessionQuota(patientType) ? (
                  <>
                    <Text style={font.medium} className="mb-2 mt-4 text-xs uppercase tracking-widest text-moss">
                      {t('Remaining sessions')}
                    </Text>
                    <Text style={font.sans} className="text-base text-ink">
                      {remaining == null
                        ? t('No session number yet.')
                        : remaining === 1
                          ? t('1 session')
                          : t('{n} sessions', { n: remaining })}
                    </Text>
                  </>
                ) : null}
              </View>
            )}
          </View>

          <View className="mt-5 rounded-2xl border border-line bg-card p-4">
            <Text style={font.medium} className="mb-2 text-xs uppercase tracking-widest text-moss">
              {t('Case notes')}
            </Text>
            {editable ? (
              <>
                <Field
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  placeholder="The case, and what the patient is suffering from"
                />
                {notesChanged ? <Button label="Save notes" onPress={() => void saveRecord()} /> : null}
              </>
            ) : (
              <Text style={font.sans} className="text-base leading-6 text-ink">
                {patient.notes || t('No chart notes yet.')}
              </Text>
            )}
          </View>

          <View className="mt-6 flex-row items-center justify-between">
            <Text style={font.display} className="text-2xl text-ink">
              {t('Sessions')}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setAdding((open) => !open)}
              className="rounded-full border border-clay bg-card px-3 py-2"
            >
              <Text style={font.medium} className="text-sm text-moss">
                {adding ? t('Close') : t('Add a session')}
              </Text>
            </Pressable>
          </View>

          {adding ? (
            <View className="mt-4 rounded-2xl border border-line bg-card p-4">
              <Field label="Date" value={date} onChangeText={setDate} autoCapitalize="none" placeholder="YYYY-MM-DD" />
              <Text style={font.medium} className="mb-2 text-xs uppercase tracking-widest text-moss">
                {t('Start')}
              </Text>
              <View className="flex-row flex-wrap">
                {START_TIMES.filter((_, index) => index % 2 === 0).map((time) => (
                  <Chip key={time} label={time} active={start === time} onPress={() => setStart(time)} />
                ))}
              </View>
              <Text style={font.medium} className="mb-2 mt-2 text-xs uppercase tracking-widest text-moss">
                {t('Length')}
              </Text>
              <View className="flex-row flex-wrap">
                {DURATIONS.map((minutes) => (
                  <Chip key={minutes} label={`${minutes} min`} active={duration === minutes} onPress={() => setDuration(minutes)} />
                ))}
              </View>
              {therapy ? (
                <>
                  <Text style={font.medium} className="mb-2 text-xs uppercase tracking-widest text-moss">
                    {t('Doctor')}
                  </Text>
                  <View className="flex-row flex-wrap">
                    {doctors
                      .filter((doctor) => doctor.therapyType === therapy)
                      .map((doctor) => (
                        <Chip
                          key={doctor.id}
                          label={doctor.name}
                          raw
                          active={sessionDoctorId === doctor.id}
                          onPress={() => setSessionDoctorId(doctor.id)}
                        />
                      ))}
                  </View>
                </>
              ) : null}
              <Field label="Reason" value={reason} onChangeText={setReason} placeholder="Follow-up, review, intake" />
              <Field label="Session note" value={sessionNotes} onChangeText={setSessionNotes} multiline placeholder="What was covered" />
              {editable ? (
                <View className="flex-row flex-wrap">
                  {(['scheduled', 'completed', 'cancelled'] as VisitStatus[]).map((item) => (
                    <Chip key={item} label={item} active={status === item} onPress={() => setStatus(item)} />
                  ))}
                </View>
              ) : null}
              <Button label="Save session" onPress={() => void addSession()} />
            </View>
          ) : null}

          <SessionCounts visits={visits} />
          <SessionList title="Upcoming" visits={upcoming} empty="Nothing booked ahead." />
          <SessionList title="History" visits={history.slice(0, 3)} empty="No earlier sessions." />
          {history.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(`/patients/${patientId}/history`)}
              className="mt-1 self-start"
            >
              <Text style={font.medium} className="text-sm text-moss">
                {t('See more')}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}
