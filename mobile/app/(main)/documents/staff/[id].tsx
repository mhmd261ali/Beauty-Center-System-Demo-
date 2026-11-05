import { useCallback, useState } from 'react';
import { Pressable, Text } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { DocumentCards } from '../../../../components/DocumentCards';
import { Screen } from '../../../../components/Screen';
import { Banner, PageTitle, confirmAction, font } from '../../../../components/ui';
import { api } from '../../../../lib/api';
import { useAuth } from '../../../../lib/auth';
import { canDelete } from '../../../../lib/permissions';
import type { DocumentRow } from '../../../../lib/types';

export default function StaffDocumentsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const staffId = Number(params.id);
  const { user } = useAuth();
  const [name, setName] = useState('Staff');
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const canRemove = user ? canDelete(user.role) : false;

  const load = useCallback(async () => {
    if (!Number.isInteger(staffId)) return;
    try {
      const [people, files] = await Promise.all([api.documentPeople(), api.documents({ staffId })]);
      setName(people.staff.find((person) => person.id === staffId)?.name ?? 'Staff');
      setDocuments(files.documents);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load documents.');
    }
  }, [staffId]);

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

  return (
    <Screen>
      <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/documents', params: { tab: 'staff' } })} className="mb-4 self-start">
        <Text style={font.medium} className="text-sm text-moss">
          All documents
        </Text>
      </Pressable>
      <PageTitle kicker="Staff" title={name} detail="Documents filed for this staff member." />
      {error ? <Banner tone="error">{error}</Banner> : null}
      <DocumentCards
        documents={documents}
        canRemove={canRemove}
        empty="No documents for this staff member yet."
        onRemove={(document) => void removeDocument(document)}
        onError={setError}
      />
    </Screen>
  );
}
