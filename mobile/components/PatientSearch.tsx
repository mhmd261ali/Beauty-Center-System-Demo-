import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { api } from '../lib/api';
import { hasSessionQuota, sessionQuotaLabel, todayISO } from '../lib/format';
import type { Patient } from '../lib/types';
import { Banner, Field, TherapyPill, font, therapySurface } from './ui';

const PAGE = 8;

export function PatientSearch({
  selected,
  onSelect,
  listHeight,
  fillList,
}: {
  selected: Patient | null;
  onSelect: (patient: Patient | null) => void;
  listHeight?: number;
  fillList?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Patient[]>([]);
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPage(0);
  }, [query]);

  useEffect(() => {
    if (selected) return undefined;
    let active = true;
    const handle = setTimeout(() => {
      api
        .patients(query, todayISO())
        .then((data) => {
          if (active) {
            const ordered = [...data.patients].sort((left, right) =>
              left.fullName.localeCompare(right.fullName, undefined, { sensitivity: 'base' }),
            );
            setResults(ordered);
          }
        })
        .catch((reason: unknown) => {
          if (active) setError(reason instanceof Error ? reason.message : 'Could not search patients.');
        });
    }, 200);
    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [query, selected]);

  const scrolling = fillList || listHeight != null;
  const pages = Math.max(Math.ceil(results.length / PAGE), 1);
  const current = Math.min(page, pages - 1);
  const visible = scrolling ? results : results.slice(current * PAGE, current * PAGE + PAGE);

  if (selected) {
    return (
      <View className="mb-4 rounded-2xl border p-4" style={therapySurface(selected.therapyType)}>
        <View className="mb-1 flex-row items-start justify-between">
          <Text style={font.semibold} className="mr-3 flex-1 text-lg text-ink">
            {selected.fullName}
          </Text>
          <TherapyPill therapy={selected.therapyType} />
        </View>
        <Text style={font.sans} className="mt-1 text-sm text-mute">
          {selected.phone || 'No phone on file'}
          {hasSessionQuota(selected.patientType)
            ? ` · ${sessionQuotaLabel(selected.sessionCount, selected.sessionsAllotted)}`
            : ''}
          {selected.nextVisit ? ` · Next ${selected.nextVisit}` : ''}
        </Text>
        <Pressable accessibilityRole="button" onPress={() => onSelect(null)} className="mt-3 self-start">
          <Text style={font.medium} className="text-sm text-moss">
            Choose someone else
          </Text>
        </Pressable>
      </View>
    );
  }

  const list = (
    <View>
      {visible.map((patient) => {
        return (
          <Pressable
            key={patient.id}
            accessibilityRole="button"
            onPress={() => onSelect(patient)}
            className="mb-2 rounded-xl border px-3 py-3"
            style={therapySurface(patient.therapyType)}
          >
            <View className="flex-row items-start justify-between">
              <View className="mr-3 flex-1">
                <Text style={font.medium} className="text-base text-ink">
                  {patient.fullName}
                </Text>
                <Text style={font.sans} className="mt-0.5 text-sm text-mute">
                  {patient.phone || 'No phone'}
                  {hasSessionQuota(patient.patientType)
                    ? ` · ${sessionQuotaLabel(patient.sessionCount, patient.sessionsAllotted)}`
                    : ''}
                  {patient.nextVisit ? ` · Next ${patient.nextVisit}` : ''}
                </Text>
              </View>
              <TherapyPill therapy={patient.therapyType} />
            </View>
          </Pressable>
        );
      })}
      {results.length === 0 && query.trim() ? (
        <Text style={font.sans} className="mb-3 text-sm text-mute">
          No one matches that name.
        </Text>
      ) : null}
    </View>
  );

  return (
    <View className="mb-2" style={fillList ? { flex: 1, minHeight: 0 } : undefined}>
      {scrolling ? null : (
        <View className="mb-3 flex-row items-center justify-between">
          <PageArrow label="Previous patients" glyph="←" disabled={current === 0} onPress={() => setPage(current - 1)} />
          <Text style={font.medium} className="text-sm text-mute">
            {results.length === 0 ? 'No patients' : `${current * PAGE + 1}–${current * PAGE + visible.length} of ${results.length}`}
          </Text>
          <PageArrow label="Next patients" glyph="→" disabled={current >= pages - 1} onPress={() => setPage(current + 1)} />
        </View>
      )}
      <Field label="Find a patient" value={query} onChangeText={setQuery} placeholder="Name or phone" autoCapitalize="words" />
      {error ? <Banner tone="error">{error}</Banner> : null}
      {scrolling ? (
        <ScrollView
          style={fillList ? { flex: 1, minHeight: 0, marginBottom: 8 } : { height: listHeight, marginBottom: 8 }}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
        >
          {list}
        </ScrollView>
      ) : (
        list
      )}
    </View>
  );
}

function PageArrow({
  label,
  glyph,
  disabled,
  onPress,
}: {
  label: string;
  glyph: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className="h-9 w-9 items-center justify-center rounded-full border border-line bg-card"
      style={{ opacity: disabled ? 0.35 : 1 }}
    >
      <Text style={font.semibold} className="text-base text-ink">
        {glyph}
      </Text>
    </Pressable>
  );
}
