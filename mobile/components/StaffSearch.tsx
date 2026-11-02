import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { api } from '../lib/api';
import type { User } from '../lib/types';
import { Banner, Field, TherapyPill, font, therapySurface } from './ui';

export function StaffSearch({
  selected,
  onSelect,
  listHeight,
  fillList,
}: {
  selected: User | null;
  onSelect: (person: User | null) => void;
  listHeight?: number;
  fillList?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (selected) return undefined;
    let active = true;
    api
      .users()
      .then((data) => {
        if (active) {
          setPeople(
            [...data.users].sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })),
          );
        }
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Could not load staff.');
      });
    return () => {
      active = false;
    };
  }, [selected]);

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return people;
    return people.filter(
      (person) =>
        person.name.toLowerCase().includes(term) ||
        person.email.toLowerCase().includes(term) ||
        (person.phone ?? '').toLowerCase().includes(term),
    );
  }, [people, query]);

  if (selected) {
    return (
      <View className="mb-4 rounded-2xl border p-4" style={therapySurface(selected.therapyType)}>
        <View className="mb-1 flex-row items-start justify-between">
          <Text style={font.semibold} className="mr-3 flex-1 text-lg text-ink">
            {selected.name}
          </Text>
          <TherapyPill therapy={selected.therapyType} />
        </View>
        <Text style={font.sans} className="mt-1 text-sm text-mute">
          {selected.phone || selected.email}
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
      {results.map((person) => (
        <Pressable
          key={person.id}
          accessibilityRole="button"
          onPress={() => onSelect(person)}
          className="mb-2 rounded-xl border px-3 py-3"
          style={therapySurface(person.therapyType)}
        >
          <View className="flex-row items-start justify-between">
            <View className="mr-3 flex-1">
              <Text style={font.medium} className="text-base text-ink">
                {person.name}
              </Text>
              <Text style={font.sans} className="mt-0.5 text-sm text-mute">
                {person.phone || person.email}
              </Text>
            </View>
            <TherapyPill therapy={person.therapyType} />
          </View>
        </Pressable>
      ))}
      {results.length === 0 && query.trim() ? (
        <Text style={font.sans} className="mb-3 text-sm text-mute">
          No one matches that name.
        </Text>
      ) : null}
    </View>
  );

  const scrolling = fillList || listHeight != null;

  return (
    <View className="mb-2" style={fillList ? { flex: 1, minHeight: 0 } : undefined}>
      <Field label="Find staff" value={query} onChangeText={setQuery} placeholder="Name, phone, or email" autoCapitalize="words" />
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
