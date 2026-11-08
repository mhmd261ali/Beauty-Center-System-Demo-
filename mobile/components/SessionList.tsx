import { Text, View } from 'react-native';

import { formatDay, latinRun } from '../lib/format';
import { useI18n } from '../lib/i18n';
import type { Reservation } from '../lib/types';
import { StatusPill, TherapyPill, font, therapySurface } from './ui';

export function SessionCounts({ visits }: { visits: Reservation[] }) {
  const { t } = useI18n();
  const counts = [
    { label: 'Scheduled', value: visits.filter((visit) => visit.status === 'scheduled').length },
    { label: 'Completed', value: visits.filter((visit) => visit.status === 'completed').length },
    { label: 'Cancelled', value: visits.filter((visit) => visit.status === 'cancelled').length },
  ];
  return (
    <View className="mt-5 flex-row">
      {counts.map((item, index) => (
        <View key={item.label} className={`flex-1 rounded-2xl border border-line bg-card px-4 py-3 ${index < counts.length - 1 ? 'me-3' : ''}`}>
          <Text style={font.medium} className="text-xs uppercase tracking-widest text-moss">
            {item.label}
          </Text>
          <Text style={font.display} className="mt-1 text-3xl text-ink">
            {item.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function SessionList({ title, visits, empty }: { title: string; visits: Reservation[]; empty: string }) {
  const { t, nameAlign } = useI18n();
  return (
    <View className="mt-5">
      <Text style={font.medium} className="mb-3 text-xs uppercase tracking-widest text-moss">
        {t(title)}
      </Text>
      {visits.length === 0 ? (
        <Text style={font.sans} className="text-sm text-mute">
          {t(empty)}
        </Text>
      ) : (
        visits.map((visit, index) => (
          <View key={visit.id} className="flex-row">
            <View className="me-3 items-center">
              <View className="mt-4 h-2.5 w-2.5 rounded-full bg-pine" />
              {index < visits.length - 1 ? <View className="w-px flex-1 bg-line" /> : null}
            </View>
            <View className="mb-3 flex-1 rounded-2xl border p-4" style={therapySurface(visit.therapyType)}>
              <View className="flex-row items-start justify-between">
                <View className="me-3 flex-1">
                  <Text style={font.semibold} className="text-base text-ink">
                    {formatDay(visit.scheduledDate)}
                  </Text>
                  <Text style={[font.medium, { fontVariant: ['tabular-nums'] }]} className="mt-1 text-sm text-mute">
                    {latinRun(`${visit.startTime}–${visit.endTime}`)}
                  </Text>
                </View>
                <View className="items-end">
                  <TherapyPill therapy={visit.therapyType} />
                  <View className="mt-1">
                    <StatusPill status={visit.status} />
                  </View>
                </View>
              </View>
              {visit.doctorName ? (
                <Text style={[font.sans, nameAlign]} className="mt-2 text-sm text-mute">
                  {visit.doctorName}
                </Text>
              ) : null}
              {visit.reason ? (
                <Text style={font.sans} className="mt-2 text-base text-ink">
                  {visit.reason}
                </Text>
              ) : null}
              {visit.notes ? (
                <Text style={font.sans} className="mt-2 text-sm leading-5 text-mute">
                  {visit.notes}
                </Text>
              ) : null}
            </View>
          </View>
        ))
      )}
    </View>
  );
}
