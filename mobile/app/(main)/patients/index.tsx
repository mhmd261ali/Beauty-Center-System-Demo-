import { useCallback, useMemo, useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { Screen } from '../../../components/Screen';
import { Banner, Chip, DateField, Field, FilterIcon, PageTitle, TherapyPill, font, therapySurface } from '../../../components/ui';
import { api } from '../../../lib/api';
import { plural, useI18n } from '../../../lib/i18n';
import { GENDERS, PATIENT_TYPES, PAYER_TYPES, WIDE, addDays, hasSessionQuota, sessionQuotaLabel, todayISO } from '../../../lib/format';
import type { Patient } from '../../../lib/types';
const SORTS = [
  { id: 'name-asc', label: 'Name A–Z' },
  { id: 'name-desc', label: 'Name Z–A' },
  { id: 'sessions-desc', label: 'Most sessions' },
  { id: 'sessions-asc', label: 'Fewest sessions' },
] as const;

type SortId = (typeof SORTS)[number]['id'];

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function nextSessionDate(patient: Patient) {
  return patient.nextVisit?.slice(0, 10) ?? '';
}

export default function PatientsScreen() {
  const router = useRouter();
  const { t, nameAlign } = useI18n();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE;
  const [query, setQuery] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [type, setType] = useState('All');
  const [payer, setPayer] = useState('All');
  const [gender, setGender] = useState('All');
  const [sort, setSort] = useState<SortId>('name-asc');
  const [nextDate, setNextDate] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = todayISO();
  const tomorrow = addDays(today, 1);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await api.patients(query, today);
      setPatients(data.patients);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load patients.');
    }
  }, [query, today]);

  useFocusEffect(
    useCallback(() => {
      const handle = setTimeout(() => void load(), 200);
      return () => clearTimeout(handle);
    }, [load]),
  );

  const visible = useMemo(() => {
    const filtered = patients.filter((patient) => {
      const typeMatch = type === 'All' || (patient.reasons ?? []).some((reason) => reason.toLowerCase() === type.toLowerCase());
      const payerMatch = payer === 'All' || patient.patientType === payer;
      const genderMatch = gender === 'All' || patient.gender === gender;
      const chosenDate = DATE.test(nextDate) ? nextDate : '';
      const dateMatch = !chosenDate || nextSessionDate(patient) === chosenDate;
      return typeMatch && payerMatch && genderMatch && dateMatch;
    });
    return filtered.sort((left, right) => {
      if (sort === 'sessions-desc' || sort === 'sessions-asc') {
        const diff = (left.sessionCount ?? 0) - (right.sessionCount ?? 0);
        if (diff !== 0) return sort === 'sessions-asc' ? diff : -diff;
      }
      const byName = left.fullName.localeCompare(right.fullName);
      return sort === 'name-desc' ? -byName : byName;
    });
  }, [patients, type, payer, gender, sort, nextDate]);

  const list = (
    <View className={wide ? 'me-8 flex-1' : ''}>
      <Field label="Search" value={query} onChangeText={setQuery} placeholder="Name or phone" autoCapitalize="words" />
      {visible.length === 0 ? (
        <Text style={font.sans} className="text-base text-mute">
          No patients match these filters.
        </Text>
      ) : (
        visible.map((patient) => (
          <Pressable
            key={patient.id}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/patients/[id]', params: { id: String(patient.id) } })}
            className="mb-2 rounded-2xl border px-4 py-3"
            style={therapySurface(patient.therapyType)}
          >
            <View className="flex-row items-start justify-between">
              <View className="me-3 flex-1">
                <Text style={[font.semibold, nameAlign]} className="text-base text-ink">
                  {patient.fullName}
                </Text>
                <Text style={[font.sans, nameAlign]} className="mt-1 text-sm text-mute">
                  {sessionQuotaLabel(
                    patient.sessionCount,
                    hasSessionQuota(patient.patientType) ? patient.sessionsAllotted : null,
                  )}
                  {patient.patientType ? ` · ${patient.patientType}` : ''}
                  {patient.gender ? ` · ${patient.gender}` : ''}
                  {patient.nextVisit ? ` · Next ${patient.nextVisit}` : ''}
                </Text>
              </View>
              <TherapyPill therapy={patient.therapyType} />
            </View>
          </Pressable>
        ))
      )}
    </View>
  );

  const filters = (
    <View className={`rounded-2xl border border-line bg-card p-4 ${wide ? 'w-80' : 'mb-6'}`}>
      <Text style={font.medium} className="mb-2 text-xs uppercase tracking-widest text-moss">
        Type
      </Text>
      <View className="flex-row flex-wrap">
        <Chip label="All" active={type === 'All'} onPress={() => setType('All')} />
        {PATIENT_TYPES.map((item) => (
          <Chip key={item} label={item} active={type === item} onPress={() => setType(item)} />
        ))}
      </View>
      <Text style={font.medium} className="mb-2 mt-3 text-xs uppercase tracking-widest text-moss">
        {t('Patient type')}
      </Text>
      <View className="flex-row flex-wrap">
        <Chip label="All" active={payer === 'All'} onPress={() => setPayer('All')} />
        {PAYER_TYPES.map((item) => (
          <Chip key={item} label={item} active={payer === item} onPress={() => setPayer(item)} />
        ))}
      </View>
      <Text style={font.medium} className="mb-2 mt-3 text-xs uppercase tracking-widest text-moss">
        {t('Gender')}
      </Text>
      <View className="flex-row flex-wrap">
        <Chip label="All" active={gender === 'All'} onPress={() => setGender('All')} />
        {GENDERS.map((item) => (
          <Chip key={item} label={item} active={gender === item} onPress={() => setGender(item)} />
        ))}
      </View>
      <Text style={font.medium} className="mb-2 mt-3 text-xs uppercase tracking-widest text-moss">
        {t('Next session')}
      </Text>
      <View className="flex-row flex-wrap">
        <Chip label="Any date" active={nextDate.trim() === ''} onPress={() => setNextDate('')} />
        <Chip label="Today" active={nextDate === today} onPress={() => setNextDate(today)} />
        <Chip label="Tomorrow" active={nextDate === tomorrow} onPress={() => setNextDate(tomorrow)} />
      </View>
      <DateField label="Or pick a date" value={nextDate} onChange={setNextDate} />
      <Text style={font.medium} className="mb-2 text-xs uppercase tracking-widest text-moss">
        {t('Sort')}
      </Text>
      <View className="flex-row flex-wrap">
        {SORTS.map((item) => (
          <Chip key={item.id} label={item.label} active={sort === item.id} onPress={() => setSort(item.id)} />
        ))}
      </View>
    </View>
  );

  return (
    <Screen>
      <View className="flex-row items-start justify-between">
        <View className="me-4 flex-1">
          <PageTitle
            kicker="Overview"
            title="Patients"
            detail={plural(visible.length, '1 patient', '{n} patients')}
          />
        </View>
        <View className="mt-1 items-end">
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/patients/new')}
            className="rounded-full bg-clay px-3 py-2"
          >
            <Text style={font.medium} className="text-sm text-card">
              {t('Add patient')}
            </Text>
          </Pressable>
          {wide ? null : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Filter"
              onPress={() => setFiltersOpen((open) => !open)}
              className={`mt-2 h-10 w-10 items-center justify-center rounded-full ${filtersOpen ? 'bg-pine' : 'border border-line bg-card'}`}
            >
              <FilterIcon color={filtersOpen ? '#ffffff' : '#0f5c5e'} />
            </Pressable>
          )}
        </View>
      </View>
      {error ? <Banner tone="error">{error}</Banner> : null}
      {wide ? (
        <View className="flex-row items-start">
          {list}
          {filters}
        </View>
      ) : (
        <View>
          {filtersOpen ? filters : null}
          {list}
        </View>
      )}
    </Screen>
  );
}
