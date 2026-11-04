import { useCallback, useMemo, useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';

import { InstrumentPhoto } from '../../components/InstrumentPhoto';
import { Screen } from '../../components/Screen';
import { Banner, Button, Chip, Field, PageTitle, TherapyPill, confirmAction, font, therapySurface } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { WIDE } from '../../lib/format';
import { canDelete, specialtiesFor } from '../../lib/permissions';
import type { Instrument, PickedFile } from '../../lib/types';

export default function InstrumentsScreen() {
  const { user } = useAuth();
  const specialties = specialtiesFor(user);
  const limited = user?.role === 'user';
  const { width } = useWindowDimensions();
  const wide = width >= WIDE;
  const [therapy, setTherapy] = useState<string | null>(limited && specialties.length === 1 ? specialties[0] : null);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [usedFor, setUsedFor] = useState('');
  const [formTherapy, setFormTherapy] = useState<string | null>(null);
  const [image, setImage] = useState<PickedFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const remove = user ? canDelete(user.role) : false;

  const load = useCallback(async () => {
    try {
      const data = await api.instruments();
      setInstruments(data.instruments);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load equipment.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const visible = useMemo(
    () => instruments.filter((item) => !therapy || item.therapyType === therapy),
    [instruments, therapy],
  );

  const groups = useMemo(() => {
    const types = therapy ? [therapy] : specialties;
    return types.map((type) => ({
      type,
      items: visible.filter((item) => item.therapyType === type),
    }));
  }, [therapy, visible, specialties]);

  function beginAdd() {
    setAdding(true);
    setFormTherapy(therapy);
    setName('');
    setUsedFor('');
    setImage(null);
    setError(null);
    setMessage(null);
  }

  function cancelAdd() {
    setAdding(false);
    setName('');
    setUsedFor('');
    setImage(null);
    setFormTherapy(null);
  }

  async function pickImage() {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'image/*',
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setImage({
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType ?? undefined,
      file: 'file' in asset ? (asset.file as Blob | undefined) : undefined,
    });
    if (!name.trim()) setName(asset.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '));
  }

  async function submit() {
    if (!formTherapy) {
      setError('Choose which specialty this piece of equipment belongs to.');
      return;
    }
    if (!name.trim()) {
      setError('Name the equipment.');
      return;
    }
    if (!usedFor.trim()) {
      setError('Say what this equipment is used for.');
      return;
    }
    if (!image) {
      setError('Add a photo of the equipment.');
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api.createInstrument({
        name: name.trim(),
        usedFor: usedFor.trim(),
        therapyType: formTherapy,
        image,
      });
      setMessage(`Added ${name.trim()}.`);
      cancelAdd();
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not add that equipment.');
    } finally {
      setBusy(false);
    }
  }

  async function removeInstrument(item: Instrument) {
    const ok = await confirmAction('Remove this equipment?', item.name);
    if (!ok) return;
    try {
      await api.deleteInstrument(item.id);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not remove that equipment.');
    }
  }

  const form = (
    <View className={wide ? 'ml-8 w-96' : 'mt-6'}>
      <Text style={font.display} className="mb-4 text-2xl text-ink">
        Add equipment
      </Text>
      <Text style={font.medium} className="mb-2 text-xs uppercase tracking-widest text-moss">
        Specialty
      </Text>
      <View className="flex-row flex-wrap">
        {specialties.map((item) => (
          <Chip key={item} label={item} active={formTherapy === item} onPress={() => setFormTherapy(item)} />
        ))}
      </View>
      {formTherapy ? null : (
        <Text style={[font.sans, { color: '#9b3b36' }]} className="mb-3 text-sm leading-5">
          Choose a specialty first so this equipment is listed with the right tools.
        </Text>
      )}
      <Field label="Name" value={name} onChangeText={setName} placeholder="Stethoscope" />
      <Field
        label="Used for"
        value={usedFor}
        onChangeText={setUsedFor}
        multiline
        placeholder="What this equipment is used for"
      />
      <Pressable accessibilityRole="button" onPress={() => void pickImage()} className="mb-4 rounded-xl border border-dashed border-line bg-card px-3 py-4">
        <Text style={font.medium} className="text-sm text-ink">
          {image ? image.name : 'Choose a photo'}
        </Text>
      </Pressable>
      <View className="flex-row">
        <View className="mr-3 flex-1">
          <Button
            label={busy ? 'Adding…' : 'Save equipment'}
            disabled={busy || !formTherapy || !name.trim() || !usedFor.trim() || !image}
            onPress={() => void submit()}
          />
        </View>
        <View className="flex-1">
          <Button label="Cancel" tone="ghost" onPress={cancelAdd} />
        </View>
      </View>
    </View>
  );

  return (
    <Screen>
      <View className="flex-row items-start justify-between">
        <View className="mr-4 flex-1">
          <PageTitle kicker="Clinic" title="Equipment" detail="Tools the clinic uses, with a photo and what each one is for." />
        </View>
        {adding ? null : (
          <Pressable accessibilityRole="button" onPress={beginAdd} className="mt-1 rounded-full bg-clay px-3 py-2">
            <Text style={font.medium} className="text-sm text-card">
              Add equipment
            </Text>
          </Pressable>
        )}
      </View>
      {message ? <Banner tone="ok">{message}</Banner> : null}
      {error ? <Banner tone="error">{error}</Banner> : null}
      <View className={wide && adding ? 'flex-row items-start' : ''}>
        <View className={wide && adding ? 'flex-1' : ''}>
          <Text style={font.medium} className="mb-2 text-xs uppercase tracking-widest text-moss">
            Specialty
          </Text>
          <View className="mb-4 flex-row flex-wrap">
            {limited ? null : <Chip label="All" active={therapy == null} onPress={() => setTherapy(null)} />}
            {specialties.map((item) => (
              <Chip key={item} label={item} active={therapy === item} onPress={() => setTherapy(item)} />
            ))}
          </View>
          {groups.map((group) => (
            <View key={group.type} className="mb-6">
              {therapy ? null : (
                <Text style={font.semibold} className="mb-3 text-lg text-ink">
                  {group.type}
                </Text>
              )}
              {group.items.length === 0 ? (
                <Text style={font.sans} className="text-base text-mute">
                  No equipment yet.
                </Text>
              ) : (
                group.items.map((item) => (
                  <View key={item.id} className="mb-3 flex-row rounded-2xl border p-3" style={therapySurface(item.therapyType)}>
                    {item.hasImage ? <InstrumentPhoto id={item.id} /> : <View className="bg-sand" style={{ width: 96, height: 96, borderRadius: 12 }} />}
                    <View className="ml-3 flex-1">
                      <View className="mb-1 flex-row items-start justify-between">
                        <Text style={font.semibold} className="mr-3 flex-1 text-lg text-ink">
                          {item.name}
                        </Text>
                        {therapy ? null : <TherapyPill therapy={item.therapyType} />}
                      </View>
                      <Text style={font.sans} className="mt-1 text-sm leading-5 text-mute">
                        {item.usedFor}
                      </Text>
                      {remove ? (
                        <Pressable accessibilityRole="button" onPress={() => void removeInstrument(item)} className="mt-2 self-start">
                          <Text style={font.medium} className="text-xs text-moss">
                            Remove
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                ))
              )}
            </View>
          ))}
        </View>
        {adding ? form : null}
      </View>
    </Screen>
  );
}
