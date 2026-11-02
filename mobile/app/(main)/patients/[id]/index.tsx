import { useLocalSearchParams } from 'expo-router';

import { PatientRecord } from '../../../../components/PatientRecord';

export default function PatientScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const patientId = Number(params.id);
  return <PatientRecord patientId={patientId} showBack />;
}
