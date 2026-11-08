import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { DocumentCards } from '../../../../components/DocumentCards';
import { Screen } from '../../../../components/Screen';
import { Banner, Button, PageTitle, confirmAction, font } from '../../../../components/ui';
import { api } from '../../../../lib/api';
import { useAuth } from '../../../../lib/auth';
import { plural, useI18n } from '../../../../lib/i18n';
import { canDelete, canUpload } from '../../../../lib/permissions';
import type { DocumentRow } from '../../../../lib/types';

export default function PatientDocumentsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const patientId = Number(params.id);
  const { user } = useAuth();
  const { t } = useI18n();
  const [name, setName] = useState('Patient');
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canRemove = user ? canDelete(user.role) : false;
  const canWrite = user ? canUpload(user.role) : false;

  const load = useCallback(async () => {
    if (!Number.isInteger(patientId)) return;
    try {
      const [person, files] = await Promise.all([api.patient(patientId), api.documents({ patientId })]);
      setName(person.patient.fullName);
      setDocuments(files.documents);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load documents.');
    }
  }, [patientId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function removeDocument(document: DocumentRow) {
    const ok = await confirmAction('Remove this document?', document.name);
    if (!ok) return;
    try {
      await api.deleteDocument(document.id);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not remove the document.');
    }
  }

  async function generate() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await api.generateReport(patientId);
      const unread = result.skipped ? t(' {n} could not be read.', { n: result.skipped }) : '';
      setMessage(t('Added “{name}”. The agent read {read}.{skipped} Review it before clinical use.', {
        name: result.name,
        read: plural(result.read, '1 document', '{n} documents'),
        skipped: unread,
      }));
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not write the report.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Pressable accessibilityRole="button" onPress={() => router.push('/documents')} className="mb-4 self-start">
        <Text style={font.medium} className="text-sm text-moss">
          {t('All documents')}
        </Text>
      </Pressable>
      <PageTitle
        kicker="Patient"
        raw
        title={name}
        detail="Documents for this patient. A report uses only this chart, these session notes, and these files."
      />
      {message ? <Banner tone="ok">{message}</Banner> : null}
      {error ? <Banner tone="error">{error}</Banner> : null}
      {canWrite ? (
        <View className="mb-4">
          <Button label={busy ? 'Writing the report…' : 'Generate report'} disabled={busy} onPress={() => void generate()} />
        </View>
      ) : null}
      <DocumentCards
        documents={documents}
        canRemove={canRemove}
        empty="No documents for this patient yet."
        onRemove={(document) => void removeDocument(document)}
        onError={setError}
      />
    </Screen>
  );
}
