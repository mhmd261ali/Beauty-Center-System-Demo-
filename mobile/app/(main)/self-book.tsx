import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';

import { Screen } from '../../components/Screen';
import { Banner, Button, Chip, DateField, Field, PageTitle, font } from '../../components/ui';
import { api } from '../../lib/api';
import { PATIENT_TYPES, addDays, addMinutes, formatClock, formatDay, todayISO } from '../../lib/format';
import type { Doctor, PickedFile, Reservation } from '../../lib/types';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SLOT_MINUTES = 30;
const OPEN = 7 * 60;
const CLOSE = 16 * 60;

const SLOTS = Array.from({ length: (CLOSE - OPEN) / SLOT_MINUTES }, (_, index) => {
  const minutes = OPEN + index * SLOT_MINUTES;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
});

function taken(slot: string, visits: Reservation[]) {
  const end = addMinutes(slot, SLOT_MINUTES);
  if (!end) return true;
  return visits.some((visit) => visit.status !== 'cancelled' && visit.startTime < end && visit.endTime > slot);
}

function passed(date: string, slot: string) {
  return new Date(`${date}T${slot}:00`).getTime() <= Date.now();
}

export default function SelfBookScreen() {
  const today = todayISO();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [therapy, setTherapy] = useState<string | null>(null);
  const [doctorId, setDoctorId] = useState<number | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [note, setNote] = useState('');
  const [file, setFile] = useState<PickedFile | null>(null);
  const [date, setDate] = useState(today);
  const [slot, setSlot] = useState<string | null>(null);
  const [visits, setVisits] = useState<Reservation[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.doctors().then((data) => setDoctors(data.doctors)).catch(() => setError('Could not load the doctors.'));
  }, []);

  const load = useCallback(async () => {
    if (!DATE.test(date)) return;
    try {
      const data = await api.reservations({ date });
      setVisits(data.reservations);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load that day.');
    }
  }, [date]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    void load();
  }, [load]);

  const open = SLOTS.filter((time) => !taken(time, visits) && !passed(date, time));
  const clinicians = doctors.filter((doctor) => doctor.therapyType === therapy);

  function chooseTherapy(item: string) {
    setTherapy(item);
    setDoctorId((current) => (doctors.some((doctor) => doctor.id === current && doctor.therapyType === item) ? current : null));
  }

  async function pickFile() {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
    if (result.canceled) return;
    const asset = result.assets[0];
    setFile({
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType ?? undefined,
      file: 'file' in asset ? (asset.file as Blob | undefined) : undefined,
    });
  }

  function reset() {
    setName('');
    setPhone('');
    setTherapy(null);
    setDoctorId(null);
    setNote('');
    setFile(null);
    setSlot(null);
  }

  async function book() {
    if (name.trim().length < 2) {
      setError('Enter the name.');
      return;
    }
    if (phone.trim().length < 3) {
      setError('Enter a phone number.');
      return;
    }
    if (!therapy) {
      setError('Choose a type of therapy.');
      return;
    }
    if (!doctorId) {
      setError('Choose a doctor.');
      return;
    }
    if (!DATE.test(date)) {
      setError('Choose a date.');
      return;
    }
    if (!slot || !open.includes(slot)) {
      setError('Choose an open time.');
      return;
    }
    const end = addMinutes(slot, SLOT_MINUTES);
    if (!end) {
      setError('Choose an open time.');
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const created = await api.createPatient({
        fullName: name.trim(),
        phone: phone.trim(),
        therapyType: therapy,
        doctorId,
        notes: note.trim() || null,
        patientType: 'Private',
      });
      const result = await api.createReservation({
        patientId: created.patient.id,
        scheduledDate: date,
        startTime: slot,
        endTime: end,
        reason: therapy,
        notes: note.trim() || null,
        doctorId,
        status: 'scheduled',
        openSlot: true,
      });
      if (file) {
        try {
          await api.createDocument({
            name: file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ') || file.name,
            patientId: created.patient.id,
            file,
          });
        } catch (reason) {
          setMessage(`Booked ${result.reservation.patientName} for ${formatDay(date)}, ${formatClock(slot)}–${formatClock(end)}.`);
          setError(reason instanceof Error ? reason.message : 'The visit is booked, but the document was not saved.');
          reset();
          await load();
          return;
        }
      }
      setMessage(`Booked ${result.reservation.patientName} for ${formatDay(date)}, ${formatClock(slot)}–${formatClock(end)}.`);
      reset();
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not book that time.');
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <PageTitle
        kicker="Self book"
        title="Book an open time"
        detail="Name, phone, therapy, and doctor. A note and a document are optional. Then pick a free time between 7:00 AM and 4:00 PM."
      />
      {message ? <Banner tone="ok">{message}</Banner> : null}
      {error ? <Banner tone="error">{error}</Banner> : null}
      <Field label="Name" value={name} onChangeText={setName} placeholder="Full name" autoCapitalize="words" />
      <Field label="Phone number" value={phone} onChangeText={setPhone} placeholder="555-0100" keyboardType="phone-pad" />
      <Text style={font.medium} className="mb-2 text-xs uppercase tracking-widest text-moss">
        Type of therapy
      </Text>
      <View className="flex-row flex-wrap">
        {PATIENT_TYPES.map((item) => (
          <Chip key={item} label={item} active={therapy === item} onPress={() => chooseTherapy(item)} />
        ))}
      </View>
      <Text style={font.medium} className="mb-2 text-xs uppercase tracking-widest text-moss">
        Doctor
      </Text>
      {therapy ? (
        clinicians.length === 0 ? (
          <Text style={font.sans} className="mb-4 text-base text-mute">
            No doctors for this therapy yet.
          </Text>
        ) : (
          <View className="flex-row flex-wrap">
            {clinicians.map((doctor) => (
              <Chip key={doctor.id} label={doctor.name} active={doctorId === doctor.id} onPress={() => setDoctorId(doctor.id)} />
            ))}
          </View>
        )
      ) : (
        <Text style={font.sans} className="mb-4 text-base text-mute">
          Choose a therapy first.
        </Text>
      )}
      <Field label="Note" value={note} onChangeText={setNote} multiline placeholder="Optional" />
      <Text style={font.medium} className="mb-2 text-xs uppercase tracking-widest text-moss">
        Document
      </Text>
      <View className="mb-4 flex-row flex-wrap items-center">
        <Pressable accessibilityRole="button" onPress={() => void pickFile()} className="mb-2 mr-3 rounded-full border border-line bg-card px-3 py-2">
          <Text style={font.medium} className="text-sm text-ink">
            {file ? 'Change file' : 'Attach a file'}
          </Text>
        </Pressable>
        {file ? (
          <Pressable accessibilityRole="button" onPress={() => setFile(null)} className="mb-2">
            <Text style={font.sans} className="text-sm text-mute">
              {file.name} · Remove
            </Text>
          </Pressable>
        ) : (
          <Text style={font.sans} className="mb-2 text-sm text-mute">
            Optional
          </Text>
        )}
      </View>
      <DateField label="Date" value={date} onChange={(value) => { setDate(value); setSlot(null); }} />
      <View className="mb-3 flex-row flex-wrap">
        {[0, 1, 2, 3].map((offset) => {
          const value = addDays(today, offset);
          const label = offset === 0 ? 'Today' : offset === 1 ? 'Tomorrow' : formatDay(value).split(',')[0];
          return (
            <Chip
              key={value}
              label={`${label} ${value.slice(5)}`}
              active={date === value}
              onPress={() => { setDate(value); setSlot(null); }}
            />
          );
        })}
      </View>
      <Text style={font.medium} className="mb-2 text-xs uppercase tracking-widest text-moss">
        Time
      </Text>
      {open.length === 0 ? (
        <Text style={font.sans} className="mb-4 text-base text-mute">
          No open times on this day.
        </Text>
      ) : (
        <View className="flex-row flex-wrap">
          {open.map((time) => (
            <Chip key={time} label={formatClock(time)} active={slot === time} onPress={() => setSlot(time)} />
          ))}
        </View>
      )}
      <Button label={busy ? 'Booking…' : 'Book this time'} disabled={busy || !slot} onPress={() => void book()} />
      {slot ? (
        <Text style={font.sans} className="mt-3 text-sm text-mute">
          {formatClock(slot)}–{formatClock(addMinutes(slot, SLOT_MINUTES) || slot)}
        </Text>
      ) : null}
    </Screen>
  );
}
