import { Alert, Platform, Pressable, Text, TextInput, View, type TextInputProps } from 'react-native';
import type { ReactNode } from 'react';

import { monthLabel } from '../lib/format';
import { translate, useI18n } from '../lib/i18n';
import type { Role, VisitStatus } from '../lib/types';

export const font = {
  display: { fontFamily: 'Fraunces_600SemiBold' },
  sans: { fontFamily: 'Outfit_400Regular' },
  medium: { fontFamily: 'Outfit_500Medium' },
  semibold: { fontFamily: 'Outfit_600SemiBold' },
};

export const STATUS: Record<VisitStatus, { label: string; bg: string; fg: string; line: string }> = {
  scheduled: { label: 'Scheduled', bg: '#e5f7f7', fg: '#0f5c5e', line: '#4BBBBC' },
  completed: { label: 'Completed', bg: '#e7f3f4', fg: '#125e60', line: '#146e70' },
  cancelled: { label: 'Cancelled', bg: '#fdecec', fg: '#9b3b36', line: '#9b3b36' },
};

export const THERAPY_TONE: Record<string, { label: string; bg: string; fg: string; line: string; mark: string }> = {
  'Occupational therapy': { label: 'Occupational', bg: '#e9f7f6', fg: '#0f5c5e', line: '#9adcdc', mark: '#4BBBBC' },
  'Speech therapy': { label: 'Speech', bg: '#fff5e8', fg: '#8a4e12', line: '#f0cba0', mark: '#e09a45' },
  'Physiotherapy': { label: 'Physiotherapy', bg: '#eaf6ee', fg: '#1b6b40', line: '#a3d4b4', mark: '#3d9a62' },
};

export const THERAPY_FALLBACK = { label: 'Unassigned', bg: '#f3f4f8', fg: '#4a4e6a', line: '#cfd2de', mark: '#8b90b0' };

export function therapyTone(therapy?: string | null) {
  return (therapy && THERAPY_TONE[therapy]) || THERAPY_FALLBACK;
}

export function therapySurface(therapy?: string | null) {
  const tone = therapyTone(therapy);
  return { backgroundColor: tone.bg, borderColor: tone.line };
}

export const ROLE_TONE: Record<Role, { bg: string; fg: string }> = {
  admin: { bg: '#0f5c5e', fg: '#ffffff' },
  'sub-admin': { bg: '#4BBBBC', fg: '#ffffff' },
  user: { bg: '#d7f4f4', fg: '#123033' },
};

