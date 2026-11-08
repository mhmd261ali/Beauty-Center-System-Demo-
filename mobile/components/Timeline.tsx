import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { formatClock, latinRun, minutesOf } from '../lib/format';
import { useI18n } from '../lib/i18n';
import type { Reservation } from '../lib/types';
import { font, therapyTone } from './ui';

const OPEN = 7 * 60;
const CLOSE = 19 * 60;
const PX = 3;
const LANE = 86;
const STACK = 10;
const STEP = 30;
const LABEL_PAD = 72;

function clockLabel(minute: number) {
  const hour = Math.floor(minute / 60) % 24;
  return formatClock(`${String(hour).padStart(2, '0')}:00`);
}

type Placed = Reservation & { col: number; cols: number };

function overlaps(left: Reservation, right: Reservation) {
  return minutesOf(left.startTime) < minutesOf(right.endTime) && minutesOf(right.startTime) < minutesOf(left.endTime);
}

function place(items: Reservation[]): Placed[] {
  const sorted = [...items].sort(
    (left, right) => minutesOf(left.startTime) - minutesOf(right.startTime) || minutesOf(left.endTime) - minutesOf(right.endTime),
  );
  const draft: Placed[] = sorted.map((item) => ({ ...item, col: 0, cols: 1 }));
  draft.forEach((item, index) => {
    const used = new Set<number>();
    for (let earlier = 0; earlier < index; earlier += 1) {
      if (overlaps(draft[earlier], item)) used.add(draft[earlier].col);
    }
    let lane = 0;
    while (used.has(lane)) lane += 1;
    item.col = lane;
  });

  const parent = draft.map((_, index) => index);
  const find = (index: number): number => (parent[index] === index ? index : (parent[index] = find(parent[index])));
  const union = (left: number, right: number) => {
    parent[find(left)] = find(right);
  };
  for (let left = 0; left < draft.length; left += 1) {
    for (let right = left + 1; right < draft.length; right += 1) {
      if (overlaps(draft[left], draft[right])) union(left, right);
    }
  }
  const widest = new Map<number, number>();
  draft.forEach((item, index) => {
    const root = find(index);
    widest.set(root, Math.max(widest.get(root) ?? 0, item.col));
  });
  return draft.map((item, index) => ({ ...item, cols: (widest.get(find(index)) ?? 0) + 1 }));
}

