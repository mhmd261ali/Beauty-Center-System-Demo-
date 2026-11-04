import { useCallback, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';

import { PatientSearch } from '../../components/PatientSearch';
import { Screen } from '../../components/Screen';
import { StaffSearch } from '../../components/StaffSearch';
import { Banner, Button, Chip, DateField, Field, PageTitle, TherapyPill, confirmAction, font, therapySurface } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { downloadDocument } from '../../lib/files';
import { addDays, formatStamp, todayISO } from '../../lib/format';
import { canDelete, canUpload, specialtiesFor } from '../../lib/permissions';
import type { DocumentRow, Patient, PickedFile, User } from '../../lib/types';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PATIENT_PAGE = 10;

export default function DocumentsScreen() {
  const { user } = useAuth();
  const specialties = specialtiesFor(user);
  const { width, height } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [people, setPeople] = useState<{ id: number; fullName: string; phone: string | null }[]>([]);
  const [patientSearch, setPatientSearch] = useState('');
  const [patientPage, setPatientPage] = useState(0);
  const [patientFilter, setPatientFilter] = useState<'all' | 'none' | number>('all');
  const [userFilter, setUserFilter] = useState<'all' | number>('all');
  const [therapy, setTherapy] = useState('All');
  const [date, setDate] = useState('');
  const [filtering, setFiltering] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [subject, setSubject] = useState<'staff' | 'patients'>('patients');
  const [patient, setPatient] = useState<Patient | null>(null);
  const [staff, setStaff] = useState<User | null>(null);
  const [file, setFile] = useState<PickedFile | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const upload = user ? canUpload(user.role) : false;
  const canRemove = user ? canDelete(user.role) : false;
  const today = todayISO();
  const tomorrow = addDays(today, 1);
  const addMaxHeight = height - 32;
  const pickingPerson = subject === 'staff' ? !staff : !patient;

  const load = useCallback(async () => {
    try {
      const [data, roster] = await Promise.all([api.documents(''), api.patients('', todayISO())]);
      setDocuments(data.documents);
      setPeople(
        [...roster.patients]
          .sort((left, right) => left.fullName.localeCompare(right.fullName, undefined, { sensitivity: 'base' }))
          .map((person) => ({ id: person.id, fullName: person.fullName, phone: person.phone })),
      );
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

  const matchedPatients = useMemo(() => {
    const term = patientSearch.trim().toLowerCase();
    if (!term) return people;
    return people.filter(
      (person) => person.fullName.toLowerCase().includes(term) || (person.phone ?? '').toLowerCase().includes(term),
    );
  }, [people, patientSearch]);

  const patientPages = Math.max(Math.ceil(matchedPatients.length / PATIENT_PAGE), 1);
  const patientPageSafe = Math.min(patientPage, patientPages - 1);
  const showPatientPager = matchedPatients.length > PATIENT_PAGE;
  const pagedPatients = showPatientPager
    ? matchedPatients.slice(patientPageSafe * PATIENT_PAGE, patientPageSafe * PATIENT_PAGE + PATIENT_PAGE)
    : matchedPatients;

  const users = useMemo(() => {
    const seen = new Map<number, string>();
    documents.forEach((document) => {
      if (document.uploadedById && document.uploadedByName) seen.set(document.uploadedById, document.uploadedByName);
    });
    return [...seen.entries()].sort((left, right) => left[1].localeCompare(right[1])).map(([id, name]) => ({ id, name }));
  }, [documents]);

  const filtersOn = patientFilter !== 'all' || userFilter !== 'all' || therapy !== 'All' || DATE.test(date);

  const visible = useMemo(() => {
    const chosenDate = DATE.test(date) ? date : '';
    const term = query.trim().toLowerCase();
    return documents.filter((document) => {
      const nameMatch = !term || document.name.toLowerCase().includes(term);
      const patientMatch =
        patientFilter === 'all' ||
        (patientFilter === 'none' && !document.patientId) ||
        document.patientId === patientFilter;
      const userMatch = userFilter === 'all' || document.uploadedById === userFilter;
      const therapyMatch = therapy === 'All' || document.therapyType === therapy;
      const dateMatch = !chosenDate || document.createdDate === chosenDate;
      return nameMatch && patientMatch && userMatch && therapyMatch && dateMatch;
    });
  }, [documents, query, patientFilter, userFilter, therapy, date]);

  function resetForm() {
    setName('');
    setDescription('');
    setSubject('patients');
    setPatient(null);
    setStaff(null);
    setFile(null);
    setFormError(null);
  }

  function chooseStaff(person: User | null) {
    setStaff(person);
    if (person) setPatient(null);
  }

  function choosePatient(person: Patient | null) {
    setPatient(person);
    if (person) setStaff(null);
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
      setMessage(`Added “${name.trim()}”.`);
      setAdding(false);
      resetForm();
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

  function clearFilters() {
    setPatientFilter('all');
    setUserFilter('all');
    setTherapy('All');
    setDate('');
    setPatientSearch('');
    setPatientPage(0);
  }

  function closeFilters() {
    setFiltering(false);
    setPatientSearch('');
    setPatientPage(0);
  }

  const list = (
    <View>
      <Field label="Search by name" value={query} onChangeText={setQuery} placeholder="Blood panel, consent, referral" />
      {visible.length === 0 ? (
        <Text style={font.sans} className="text-base text-mute">
          {documents.length === 0 ? 'No documents yet.' : 'No documents match these filters.'}
        </Text>
      ) : (
        visible.map((document) => (
          <View key={document.id} className="mb-3 flex-row items-center rounded-2xl border p-4" style={therapySurface(document.therapyType)}>
            <View className="mr-3 flex-1">
              <View className="mb-1 flex-row items-start justify-between">
                <Text style={font.semibold} className="mr-3 flex-1 text-lg text-ink">
                  {document.name}
                </Text>
                <TherapyPill therapy={document.therapyType} />
              </View>
              <Text style={font.sans} className="mt-1 text-sm text-mute">
                {[
                  document.patientName,
                  document.staffName,
                  document.uploadedByName ? `Added by ${document.uploadedByName}` : null,
                  formatStamp(document.createdAt),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
              {document.description ? (
                <Text style={font.sans} className="mt-2 text-sm leading-5 text-ink">
                  {document.description}
                </Text>
              ) : null}
            </View>
            <View className="flex-row items-center">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Download ${document.name}`}
                onPress={() => void downloadDocument(document).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Could not download that file.'))}
                className="h-10 w-10 items-center justify-center rounded-full"
              >
                <ActionIcon kind="download" />
              </Pressable>
              {canRemove ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${document.name}`}
                  onPress={() => void removeDocument(document)}
                  className="h-10 w-10 items-center justify-center rounded-full"
                >
                  <ActionIcon kind="remove" />
                </Pressable>
              ) : null}
            </View>
          </View>
        ))
      )}
    </View>
  );

  return (
    <Screen>
      <View className="flex-row items-start justify-between">
        <View className="mr-4 flex-1">
          <PageTitle kicker="Files" title="Documents" detail="Search and filter by patient, who added it, specialty, or date." />
        </View>
        <View className="mt-1 flex-row">
          <Pressable
            accessibilityRole="button"
            onPress={() => setFiltering(true)}
            className={`mr-2 rounded-full px-3 py-2 ${filtersOn ? 'bg-pine' : 'border border-line bg-card'}`}
          >
            <Text style={font.medium} className={`text-sm ${filtersOn ? 'text-card' : 'text-ink'}`}>
              {filtersOn ? 'Filters on' : 'Filter'}
            </Text>
          </Pressable>
          {upload ? (
            <Pressable accessibilityRole="button" onPress={beginAdd} className="rounded-full bg-clay px-3 py-2">
              <Text style={font.medium} className="text-sm text-card">
                Add a document
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      {message ? <Banner tone="ok">{message}</Banner> : null}
      {error ? <Banner tone="error">{error}</Banner> : null}
      {upload ? null : (
        <Text style={font.sans} className="mb-4 text-sm leading-5 text-mute">
          You can search and download. A sub-admin or admin adds documents.
        </Text>
      )}
      {list}

      {filtering ? (
        <Modal visible transparent animationType="fade" onRequestClose={closeFilters}>
          <View className="flex-1 items-center justify-center px-4" style={{ backgroundColor: 'rgba(18, 48, 51, 0.45)' }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Close filters" onPress={closeFilters} className="absolute inset-0" />
            <View className="rounded-2xl border border-line bg-card p-6" style={{ width: Math.min(width - 32, 720) }}>
              <Text style={font.display} className="mb-4 text-2xl text-ink">
                Filter documents
              </Text>
              <Text style={font.medium} className="mb-2 text-xs uppercase tracking-widest text-moss">
                Patient
              </Text>
              <Field
                label="Find a patient"
                value={patientSearch}
                onChangeText={(value) => {
                  setPatientSearch(value);
                  setPatientPage(0);
                }}
                placeholder="Name or phone"
                autoCapitalize="words"
              />
              {showPatientPager ? (
                <View className="mb-3 flex-row items-center justify-between">
                  <PageArrow
                    label="Previous patients"
                    glyph="←"
                    disabled={patientPageSafe === 0}
                    onPress={() => setPatientPage(patientPageSafe - 1)}
                  />
                  <Text style={font.medium} className="text-sm text-mute">
                    {patientPageSafe * PATIENT_PAGE + 1}–{patientPageSafe * PATIENT_PAGE + pagedPatients.length} of {matchedPatients.length}
                  </Text>
                  <PageArrow
                    label="Next patients"
                    glyph="→"
                    disabled={patientPageSafe >= patientPages - 1}
                    onPress={() => setPatientPage(patientPageSafe + 1)}
                  />
                </View>
              ) : null}
              <View className="flex-row flex-wrap">
                <Chip label="All" active={patientFilter === 'all'} onPress={() => setPatientFilter('all')} />
                <Chip label="No patient" active={patientFilter === 'none'} onPress={() => setPatientFilter('none')} />
                {pagedPatients.map((item) => (
                  <Chip key={item.id} label={item.fullName} active={patientFilter === item.id} onPress={() => setPatientFilter(item.id)} />
                ))}
              </View>
              {matchedPatients.length === 0 ? (
                <Text style={font.sans} className="mb-2 text-sm text-mute">
                  No patient matches that search.
                </Text>
              ) : null}
              <Text style={font.medium} className="mb-2 mt-3 text-xs uppercase tracking-widest text-moss">
                Added by
              </Text>
              <View className="flex-row flex-wrap">
                <Chip label="All" active={userFilter === 'all'} onPress={() => setUserFilter('all')} />
                {users.map((item) => (
                  <Chip key={item.id} label={item.name} active={userFilter === item.id} onPress={() => setUserFilter(item.id)} />
                ))}
              </View>
              <Text style={font.medium} className="mb-2 mt-3 text-xs uppercase tracking-widest text-moss">
                Therapy
              </Text>
              <View className="flex-row flex-wrap">
                <Chip label="All" active={therapy === 'All'} onPress={() => setTherapy('All')} />
                {specialties.map((item) => (
                  <Chip key={item} label={item} active={therapy === item} onPress={() => setTherapy(item)} />
                ))}
              </View>
              <Text style={font.medium} className="mb-2 mt-3 text-xs uppercase tracking-widest text-moss">
                Date
              </Text>
              <View className="flex-row flex-wrap">
                <Chip label="Any date" active={date.trim() === ''} onPress={() => setDate('')} />
                <Chip label="Today" active={date === today} onPress={() => setDate(today)} />
                <Chip label="Tomorrow" active={date === tomorrow} onPress={() => setDate(tomorrow)} />
              </View>
              <DateField label="Or pick a date" value={date} onChange={setDate} />
              <View className="flex-row">
                <View className="mr-3 flex-1">
                  <Button label="Done" onPress={closeFilters} />
                </View>
                <View className="flex-1">
                  <Button label="Clear" tone="ghost" onPress={clearFilters} />
                </View>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}

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
              <View>
                <Text style={font.display} className="mb-3 text-2xl text-ink">
                  Add a document
                </Text>
                {formError ? <Banner tone="error">{formError}</Banner> : null}
                <Field label="Document name" value={name} onChangeText={setName} placeholder="Hassan blood panel" />
                <Field label="Description" value={description} onChangeText={setDescription} placeholder="What the file is for" />
                <Text style={font.medium} className="mb-2 text-xs uppercase tracking-widest text-moss">
                  This document refers to
                </Text>
                <View className="mb-3 flex-row rounded-full border border-line bg-card p-1">
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: subject === 'staff' }}
                    onPress={() => setSubject('staff')}
                    className={`flex-1 items-center rounded-full py-2 ${subject === 'staff' ? 'bg-pine' : ''}`}
                  >
                    <Text style={[font.medium, { color: subject === 'staff' ? '#ffffff' : '#123033' }]} className="text-sm">
                      Staff
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: subject === 'patients' }}
                    onPress={() => setSubject('patients')}
                    className={`flex-1 items-center rounded-full py-2 ${subject === 'patients' ? 'bg-pine' : ''}`}
                  >
                    <Text style={[font.medium, { color: subject === 'patients' ? '#ffffff' : '#123033' }]} className="text-sm">
                      Patients
                    </Text>
                  </Pressable>
                </View>
              </View>
              {subject === 'staff' ? (
                <StaffSearch selected={staff} onSelect={chooseStaff} fillList={pickingPerson} />
              ) : (
                <PatientSearch selected={patient} onSelect={choosePatient} fillList={pickingPerson} />
              )}
              <View>
                <Pressable accessibilityRole="button" onPress={() => void pickFile()} className="mb-3 rounded-xl border border-dashed border-line bg-card px-3 py-3">
                  <Text style={font.medium} className="text-sm text-ink">
                    {file ? file.name : 'Choose a PDF, image, text, or Word file'}
                  </Text>
                </Pressable>
                <View className="flex-row">
                  <View className="mr-3 flex-1">
                    <Button label={busy ? 'Adding…' : 'Save document'} disabled={busy} onPress={() => void submit()} />
                  </View>
                  <View className="flex-1">
                    <Button label="Cancel" tone="ghost" onPress={cancelAdd} />
                  </View>
                </View>
                <Text style={font.sans} className="mt-2 text-sm leading-5 text-mute">
                  The name is what search matches. A file is required.
                </Text>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </Screen>
  );
}

function ActionIcon({ kind }: { kind: 'download' | 'remove' }) {
  if (Platform.OS !== 'web') {
    return (
      <Text style={[font.semibold, { color: '#146e70', fontSize: 18 }]}>{kind === 'download' ? '↓' : '✕'}</Text>
    );
  }
  if (kind === 'download') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#146e70" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    );
  }
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#146e70" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

function PageArrow({
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
      className="h-9 w-9 items-center justify-center rounded-full border border-line bg-card"
      style={{ opacity: disabled ? 0.35 : 1 }}
    >
      <Text style={font.semibold} className="text-base text-ink">
        {glyph}
      </Text>
    </Pressable>
  );
}
