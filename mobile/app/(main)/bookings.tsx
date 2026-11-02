import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { Screen } from '../../components/Screen';
import { Timeline } from '../../components/Timeline';
import { VisitCard } from '../../components/VisitCard';
import { Banner, Chip, DateField, PageTitle, THERAPY_FALLBACK, THERAPY_TONE, font } from '../../components/ui';
import { api } from '../../lib/api';
import { addDays, formatLong, todayISO } from '../../lib/format';
import type { Reservation } from '../../lib/types';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export default function BookingsScreen() {
  const router = useRouter();
  const today = todayISO();
  const [date, setDate] = useState(today);
  const [visits, setVisits] = useState<Reservation[]>([]);
  const [selected, setSelected] = useState<Reservation | null>(null);
  const [hideCancelled, setHideCancelled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const scroller = useRef<ScrollView>(null);
  const detailTop = useRef(0);
  const yesterday = addDays(today, -1);
  const tomorrow = addDays(today, 1);
  const isToday = date === today;

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await api.reservations({ date });
      setVisits(data.reservations);
      setSelected((current) => data.reservations.find((visit) => visit.id === current?.id) ?? null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load that day.');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const visible = hideCancelled ? visits.filter((visit) => visit.status !== 'cancelled') : visits;
  const cancelled = visits.filter((visit) => visit.status === 'cancelled').length;

  function goTo(next: string) {
    if (!DATE.test(next) || next === date) return;
    setDate(next);
    setSelected(null);
    setVisits([]);
  }

  function select(visit: Reservation) {
    setSelected(visit);
    requestAnimationFrame(() => {
      scroller.current?.scrollTo({ y: Math.max(detailTop.current - 16, 0), animated: true });
    });
  }

  function changed(next: Reservation) {
    setVisits((current) => current.map((visit) => (visit.id === next.id ? next : visit)));
    setSelected(next);
  }

  return (
    <Screen ref={scroller}>
      <PageTitle
        kicker="Bookings"
        title={formatLong(date)}
        detail={loading ? 'Opening the book…' : `${visible.length} on the timeline${cancelled ? ` · ${cancelled} cancelled` : ''}`}
      />
      {error ? <Banner tone="error">{error}</Banner> : null}
      <View className="mb-4 flex-row flex-wrap">
        <Chip label="Yesterday" active={date === yesterday} onPress={() => goTo(yesterday)} />
        <Chip label="Today" active={isToday} onPress={() => goTo(today)} />
        <Chip label="Tomorrow" active={date === tomorrow} onPress={() => goTo(tomorrow)} />
      </View>
      <View className="mb-5 flex-row items-end">
        <View className="mr-3 flex-1">
          <DateField label="Choose a day" value={date} onChange={goTo} />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous day"
          onPress={() => goTo(addDays(date, -1))}
          className="mb-4 mr-2 h-12 w-12 items-center justify-center rounded-xl border border-line bg-card"
        >
          <Text style={font.semibold} className="text-base text-ink">
            ←
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next day"
          onPress={() => goTo(addDays(date, 1))}
          className="mb-4 h-12 w-12 items-center justify-center rounded-xl border border-line bg-card"
        >
          <Text style={font.semibold} className="text-base text-ink">
            →
          </Text>
        </Pressable>
      </View>
      <View className="mb-5 flex-row flex-wrap">
        <Pressable accessibilityRole="button" onPress={() => setHideCancelled((value) => !value)} className="mb-2 mr-3 rounded-full border border-line bg-card px-3 py-2">
          <Text style={font.medium} className="text-sm text-ink">
            {hideCancelled ? 'Show cancelled' : 'Hide cancelled'}
          </Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push('/reserve')} className="mb-2 rounded-full bg-clay px-3 py-2">
          <Text style={font.medium} className="text-sm text-card">
            Book a visit
          </Text>
        </Pressable>
      </View>
      <Timeline key={date} visits={visible} selectedId={selected?.id ?? null} isToday={isToday} onSelect={select} />
      {visible.length === 0 && !loading ? (
        <Text style={font.sans} className="mt-3 text-base text-mute">
          This day's book is clear.
        </Text>
      ) : null}
      <View className="mt-4 flex-row flex-wrap">
        {Object.values(THERAPY_TONE).map((tone) => (
          <Legend key={tone.label} swatch={tone.bg} mark={tone.line} label={tone.label} />
        ))}
        <Legend swatch={THERAPY_FALLBACK.bg} mark={THERAPY_FALLBACK.line} label={THERAPY_FALLBACK.label} />
      </View>
      <View className="mt-6" onLayout={(event) => { detailTop.current = event.nativeEvent.layout.y; }}>
        {selected ? (
          <VisitCard visit={selected} onChanged={changed} />
        ) : (
          <Text style={font.sans} className="text-base leading-6 text-mute">
            Select a visit on the timeline to see the patient, the reason, and the note.
          </Text>
        )}
      </View>
    </Screen>
  );
}

function Legend({ swatch, mark, label }: { swatch: string; mark: string; label: string }) {
  return (
    <View className="mb-2 mr-4 flex-row items-center">
      <View style={{ backgroundColor: swatch, borderColor: mark, borderWidth: 2 }} className="mr-2 h-3.5 w-3.5 rounded-full" />
      <Text style={font.sans} className="text-sm text-mute">
        {label}
      </Text>
    </View>
  );
}