export function Timeline({
  visits,
  selectedId,
  isToday,
  onSelect,
}: {
  visits: Reservation[];
  selectedId: number | null;
  isToday: boolean;
  onSelect: (visit: Reservation) => void;
}) {
  const { t, nameAlign } = useI18n();
  const started = useRef(false);
  const [viewport, setViewport] = useState(0);
  const [offset, setOffset] = useState(0);
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const starts = visits.map((visit) => minutesOf(visit.startTime));
  const ends = visits.map((visit) => minutesOf(visit.endTime));
  const dayStart = Math.min(OPEN, ...starts, isToday ? nowMinutes : OPEN);
  const dayEnd = Math.max(CLOSE, ...ends, isToday ? nowMinutes : CLOSE);
  const width = (dayEnd - dayStart) * PX + LABEL_PAD;
  const placed = place(visits);
  const usedLanes = placed.reduce((max, visit) => Math.max(max, visit.col + 1), 1);
  const lanes = Math.max(usedLanes, STACK);
  const height = lanes * LANE + 12;
  const hours: number[] = [];
  for (let minute = Math.floor(dayStart / 60) * 60; minute <= dayEnd; minute += 60) hours.push(minute);
  const showNow = isToday;
  const maxOffset = Math.max(dayEnd - dayStart + LABEL_PAD / PX - viewport / PX, 0);
  const canBack = offset > 0;
  const canForward = offset < maxOffset - 0.5;

  useEffect(() => {
    if (viewport <= 0) return;
    const max = Math.max(dayEnd - dayStart + LABEL_PAD / PX - viewport / PX, 0);
    setOffset((current) => {
      if (!started.current) {
        started.current = true;
        const start = showNow ? nowMinutes - dayStart - (viewport / PX) * 0.25 : 0;
        return Math.min(Math.max(start, 0), max);
      }
      return Math.min(Math.max(current, 0), max);
    });
  }, [viewport, dayStart, dayEnd, showNow, nowMinutes]);

  function nudge(direction: -1 | 1) {
    setOffset((current) => Math.min(Math.max(current + direction * STEP, 0), maxOffset));
  }

  return (
    <View style={{ direction: 'ltr' }}>
      <View className="mb-3 flex-row justify-end">
        <Arrow label={t('30 minutes earlier')} glyph="←" disabled={!canBack} onPress={() => nudge(-1)} />
        <Arrow label={t('30 minutes later')} glyph="→" disabled={!canForward} onPress={() => nudge(1)} />
      </View>
      <View onLayout={(event) => setViewport(event.nativeEvent.layout.width)}>
        {viewport > 0 ? (
          <View style={{ width: viewport, overflow: 'hidden' }}>
            <View style={{ width, transform: [{ translateX: -offset * PX }] }}>
              <View style={{ height: 22, position: 'relative' }}>
                {hours.map((minute) => (
                  <Text
                    key={minute}
                    style={[font.medium, { position: 'absolute', left: (minute - dayStart) * PX, fontVariant: ['tabular-nums'] }]}
                    className="text-xs text-mute"
                  >
                    {clockLabel(minute)}
                  </Text>
                ))}
              </View>
              <View style={{ width, height, position: 'relative' }} className="rounded-2xl bg-card">
                {hours.map((minute) => (
                  <View
                    key={minute}
                    pointerEvents="none"
                    style={{ position: 'absolute', left: (minute - dayStart) * PX, top: 0, bottom: 0, width: 1 }}
                    className="bg-line"
                  />
                ))}
                {placed.map((visit) => {
                  const tone = therapyTone(visit.therapyType);
                  const left = (minutesOf(visit.startTime) - dayStart) * PX + 4;
                  const block = Math.max((minutesOf(visit.endTime) - minutesOf(visit.startTime)) * PX - 8, 56);
                  const selected = visit.id === selectedId;
                  return (
                    <Pressable
                      key={visit.id}
                      accessibilityRole="button"
                      onPress={() => onSelect(visit)}
                      style={{
                        position: 'absolute',
                        left,
                        width: block,
                        top: visit.col * LANE + 8,
                        height: LANE - 8,
                        backgroundColor: tone.bg,
                        borderTopColor: tone.line,
                        borderTopWidth: 4,
                        borderWidth: selected ? 2 : 0,
                        borderColor: '#0f5c5e',
                        opacity: visit.status === 'cancelled' ? 0.6 : 1,
                        paddingHorizontal: 8,
                        paddingTop: 8,
                      }}
                      className="overflow-hidden rounded-lg"
                    >
                      <Text style={[font.medium, { color: tone.fg, fontVariant: ['tabular-nums'] }]} className="text-xs" numberOfLines={1}>
                        {latinRun(`${visit.startTime}–${visit.endTime}`)}
                      </Text>
                      <Text style={[font.semibold, nameAlign, { color: tone.fg }]} className="text-sm" numberOfLines={1}>
                        {visit.patientName}
                      </Text>
                      {block > 108 && visit.reason ? (
                        <Text style={[font.sans, { color: tone.fg }]} className="text-xs" numberOfLines={1}>
                          {visit.reason}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
                {showNow ? (
                  <View
                    pointerEvents="none"
                    style={{ position: 'absolute', left: (nowMinutes - dayStart) * PX, top: 0, bottom: 0, width: 2 }}
                    className="bg-clay"
                  />
                ) : null}
              </View>
            </View>
          </View>
        ) : (
          <View style={{ height }} />
        )}
      </View>
    </View>
  );
}

function Arrow({
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
      className="ms-2 h-9 w-9 items-center justify-center rounded-full border border-line bg-card"
      style={{ opacity: disabled ? 0.35 : 1 }}
    >
      <Text style={font.semibold} className="text-base text-ink">
        {glyph}
      </Text>
    </Pressable>
  );
}
