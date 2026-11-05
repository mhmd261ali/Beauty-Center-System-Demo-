import { Text, View } from 'react-native';

import { Screen } from '../../components/Screen';
import { PageTitle, font } from '../../components/ui';

const SERVICES = [
  {
    title: 'AI clinic assistant',
    lines: [
      'An optional assistant that can summarize appointment histories, help staff find records, draft administrative messages, and highlight incomplete documentation.',
      'Medical summaries should always be reviewed by authorized clinicians.',
    ],
  },
  {
    title: 'Digital intake and consent forms',
    lines: [
      'Patients complete medical questionnaires, update their information, and electronically sign consent forms before arriving.',
      'Support configurable forms by specialty, signature timestamps, and version history.',
    ],
  },
];

export default function ServicesScreen() {
  return (
    <Screen>
      <PageTitle kicker="Clinic" title="Available services" />
      {SERVICES.map((service) => (
        <View key={service.title} className="mb-8">
          <Text style={font.semibold} className="mb-2 text-xl text-ink">
            {service.title}
          </Text>
          {service.lines.map((line) => (
            <Text key={line} style={font.sans} className="mb-2 text-base leading-6 text-ink">
              {line}
            </Text>
          ))}
        </View>
      ))}
    </Screen>
  );
}
