import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';

import { Screen } from '../../components/Screen';
import { Banner, Button, Chip, Field, PageTitle, font } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { formatMoney, latinRun, monthISO, monthLabel } from '../../lib/format';
import { plural, translate, useI18n } from '../../lib/i18n';
import { canSeeIncome } from '../../lib/permissions';
import type { OutcomeMonth, User } from '../../lib/types';

const MANUAL = ['salaries', 'rent', 'services'] as const;
type ManualKey = (typeof MANUAL)[number];

const CATEGORY_LABEL: Record<ManualKey, string> = {
  salaries: 'Salaries',
  rent: 'Rent',
  services: 'Services',
};

function dollars(value: number | null | undefined) {
  return latinRun(`$${formatMoney(value).replace(/\u2066|\u2069/g, '')}`);
}

function priceOf(value: string) {
  const amount = Number(value.trim());
  if (value.trim() === '' || !Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100) / 100;
}

function staffLabel(person: User) {
  const detail = person.therapyType || person.role;
  return detail ? `${person.name} · ${detail}` : person.name;
}

function StaffMenu({
  people,
  value,
  onChange,
}: {
  people: User[];
  value: string;
  onChange: (value: string) => void;
}) {
  const { t, nameAlign } = useI18n();
  const [open, setOpen] = useState(false);
  const chosen = people.find((person) => String(person.id) === value);

  if (Platform.OS === 'web') {
    return (
      <View className="mb-4">
        <Text style={font.medium} className="mb-1.5 text-xs uppercase tracking-widest text-moss">
          {t('Staff')}
        </Text>
        <select
          aria-label={t('Staff')}
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            height: 48,
            fontFamily: 'Outfit_400Regular',
            fontSize: 16,
            color: value ? '#123033' : '#7a9495',
            background: '#ffffff',
            border: '1px solid #c9e4e4',
            borderRadius: 12,
            padding: '0 12px',
            textAlign: nameAlign ? 'right' : 'left',
          }}
        >
          <option value="">{t('Choose staff')}</option>
          {people.map((person) => (
            <option key={person.id} value={String(person.id)}>
              {staffLabel(person)}
            </option>
          ))}
        </select>
      </View>
    );
  }

  return (
    <View className="mb-4">
      <Text style={font.medium} className="mb-1.5 text-xs uppercase tracking-widest text-moss">
        {t('Staff')}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen((current) => !current)}
        className="rounded-xl border border-line bg-card px-3 py-3"
      >
        <Text style={[font.sans, nameAlign]} className={chosen ? 'text-base text-ink' : 'text-base text-mute'}>
          {chosen ? staffLabel(chosen) : t('Choose staff')}
        </Text>
      </Pressable>
      {open ? (
        <View className="mt-2 overflow-hidden rounded-xl border border-line bg-card">
          {people.map((person) => (
            <Pressable
              key={person.id}
              accessibilityRole="button"
              onPress={() => {
                onChange(String(person.id));
                setOpen(false);
              }}
              className="border-b border-line px-3 py-3"
            >
              <Text style={[font.medium, nameAlign]} className="text-base text-ink">
                {staffLabel(person)}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export default function OutcomeScreen() {
  const { user } = useAuth();
  const { t, nameAlign } = useI18n();
  const router = useRouter();
  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [report, setReport] = useState<OutcomeMonth | null>(null);
  const [staff, setStaff] = useState<User[]>([]);
  const [category, setCategory] = useState<ManualKey>('salaries');
  const [staffId, setStaffId] = useState('');
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const month = monthISO(cursor.year, cursor.month);
  const entered = priceOf(amount);
  const ready = category === 'salaries' ? staffId !== '' && entered != null : label.trim() !== '' && entered != null;

  const load = useCallback(async () => {
    setError(null);
    try {
      setReport(await api.outcome(month));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load expenses.');
    }
  }, [month]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    let active = true;
    api
      .users()
      .then((data) => {
        if (!active) return;
        setStaff([...data.users].sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })));
      })
      .catch(() => {
        if (active) setStaff([]);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  function showToast(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }

  function shiftMonth(step: number) {
    const next = new Date(cursor.year, cursor.month + step, 1);
    setCursor({ year: next.getFullYear(), month: next.getMonth() });
  }

  async function submit() {
    if (category === 'salaries' && !staffId) {
      setError('Choose who was paid.');
      return;
    }
    if (category !== 'salaries' && !label.trim()) {
      setError('Say what this payment was for.');
      return;
    }
    if (entered == null) {
      setError('Enter the amount.');
      return;
    }
    const who = category === 'salaries' ? staff.find((person) => String(person.id) === staffId)?.name ?? 'Salary' : label.trim();
    setBusy(true);
    setError(null);
    try {
      setReport(
        await api.createOutcome({
          month,
          payments: [
            category === 'salaries'
              ? { category, staffId: Number(staffId), amount: entered }
              : { category, label: label.trim(), amount: entered },
          ],
        }),
      );
      setStaffId('');
      setLabel('');
      setAmount('');
      showToast(t('Added {who}', { who }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save that payment.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number, name: string) {
    setError(null);
    try {
      setReport(await api.deleteOutcome(id, month));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('Could not remove {name}.', { name }));
    }
  }

  if (!user || !canSeeIncome(user.role)) return <Redirect href="/bookings" />;

  const categories = report?.categories ?? [];

  return (
    <View className="flex-1">
    <Screen>
      <PageTitle
        kicker="Admin"
        title="Expenses"
        detail={t('Payments in {month}. Add one at a time. Each one stays in the list for this month.', { month: monthLabel(cursor.year, cursor.month) })}
      />
      {error ? <Banner tone="error">{error}</Banner> : null}

      <View className="mb-4 flex-row items-center justify-between">
        <Pressable accessibilityRole="button" onPress={() => shiftMonth(-1)} className="rounded-full border border-line bg-card px-4 py-2">
          <Text style={font.medium} className="text-sm text-ink">
            {t('Previous')}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            const current = new Date();
            setCursor({ year: current.getFullYear(), month: current.getMonth() });
          }}
        >
          <Text style={font.medium} className="text-sm text-moss">
            {monthLabel(cursor.year, cursor.month)}
          </Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => shiftMonth(1)} className="rounded-full border border-line bg-card px-4 py-2">
          <Text style={font.medium} className="text-sm text-ink">
            {t('Next')}
          </Text>
        </Pressable>
      </View>

      <View className="mb-4 flex-row flex-wrap" style={{ marginHorizontal: -6 }}>
        {categories.map((card) => (
          <View key={card.key} style={{ width: '25%', paddingHorizontal: 6, paddingBottom: 12, minWidth: 140, flexGrow: 1 }}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                if (card.key !== 'equipment') setCategory(card.key);
              }}
              className="rounded-2xl border p-4"
              style={{
                borderColor: category === card.key ? '#0f5c5e' : '#c9e4e4',
                backgroundColor: category === card.key ? '#e7f3f4' : '#ffffff',
              }}
            >
              <Text style={font.medium} className="text-xs uppercase tracking-widest text-moss">
                {t(card.label)}
              </Text>
              <Text style={font.display} className="mt-1 text-2xl text-ink">
                {dollars(card.total)}
              </Text>
              <Text style={font.sans} className="mt-1 text-xs text-mute">
                {plural(card.items.length, '1 payment', '{n} payments')}
              </Text>
            </Pressable>
          </View>
        ))}
      </View>

      <Text style={[font.semibold, { fontVariant: ['tabular-nums'] }]} className="mb-6 text-base text-ink">
        {t('Month total {amount}', { amount: dollars(report?.total ?? 0) })}
      </Text>

      <View className="mb-8 rounded-2xl border border-line bg-card p-4">
        <Text style={font.semibold} className="mb-3 text-lg text-ink">
          {t('Add a payment')}
        </Text>
        <View className="flex-row flex-wrap">
          {MANUAL.map((key) => (
            <Chip key={key} label={CATEGORY_LABEL[key]} active={category === key} onPress={() => setCategory(key)} />
          ))}
        </View>
        {category === 'salaries' ? (
          <StaffMenu people={staff} value={staffId} onChange={setStaffId} />
        ) : (
          <Field
            label="What was paid"
            value={label}
            onChangeText={setLabel}
            placeholder={category === 'rent' ? 'Clinic rent' : 'Electricity'}
          />
        )}
        <Field label="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0" />
        <Button label={busy ? 'Saving…' : 'Add payment'} disabled={busy || !ready} onPress={() => void submit()} />
      </View>

      {categories.map((section) => (
        <View key={section.key} className="mb-6">
          <Text style={font.semibold} className="mb-3 text-lg text-ink">
            {t(section.label)}
          </Text>
          {section.key === 'equipment' ? (
            <Text style={font.sans} className="mb-3 text-sm text-mute">
              {t('These prices are saved on Instruments for this month.')}
            </Text>
          ) : null}
          {section.items.length === 0 ? (
            <Text style={font.sans} className="text-base text-mute">
              {t('Nothing recorded yet.')}
            </Text>
          ) : (
            section.items.map((item) => (
              <View key={`${section.key}-${item.id}`} className="mb-2 flex-row items-center rounded-2xl border border-line bg-card px-4 py-3">
                <View className="me-3 flex-1">
                  <Text style={[font.semibold, section.key === 'salaries' ? nameAlign : null]} className="text-base text-ink">
                    {item.label}
                  </Text>
                  {item.therapyType ? (
                    <Text style={font.sans} className="mt-0.5 text-sm text-mute">
                      {t(item.therapyType)}
                    </Text>
                  ) : null}
                </View>
                <Text style={[font.semibold, { fontVariant: ['tabular-nums'] }]} className="text-base text-ink">
                  {dollars(item.amount)}
                </Text>
                {section.key === 'equipment' ? (
                  <Pressable accessibilityRole="button" onPress={() => router.push('/instruments')} className="ms-4">
                    <Text style={font.medium} className="text-sm text-moss">
                      {t('Instruments')}
                    </Text>
                  </Pressable>
                ) : (
                  <Pressable accessibilityRole="button" onPress={() => void remove(item.id, item.label)} className="ms-4">
                    <Text style={font.medium} className="text-sm text-moss">
                      {t('Remove')}
                    </Text>
                  </Pressable>
                )}
              </View>
            ))
          )}
        </View>
      ))}
    </Screen>
    {toast ? (
      <View pointerEvents="none" className="absolute bottom-6 left-0 right-0 items-center">
        <View className="rounded-full px-4 py-2" style={{ backgroundColor: '#0f5c5e' }}>
          <Text style={font.medium} className="text-sm text-card">
            {toast}
          </Text>
        </View>
      </View>
    ) : null}
    </View>
  );
}