export function confirmAction(title: string, message: string) {
  const heading = translate(title);
  const body = translate(message);
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${heading}\n\n${body}`));
  }
  return new Promise<boolean>((resolve) => {
    Alert.alert(heading, body, [
      { text: translate('Cancel'), style: 'cancel', onPress: () => resolve(false) },
      { text: translate('Remove'), style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}

export function PageTitle({ kicker, title, detail, raw }: { kicker?: string; title: string; detail?: string; raw?: boolean }) {
  const { t, nameAlign } = useI18n();
  return (
    <View className="mb-6">
      {kicker ? (
        <Text style={font.medium} className="text-xs uppercase tracking-widest text-moss">
          {t(kicker)}
        </Text>
      ) : null}
      <Text style={[font.display, raw ? nameAlign : null]} className="mt-1 text-4xl text-ink">
        {raw ? title : t(title)}
      </Text>
      {detail ? (
        <Text style={font.sans} className="mt-2 text-base leading-6 text-mute">
          {t(detail)}
        </Text>
      ) : null}
    </View>
  );
}

export function Banner({ tone, children }: { tone: 'error' | 'ok'; children: ReactNode }) {
  const { t } = useI18n();
  const error = tone === 'error';
  return (
    <View className="mb-4 rounded-xl px-4 py-3" style={{ backgroundColor: error ? '#fdecec' : '#e5f7f7' }}>
      <Text style={[font.medium, { color: error ? '#9b3b36' : '#0f5c5e' }]} className="text-sm leading-5">
        {typeof children === 'string' ? t(children) : children}
      </Text>
    </View>
  );
}

export function Field({ label, ...props }: { label?: string } & TextInputProps) {
  const { t, rtl } = useI18n();
  const keyboard = props.keyboardType;
  const latinField =
    keyboard === 'phone-pad' ||
    keyboard === 'numeric' ||
    keyboard === 'number-pad' ||
    keyboard === 'decimal-pad' ||
    keyboard === 'email-address';
  return (
    <View className="mb-4">
      {label ? (
        <Text style={font.medium} className="mb-1.5 text-xs uppercase tracking-widest text-moss">
          {t(label)}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor="#7a9495"
        className="rounded-xl border border-line bg-card px-3 py-3 text-base text-ink"
        {...props}
        placeholder={props.placeholder ? t(props.placeholder) : props.placeholder}
        style={[
          font.sans,
          rtl ? { textAlign: latinField ? 'left' : 'right', writingDirection: latinField ? 'ltr' : 'rtl' } : null,
          props.style,
        ]}
      />
    </View>
  );
}

export function DateField({
  label,
  value,
  onChange,
  max,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  max?: string;
}) {
  const { t, lang } = useI18n();
  return (
    <View className="mb-4">
      <Text style={font.medium} className="mb-1.5 text-xs uppercase tracking-widest text-moss">
        {t(label)}
      </Text>
      {Platform.OS === 'web' ? (
        <input
          type="date"
          lang={lang === 'ar' ? 'ar-u-nu-latn' : 'en'}
          dir="ltr"
          value={value}
          max={max}
          onChange={(event) => onChange(event.currentTarget.value)}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            fontFamily: 'Outfit_400Regular',
            fontSize: 16,
            color: '#123033',
            background: '#ffffff',
            border: '1px solid #c9e4e4',
            borderRadius: 12,
            padding: 12,
          }}
        />
      ) : (
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#7a9495"
          autoCapitalize="none"
          className="rounded-xl border border-line bg-card px-3 py-3 text-base text-ink"
          style={font.sans}
        />
      )}
    </View>
  );
}

export function MonthField({
  label,
  value,
  onChange,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { t, lang } = useI18n();
  const [year, month] = value.split('-').map(Number);
  const shown = year && month ? monthLabel(year, month - 1) : value;
  return (
    <View className="mb-4">
      {label ? (
        <Text style={font.medium} className="mb-1.5 text-xs uppercase tracking-widest text-moss">
          {t(label)}
        </Text>
      ) : null}
      {Platform.OS === 'web' ? (
        <div style={{ position: 'relative' }}>
          <div
            style={{
              boxSizing: 'border-box',
              fontFamily: 'Outfit_400Regular',
              fontSize: 16,
              color: '#123033',
              background: '#ffffff',
              border: '1px solid #c9e4e4',
              borderRadius: 12,
              padding: 12,
              textAlign: lang === 'ar' ? 'right' : 'left',
            }}
          >
            {shown}
          </div>
          <input
            type="month"
            lang={lang === 'ar' ? 'ar-u-nu-latn' : 'en'}
            dir="ltr"
            value={value}
            onChange={(event) => onChange(event.currentTarget.value)}
            aria-label={shown}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              opacity: 0,
              cursor: 'pointer',
            }}
          />
        </div>
      ) : (
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder="YYYY-MM"
          placeholderTextColor="#7a9495"
          autoCapitalize="none"
          className="rounded-xl border border-line bg-card px-3 py-3 text-base text-ink"
          style={font.sans}
        />
      )}
    </View>
  );
}

export function Button({
  label,
  onPress,
  disabled,
  tone = 'primary',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'primary' | 'pine' | 'ghost' | 'danger';
}) {
  const { t } = useI18n();
  const background = tone === 'primary' ? '#4BBBBC' : tone === 'pine' ? '#0f5c5e' : tone === 'danger' ? '#9b3b36' : 'transparent';
  const color = tone === 'ghost' ? '#123033' : '#ffffff';
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      className={`items-center rounded-xl px-4 py-3 ${tone === 'ghost' ? 'border border-line' : ''}`}
      style={{ backgroundColor: background, opacity: disabled ? 0.5 : 1 }}
    >
      <Text style={[font.semibold, { color }]} className="text-base">
        {t(label)}
      </Text>
    </Pressable>
  );
}

export function Chip({ label, active, onPress, raw = false }: { label: string; active?: boolean; onPress: () => void; raw?: boolean }) {
  const { t } = useI18n();
  const wash = THERAPY_TONE[label];
  const shown = raw ? label : t(label);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className={`mb-2 me-2 rounded-full border px-3 py-2 ${active || wash ? '' : 'border-line bg-card'}`}
      style={
        wash
          ? { backgroundColor: active ? wash.mark : wash.bg, borderColor: wash.mark }
          : active
            ? { backgroundColor: '#0f5c5e', borderColor: '#0f5c5e' }
            : undefined
      }
    >
      <Text style={[font.medium, { color: active ? '#ffffff' : wash ? wash.fg : '#123033' }]} className="text-sm">
        {shown}
      </Text>
    </Pressable>
  );
}

export function StatusPill({ status }: { status: VisitStatus }) {
  const { t } = useI18n();
  const tone = STATUS[status];
  return (
    <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: tone.bg }}>
      <Text style={[font.medium, { color: tone.fg }]} className="text-xs">
        {t(tone.label)}
      </Text>
    </View>
  );
}

export function TherapyPill({ therapy }: { therapy?: string | null }) {
  const { t } = useI18n();
  const tone = therapyTone(therapy);
  return (
    <View className="rounded-full border px-2.5 py-1" style={{ backgroundColor: '#ffffff', borderColor: tone.line }}>
      <Text style={[font.medium, { color: tone.fg }]} className="text-xs">
        {t(tone.label)}
      </Text>
    </View>
  );
}

export function FilterIcon({ color }: { color: string }) {
  if (Platform.OS !== 'web') {
    return <Text style={[font.medium, { color, fontSize: 16, lineHeight: 18 }]}>▽</Text>;
  }
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

export function RolePill({ role }: { role: Role }) {
  const { t } = useI18n();
  const tone = ROLE_TONE[role];
  return (
    <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: tone.bg }}>
      <Text style={[font.medium, { color: tone.fg }]} className="text-xs">
        {t(role)}
      </Text>
    </View>
  );
}
