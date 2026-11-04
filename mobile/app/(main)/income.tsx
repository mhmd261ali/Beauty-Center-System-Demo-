import { useCallback, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Redirect, useFocusEffect } from 'expo-router';

import { Screen } from '../../components/Screen';
import { Banner, PageTitle, TherapyPill, font, therapySurface } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import {
  WEEKDAYS,
  formatDay,
  formatMoney,
  monthCells,
  monthISO,
  monthLabel,
  toISO,
  todayISO,
} from '../../lib/format';
import { canSeeIncome } from '../../lib/permissions';
import type { IncomeMonth } from '../../lib/types';

const CARD_ORDER = ['Company', 'Private', 'Islamic'] as const;

function dollars(value: number | null | undefined) {
  return `$${formatMoney(value)}`;
}

type DaySession = {
  patientName: string;
  amount: number;
  startTime: string;
  type: (typeof CARD_ORDER)[number];
  therapyType?: string | null;
};

function sessionsByDate(report: IncomeMonth | null) {
  const map = new Map<string, { total: number; sessions: DaySession[] }>();
  (report?.categories ?? []).forEach((category) => {
    category.days.forEach((day) => {
      let entry = map.get(day.date);
      if (!entry) {
        entry = { total: 0, sessions: [] };
        map.set(day.date, entry);
      }
      entry.total += day.total;
      day.paid.forEach((item) => {
        entry.sessions.push({
          patientName: item.patientName,
          amount: item.amount,
          startTime: item.startTime,
          type: category.type,
          therapyType: item.therapyType,
        });
      });
    });
  });
  map.forEach((entry) => {
    entry.sessions.sort((left, right) => left.startTime.localeCompare(right.startTime) || left.patientName.localeCompare(right.patientName));
  });
  return map;
}

export default function IncomeScreen() {
  const { user } = useAuth();
  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [selected, setSelected] = useState(todayISO());
  const [report, setReport] = useState<IncomeMonth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const screenRef = useRef<ScrollView>(null);
  const sessionsRef = useRef<View>(null);
  const month = monthISO(cursor.year, cursor.month);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      setReport(await api.income(month));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load income.');
    } finally {
      setLoading(false);
    }
  }, [month]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const byDate = useMemo(() => sessionsByDate(report), [report]);
  const cells = useMemo(() => monthCells(cursor.year, cursor.month), [cursor]);
  const selectedDay = byDate.get(selected);
  const today = todayISO();
  const totals = CARD_ORDER.map((type) => ({
    label: type,
    amount: report?.categories.find((category) => category.type === type)?.total ?? 0,
  }));
  const cards = [...totals, { label: 'Total', amount: report?.total ?? 0 }];

  function shiftMonth(amount: number) {
    const next = new Date(cursor.year, cursor.month + amount, 1);
    setCursor({ year: next.getFullYear(), month: next.getMonth() });
    const current = new Date();
    if (next.getFullYear() === current.getFullYear() && next.getMonth() === current.getMonth()) {
      setSelected(todayISO());
    } else {
      setSelected(toISO(next));
    }
  }

  function revealSessions() {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.getElementById('income-sessions')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    screenRef.current?.scrollToEnd({ animated: true });
  }

  function chooseDay(iso: string) {
    setSelected(iso);
    setTimeout(revealSessions, 120);
  }

  if (!user || !canSeeIncome(user.role)) return <Redirect href="/bookings" />;

  return (
    <Screen ref={screenRef}>
      <PageTitle
        kicker="Admin"
        title="Income"
        detail={loading ? 'Adding the month…' : `Payments recorded in ${monthLabel(cursor.year, cursor.month)}.`}
      />
      {error ? <Banner tone="error">{error}</Banner> : null}

      <View className="mb-6 flex-row" style={{ marginHorizontal: -6 }}>
        {cards.map((card) => (
          <View key={card.label} className="flex-1" style={{ paddingHorizontal: 6 }}>
            <View className="rounded-2xl border border-line bg-card p-4">
              <Text style={font.medium} className="text-xs uppercase tracking-widest text-moss">
                {card.label}
              </Text>
              <Text style={font.display} className="mt-1 text-2xl text-ink">
                {dollars(card.amount)}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View className="mb-4 flex-row items-center justify-between">
        <Pressable accessibilityRole="button" onPress={() => shiftMonth(-1)} className="rounded-full border border-line bg-card px-4 py-2">
          <Text style={font.medium} className="text-sm text-ink">
            Previous
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
            This month
          </Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => shiftMonth(1)} className="rounded-full border border-line bg-card px-4 py-2">
          <Text style={font.medium} className="text-sm text-ink">
            Next
          </Text>
        </Pressable>
      </View>

      <View className="overflow-hidden rounded-2xl border border-line bg-card">
        <View className="flex-row">
          {WEEKDAYS.map((day) => (
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
            const day = byDate.get(iso);
            const inMonth = date.getMonth() === cursor.month;
            const active = iso === selected;
            const amount = day?.total ?? 0;
            return (
              <Pressable
                key={iso}
                accessibilityRole="button"
                accessibilityLabel={`${iso}${amount ? `, ${dollars(amount)}` : ''}`}
                onPress={() => chooseDay(iso)}
                style={{ width: `${100 / 7}%`, minHeight: 88, backgroundColor: active ? '#0f5c5e' : 'transparent' }}
                className="border-b border-r border-line p-1.5"
              >
                <Text style={[font.semibold, { color: active ? '#ffffff' : inMonth ? '#123033' : '#a8c4c4' }]} className="text-sm">
                  {date.getDate()}
                  {iso === today ? ' ·' : ''}
                </Text>
                {amount > 0 ? (
                  <Text
                    style={[font.medium, { color: active ? '#f3fbfb' : inMonth ? '#0f5c5e' : '#a8c4c4', fontVariant: ['tabular-nums'] }]}
                    className="mt-1 text-xs"
                    numberOfLines={1}
                  >
                    {dollars(amount)}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>

      <View ref={sessionsRef} nativeID="income-sessions" collapsable={false} className="mt-6">
        <View className="mb-3 flex-row items-baseline justify-between">
          <Text style={font.display} className="text-2xl text-ink">
            {formatDay(selected)}
          </Text>
          <Text style={font.semibold} className="text-base text-ink">
            {dollars(selectedDay?.total ?? 0)}
          </Text>
        </View>
        {!selectedDay || selectedDay.sessions.length === 0 ? (
          <Text style={font.sans} className="text-base text-mute">
            No income recorded on this day.
          </Text>
        ) : (
          selectedDay.sessions.map((session, index) => (
            <View
              key={`${session.startTime}-${session.patientName}-${index}`}
              className="mb-2 flex-row items-center justify-between rounded-2xl border px-4 py-3"
              style={therapySurface(session.therapyType)}
            >
              <View className="mr-3 flex-1">
                <Text style={font.semibold} className="text-base text-ink">
                  {session.patientName}
                </Text>
                <Text style={font.sans} className="mt-0.5 text-sm text-mute">
                  {session.startTime} · {session.type}
                </Text>
              </View>
              <View className="items-end">
                <TherapyPill therapy={session.therapyType} />
                <Text style={[font.semibold, { fontVariant: ['tabular-nums'] }]} className="mt-1 text-base text-ink">
                  {dollars(session.amount)}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>
    </Screen>
  );
}
