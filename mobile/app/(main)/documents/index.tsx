import { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';

import { DocumentCards } from '../../../components/DocumentCards';
import { PatientSearch } from '../../../components/PatientSearch';
import { Screen } from '../../../components/Screen';
import { StaffSearch } from '../../../components/StaffSearch';
import { Banner, Button, Field, PageTitle, TherapyPill, confirmAction, font, therapySurface } from '../../../components/ui';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import { useI18n } from '../../../lib/i18n';
import { canDelete, canUpload } from '../../../lib/permissions';
import type { DocumentRow, Patient, PickedFile, User } from '../../../lib/types';

type Section = 'patients' | 'staff' | 'archive';
type Subject = 'patients' | 'staff' | 'archive';

type PersonRow = {
  id: number;
  name: string;
  therapyType: string | null;
  documents: number;
};

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'patients', label: 'Patients' },
  { id: 'staff', label: 'Staff' },
  { id: 'archive', label: 'Archive' },
];

export default function DocumentsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const section: Section = params.tab === 'staff' || params.tab === 'archive' ? params.tab : 'patients';
  const { user } = useAuth();
  const { t, nameAlign } = useI18n();
  const { width, height } = useWindowDimensions();
  const [patients, setPatients] = useState<PersonRow[]>([]);
  const [staffPeople, setStaffPeople] = useState<PersonRow[]>([]);
  const [archive, setArchive] = useState<DocumentRow[]>([]);
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [subject, setSubject] = useState<Subject>('patients');
  const [patient, setPatient] = useState<Patient | null>(null);
  const [staff, setStaff] = useState<User | null>(null);
  const [file, setFile] = useState<PickedFile | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const upload = user ? canUpload(user.role) : false;
  const canRemove = user ? canDelete(user.role) : false;
  const addMaxHeight = height - 32;
  const pickingPerson = subject === 'archive' ? false : subject === 'staff' ? !staff : !patient;

  const load = useCallback(async () => {
    try {
      const [people, files] = await Promise.all([api.documentPeople(), api.documents({ archive: true })]);
      setPatients(
        people.patients.map((person) => ({
          id: person.id,
          name: person.fullName,
          therapyType: person.therapyType,
          documents: person.documents,
        })),
      );
      setStaffPeople(
        people.staff.map((person) => ({
          id: person.id,
          name: person.name,
          therapyType: person.therapyType,
          documents: person.documents,
        })),
      );
      setArchive(files.documents);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load documents.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const people = section === 'staff' ? staffPeople : patients;
  const visiblePeople = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return people;
    return people.filter((person) => person.name.toLowerCase().includes(term));
  }, [people, query]);

  const visibleArchive = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return archive;
    return archive.filter((document) => document.name.toLowerCase().includes(term));
  }, [archive, query]);

  function openSection(next: Section) {
    setQuery('');
    router.setParams({ tab: next });
  }

  function resetForm() {
    setName('');
    setDescription('');
    setSubject('patients');
    setPatient(null);
    setStaff(null);
    setFile(null);
    setFormError(null);
  }

  function beginAdd() {
    resetForm();
    setAdding(true);
    setMessage(null);
  }

  function cancelAdd() {
    if (busy) return;
    setAdding(false);
    resetForm();
  }

  async function pickFile() {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
    if (result.canceled) return;
    const asset = result.assets[0];
    setFile({
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType ?? undefined,
      file: 'file' in asset ? (asset.file as Blob | undefined) : undefined,
    });
    if (!name.trim()) setName(asset.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '));
  }

  async function submit() {
    if (!name.trim()) {
      setFormError('Name the document. Search uses that name.');
      return;
    }
    if (!file) {
      setFormError('Attach a file.');
      return;
    }
    if (subject === 'patients' && !patient) {
      setFormError('Choose a patient.');
      return;
    }
    if (subject === 'staff' && !staff) {
      setFormError('Choose a staff member.');
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      await api.createDocument({
        name: name.trim(),
        description: description.trim(),
        patientId: subject === 'patients' ? patient?.id : undefined,
        staffId: subject === 'staff' ? staff?.id : undefined,
        file,
      });
      setMessage(t('Added “{name}”.', { name: name.trim() }));
      setAdding(false);
      resetForm();
      if (subject === 'archive') router.setParams({ tab: 'archive' });
      await load();
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : 'Could not add the document.');
    } finally {
      setBusy(false);
    }
  }

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
      <View className="flex-row items-start justify-between">
        <View className="me-4 flex-1">
          <PageTitle kicker="Files" title="Documents" detail="Patients, staff, and the archive." />
        </View>
        {upload ? (
          <Pressable accessibilityRole="button" onPress={beginAdd} className="mt-1 rounded-full bg-clay px-3 py-2">
            <Text style={font.medium} className="text-sm text-card">
              {t('Add a document')}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {message ? <Banner tone="ok">{message}</Banner> : null}
      {error ? <Banner tone="error">{error}</Banner> : null}
      <View className="mb-4 flex-row rounded-full border border-line bg-card p-1">
        {SECTIONS.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityState={{ selected: section === item.id }}
            onPress={() => openSection(item.id)}
            className={`flex-1 items-center rounded-full py-2 ${section === item.id ? 'bg-pine' : ''}`}
          >
            <Text style={[font.medium, { color: section === item.id ? '#ffffff' : '#123033' }]} className="text-sm">
              {t(item.label)}
            </Text>
          </Pressable>
        ))}
      </View>
      <Field
        label={section === 'archive' ? 'Search by name' : 'Search'}
        value={query}
        onChangeText={setQuery}
        placeholder={section === 'archive' ? 'Blood panel, consent, referral' : 'Name'}
      />
      {section === 'archive' ? (
        <DocumentCards
          documents={visibleArchive}
          canRemove={canRemove}
          empty={archive.length === 0 ? 'No archive documents yet.' : 'No documents match this search.'}
          onRemove={(document) => void removeDocument(document)}
          onError={setError}
        />
      ) : visiblePeople.length === 0 ? (
        <Text style={font.sans} className="text-base text-mute">
          {people.length === 0 ? (section === 'staff' ? t('No staff yet.') : t('No patients yet.')) : t('No one matches this search.')}
        </Text>
      ) : (
        visiblePeople.map((person) => (
          <Pressable
            key={person.id}
            accessibilityRole="button"
            onPress={() =>
              router.push(section === 'staff' ? `/documents/staff/${person.id}` : `/documents/patient/${person.id}`)
            }
            className="mb-2 rounded-2xl border px-4 py-3"
            style={therapySurface(person.therapyType)}
          >
            <View className="flex-row items-center justify-between">
              <View className="me-3 flex-1">
                <Text style={[font.semibold, nameAlign]} className="text-base text-ink">
                  {person.name}
                </Text>
                <Text style={[font.sans, nameAlign]} className="mt-1 text-sm text-mute">
                  {person.documents === 1 ? t('1 document') : t('{n} documents', { n: person.documents })}
                </Text>
              </View>
              <TherapyPill therapy={person.therapyType} />
            </View>
          </Pressable>
        ))
      )}

      {adding ? (
        <Modal visible transparent animationType="fade" onRequestClose={cancelAdd}>
          <View className="flex-1 items-center justify-center px-4 py-4" style={{ backgroundColor: 'rgba(18, 48, 51, 0.45)' }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Close add document" onPress={cancelAdd} className="absolute inset-0" />
            <View
              className="rounded-2xl border border-line bg-card px-6 py-5"
              style={{
                width: Math.min(width - 32, 720),
                maxHeight: addMaxHeight,
                height: pickingPerson ? addMaxHeight : undefined,
                overflow: 'hidden',
              }}
            >
              <Text style={font.display} className="mb-3 text-2xl text-ink">
                {t('Add a document')}
              </Text>
              {formError ? <Banner tone="error">{formError}</Banner> : null}
              <Field label="Document name" value={name} onChangeText={setName} placeholder="Hassan blood panel" />
              <Field label="Description" value={description} onChangeText={setDescription} placeholder="What the file is for" />
              <Text style={font.medium} className="mb-2 text-xs uppercase tracking-widest text-moss">
                {t('This document refers to')}
              </Text>
              <View className="mb-3 flex-row rounded-full border border-line bg-card p-1">
                {(['patients', 'staff', 'archive'] as Subject[]).map((item) => (
                  <Pressable
                    key={item}
                    accessibilityRole="button"
                    accessibilityState={{ selected: subject === item }}
                    onPress={() => setSubject(item)}
                    className={`flex-1 items-center rounded-full py-2 ${subject === item ? 'bg-pine' : ''}`}
                  >
                    <Text style={[font.medium, { color: subject === item ? '#ffffff' : '#123033' }]} className="text-sm capitalize">
                      {t(item)}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {subject === 'staff' ? (
                <StaffSearch selected={staff} onSelect={setStaff} fillList={pickingPerson} />
              ) : subject === 'patients' ? (
                <PatientSearch selected={patient} onSelect={setPatient} fillList={pickingPerson} />
              ) : (
                <Text style={font.sans} className="mb-3 text-sm leading-5 text-mute">
                  {t('Archive files are not tied to a patient or a staff member.')}
                </Text>
              )}
              <Pressable accessibilityRole="button" onPress={() => void pickFile()} className="mb-3 rounded-xl border border-dashed border-line bg-card px-3 py-3">
                <Text style={font.medium} className="text-sm text-ink">
                  {file ? file.name : t('Choose a PDF, image, text, or Word file')}
                </Text>
              </Pressable>
              <View className="flex-row">
                <View className="me-3 flex-1">
                  <Button label={busy ? 'Adding…' : 'Save document'} disabled={busy} onPress={() => void submit()} />
                </View>
                <View className="flex-1">
                  <Button label="Cancel" tone="ghost" onPress={cancelAdd} />
                </View>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </Screen>
  );
}
