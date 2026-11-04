import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';

import { InstrumentPhoto } from '../../components/InstrumentPhoto';
import { Screen } from '../../components/Screen';
import { Banner, Button, Chip, Field, PageTitle, TherapyPill, confirmAction, font, therapySurface } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { PATIENT_TYPES, WIDE, formatMoney } from '../../lib/format';
import { canDelete, canSeeIncome } from '../../lib/permissions';
import type { Instrument, PickedFile } from '../../lib/types';

function priceOf(value: string) {
  const amount = Number(value.trim());
  if (value.trim() === '' || !Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100) / 100;
}

function EditIcon() {
  if (Platform.OS !== 'web') {
    return <Text style={[font.medium, { color: '#146e70', fontSize: 14, lineHeight: 16 }]}>✎</Text>;
  }
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#146e70" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function InstrumentPrice({
  item,
  editable,
  onChange,
}: {
  item: Instrument;
  editable: boolean;
  onChange: (next: Instrument) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(item.price == null ? '' : String(item.price));
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setValue(item.price == null ? '' : String(item.price));
    setEditing(false);
  }, [item.id, item.price]);

  const entered = priceOf(value);
  const dirty = entered != null && entered !== Number(item.price);

  async function save() {
    if (entered == null) {
      setLocalError('Enter a price.');
      return;
    }
    if (!dirty) {
      setEditing(false);
      setLocalError(null);
      return;
    }
    setBusy(true);
    setLocalError(null);
    try {
      const data = await api.updateInstrument(item.id, entered);
      onChange(data.instrument);
      setEditing(false);
    } catch (reason) {
      setLocalError(reason instanceof Error ? reason.message : 'Could not save the price.');
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <View className="mt-2 flex-row items-center">
        <Text style={font.semibold} className="text-sm text-ink">
          ${formatMoney(item.price)}
        </Text>
        {editable ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Edit price"
            onPress={() => {
              setValue(item.price == null ? '' : String(item.price));
              setLocalError(null);
              setEditing(true);
            }}
            className="ml-2 h-7 w-7 items-center justify-center rounded-full"
          >
            <EditIcon />
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View className="mt-2">
      <View className="flex-row items-center">
        <TextInput
          value={value}
          onChangeText={setValue}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor="#7a9495"
          autoFocus
          className="mr-2 h-10 flex-1 rounded-xl border border-line bg-card px-3 text-base text-ink"
          style={font.sans}
        />
        <Pressable accessibilityRole="button" onPress={() => void save()} className="rounded-full bg-clay px-3 py-2">
          <Text style={font.medium} className="text-xs text-card">
            {busy ? 'Saving…' : 'Save'}
          </Text>
        </Pressable>
      </View>
      {localError ? (
        <Text style={[font.sans, { color: '#9b3b36' }]} className="mt-1 text-xs">
          {localError}
        </Text>
      ) : null}
    </View>
  );
}

export default function InstrumentsScreen() {
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE;
  const [therapy, setTherapy] = useState<string | null>(null);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [usedFor, setUsedFor] = useState('');
  const [formTherapy, setFormTherapy] = useState<string | null>(null);
  const [image, setImage] = useState<PickedFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const remove = user ? canDelete(user.role) : false;
  const editPrice = user ? canSeeIncome(user.role) : false;
  const enteredPrice = priceOf(price);

  const load = useCallback(async () => {
    try {
      const data = await api.instruments();
      setInstruments(data.instruments);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load instruments.');
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
    const types = therapy ? [therapy] : PATIENT_TYPES;
    return types.map((type) => ({
      type,
      items: visible.filter((item) => item.therapyType === type),
    }));
  }, [therapy, visible]);

  function beginAdd() {
    setAdding(true);
    setFormTherapy(therapy);
    setName('');
    setPrice('');
    setUsedFor('');
    setImage(null);
    setError(null);
    setMessage(null);
  }

  function cancelAdd() {
    setAdding(false);
    setName('');
    setPrice('');
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
      setError('Choose which therapy this instrument belongs to.');
      return;
    }
    if (!name.trim()) {
      setError('Name the instrument.');
      return;
    }
    if (!usedFor.trim()) {
      setError('Say what the instrument is used for.');
      return;
    }
    if (enteredPrice == null) {
      setError('Enter the price.');
      return;
    }
    if (!image) {
      setError('Add a photo of the instrument.');
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
        price: enteredPrice,
        image,
      });
      setMessage(`Added ${name.trim()}.`);
      cancelAdd();
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not add that instrument.');
    } finally {
      setBusy(false);
    }
  }

  async function removeInstrument(item: Instrument) {
    const ok = await confirmAction('Remove this instrument?', item.name);
    if (!ok) return;
    try {
      await api.deleteInstrument(item.id);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not remove that instrument.');
    }
  }

  const form = (
    <View className={wide ? 'ml-8 w-96' : 'mt-6'}>
      <Text style={font.display} className="mb-4 text-2xl text-ink">
        Add an instrument
      </Text>
      <Text style={font.medium} className="mb-2 text-xs uppercase tracking-widest text-moss">
        Therapy
      </Text>
      <View className="flex-row flex-wrap">
        {PATIENT_TYPES.map((item) => (
          <Chip key={item} label={item} active={formTherapy === item} onPress={() => setFormTherapy(item)} />
        ))}
      </View>
      {formTherapy ? null : (
        <Text style={[font.sans, { color: '#9b3b36' }]} className="mb-3 text-sm leading-5">
          Choose a therapy first so this instrument is listed with the right tools.
        </Text>
      )}
      <Field label="Name" value={name} onChangeText={setName} placeholder="Gait belt" />
      <Field label="Price" value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="0" />
      <Field
        label="Used for"
        value={usedFor}
        onChangeText={setUsedFor}
        multiline
        placeholder="What this instrument is used for"
      />
      <Pressable accessibilityRole="button" onPress={() => void pickImage()} className="mb-4 rounded-xl border border-dashed border-line bg-card px-3 py-4">
        <Text style={font.medium} className="text-sm text-ink">
          {image ? image.name : 'Choose a photo'}
        </Text>
      </Pressable>
      <View className="flex-row">
        <View className="mr-3 flex-1">
          <Button
            label={busy ? 'Adding…' : 'Save instrument'}
            disabled={busy || !formTherapy || !name.trim() || !usedFor.trim() || enteredPrice == null || !image}
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
          <PageTitle kicker="Clinic" title="Instruments" detail="Each therapy keeps the tools it uses. The price is counted as outcome, apart from visit income." />
        </View>
        {adding ? null : (
          <Pressable accessibilityRole="button" onPress={beginAdd} className="mt-1 rounded-full bg-clay px-3 py-2">
            <Text style={font.medium} className="text-sm text-card">
              Add an instrument
            </Text>
          </Pressable>
        )}
      </View>
      {message ? <Banner tone="ok">{message}</Banner> : null}
      {error ? <Banner tone="error">{error}</Banner> : null}
      <View className={wide && adding ? 'flex-row items-start' : ''}>
        <View className={wide && adding ? 'flex-1' : ''}>
          <Text style={font.medium} className="mb-2 text-xs uppercase tracking-widest text-moss">
            Therapy
          </Text>
          <View className="mb-4 flex-row flex-wrap">
            <Chip label="All" active={therapy == null} onPress={() => setTherapy(null)} />
            {PATIENT_TYPES.map((item) => (
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
                  No instruments yet.
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
                      <InstrumentPrice
                        item={item}
                        editable={editPrice}
                        onChange={(next) => setInstruments((current) => current.map((row) => (row.id === next.id ? next : row)))}
                      />
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
