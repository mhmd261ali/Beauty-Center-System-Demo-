import { useCallback, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { Screen } from '../../components/Screen';
import { Banner, PageTitle, StatusPill, TherapyPill, font, therapySurface, therapyTone } from '../../components/ui';
import { api } from '../../lib/api';
import { weekdayLabels, formatDay, latinRun, monthCells, monthLabel, todayISO, toISO } from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import type { Reservation } from '../../lib/types';

export default function CalendarScreen() {
  const router = useRouter();
  const { t, nameAlign } = useI18n();
  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [selected, setSelected] = useState(todayISO());
  const [visits, setVisits] = useState<Reservation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const cells = useMemo(() => monthCells(cursor.year, cursor.month), [cursor]);
  const from = toISO(cells[0]);
  const to = toISO(cells[cells.length - 1]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await api.reservations({ from, to });
      setVisits(data.reservations);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load the month.');
    }
  }, [from, to]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const byDate = useMemo(() => {
    const map = new Map<string, Reservation[]>();
    visits.forEach((visit) => {
      const list = map.get(visit.scheduledDate) ?? [];
      list.push(visit);
      map.set(visit.scheduledDate, list);
    });
    return map;
  }, [visits]);

  const selectedVisits = byDate.get(selected) ?? [];
  const today = todayISO();

  function shiftMonth(amount: number) {
    const next = new Date(cursor.year, cursor.month + amount, 1);
    setCursor({ year: next.getFullYear(), month: next.getMonth() });
  }

  return (
    <Screen>
      <PageTitle kicker="Month" title={monthLabel(cursor.year, cursor.month)} detail="Each day shows who is booked, and at what time." />
      {error ? <Banner tone="error">{error}</Banner> : null}
      <View className="mb-4 flex-row items-center justify-between">
        <Pressable accessibilityRole="button" onPress={() => shiftMonth(-1)} className="rounded-full border border-line bg-card px-4 py-2">
          <Text style={font.medium} className="text-sm text-ink">
            {t('Previous')}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            const current = new Date();
            setCursor({ year: current.getFullYear(), month: current.getMonth() });
            setSelected(today);
          }}
        >
          <Text style={font.medium} className="text-sm text-moss">
            {t('This month')}
          </Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => shiftMonth(1)} className="rounded-full border border-line bg-card px-4 py-2">
          <Text style={font.medium} className="text-sm text-ink">
            {t('Next')}
          </Text>
        </Pressable>
      </View>

      <View className="overflow-hidden rounded-2xl border border-line bg-card">
        <View className="flex-row">
          {weekdayLabels().map((day) => (
            <View key={day} style={{ width: `${100 / 7}%` }} className="border-b border-line py-2">
              <Text style={font.medium} className="text-center text-xs uppercase text-mute">
                {day}
              </Text>
            </View>
          ))}
        </View>
        <View className="flex-row flex-wrap">
          {cells.map((date) => {
            const iso = toISO(date);
            const dayVisits = (byDate.get(iso) ?? []).filter((visit) => visit.status !== 'cancelled');
            const inMonth = date.getMonth() === cursor.month;
            const active = iso === selected;
            return (
              <Pressable
                key={iso}
                accessibilityRole="button"
                onPress={() => setSelected(iso)}
                style={{ width: `${100 / 7}%`, minHeight: 104, backgroundColor: active ? '#0f5c5e' : 'transparent' }}
                className="border-b border-r border-line p-1.5"
              >
                <Text style={[font.semibold, { color: active ? '#ffffff' : inMonth ? '#123033' : '#a8c4c4' }]} className="text-sm">
                  {date.getDate()}
                  {iso === today ? ' ·' : ''}
                </Text>
                {dayVisits.slice(0, 3).map((visit) => {
                  const tone = therapyTone(visit.therapyType);
                  return (
                    <Text
                      key={visit.id}
                      style={[
                        font.sans,
                        nameAlign,
                        {
                          color: active ? '#f3fbfb' : tone.fg,
                          backgroundColor: active ? 'transparent' : tone.bg,
                          borderRadius: 4,
                          overflow: 'hidden',
                          paddingHorizontal: 2,
                        },
                      ]}
                      className="mt-0.5 text-xs"
                      numberOfLines={1}
                    >
                      {latinRun(visit.startTime)} {visit.patientName.split(' ')[0]}
                    </Text>
                  );
                })}
                {dayVisits.length > 3 ? (
                  <Text style={[font.medium, { color: active ? '#d7f4f4' : '#5c7576' }]} className="text-xs">
                    +{dayVisits.length - 3} more
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>

      <View className="mt-6">
        <View className="mb-3 flex-row items-center justify-between">
          <Text style={font.display} className="text-2xl text-ink">
            {formatDay(selected)}
          </Text>
          <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/reserve', params: { date: selected } })}>
            <Text style={font.medium} className="text-sm text-moss">
              {t('Book this day')}
            </Text>
          </Pressable>
        </View>
        {selectedVisits.length === 0 ? (
          <Text style={font.sans} className="text-base text-mute">
            {t('No one is booked.')}
          </Text>
        ) : (
          selectedVisits.map((visit) => (
            <Pressable
              key={visit.id}
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/patients/[id]', params: { id: String(visit.patientId) } })}
              className="mb-2 flex-row items-center justify-between rounded-2xl border px-4 py-3"
              style={therapySurface(visit.therapyType)}
            >
              <View className="me-3 flex-1">
                <Text style={[font.semibold, nameAlign, { fontVariant: ['tabular-nums'] }]} className="text-base text-ink">
                  {latinRun(`${visit.startTime}–${visit.endTime}`)}
                </Text>
                <Text style={[font.sans, nameAlign]} className="mt-0.5 text-sm text-mute">
                  {visit.patientName}
                  {visit.reason ? ` · ${visit.reason}` : ''}
                </Text>
              </View>
              <View className="items-end">
                <TherapyPill therapy={visit.therapyType} />
                <View className="mt-1">
                  <StatusPill status={visit.status} />
                </View>
              </View>
            </Pressable>
          ))
        )}
      </View>
    </Screen>
  );
}
