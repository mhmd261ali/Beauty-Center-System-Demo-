import { useCallback, useState } from 'react';
import { Pressable, Text } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { Screen } from '../../../../components/Screen';
import { SessionCounts, SessionList } from '../../../../components/SessionList';
import { Banner, PageTitle, font } from '../../../../components/ui';
import { api } from '../../../../lib/api';
import { todayISO } from '../../../../lib/format';
import type { Reservation } from '../../../../lib/types';

export default function PatientHistoryScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const patientId = Number(params.id);
  const router = useRouter();
  const [name, setName] = useState('');
  const [visits, setVisits] = useState<Reservation[]>([]);
  const [history, setHistory] = useState<Reservation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [person, history] = await Promise.all([api.patient(patientId), api.reservations({ patientId })]);
      setName(person.patient.fullName);
      const today = todayISO();
      setVisits(history.reservations);
      setHistory(
        history.reservations
          .filter((visit) => !(visit.scheduledDate >= today && visit.status === 'scheduled'))
          .sort((left, right) => right.scheduledDate.localeCompare(left.scheduledDate) || right.startTime.localeCompare(left.startTime)),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load this history.');
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <Screen>
      <Pressable accessibilityRole="button" onPress={() => router.push(`/patients/${patientId}`)} className="mb-4 self-start">
        <Text style={font.medium} className="text-sm text-moss">
          Back to patient
        </Text>
      </Pressable>
      {loading ? (
        <Text style={font.sans} className="text-mute">
          Opening the history…
        </Text>
      ) : null}
      {error ? <Banner tone="error">{error}</Banner> : null}
      {name ? (
        <>
          <PageTitle kicker="History" title={name} detail={`${history.length} ${history.length === 1 ? 'earlier session' : 'earlier sessions'}.`} />
          <SessionCounts visits={visits} />
          <SessionList title="All sessions" visits={history} empty="No earlier sessions." />
        </>
      ) : null}
    </Screen>
  );
}
