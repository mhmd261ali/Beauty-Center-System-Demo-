import { useEffect, useRef } from 'react';
import { Animated, Platform, Pressable, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';

import { LanguageSwitch, useI18n } from '../lib/i18n';
import { canManageSettings, canManageStaff, canSeeIncome } from '../lib/permissions';
import type { User } from '../lib/types';
import { font } from './ui';

const ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { href: '/bookings', label: 'Bookings', icon: 'bookings' },
  { href: '/pending', label: 'Pending', icon: 'pending' },
  { href: '/reserve', label: 'Book', icon: 'book' },
  { href: '/self-book', label: 'Self book', icon: 'selfbook' },
  { href: '/calendar', label: 'Month', icon: 'month' },
  { href: '/patients', label: 'Patients', icon: 'patients' },
  { href: '/documents', label: 'Documents', icon: 'documents' },
  { href: '/instruments', label: 'Instruments', icon: 'instruments' },
  { href: '/services', label: 'Available services', icon: 'services' },
] as const;

type NavIconName = (typeof ITEMS)[number]['icon'] | 'staff' | 'income' | 'outcome' | 'settings';

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SideNav({ user, pendingCount, sessionNow, insetTop, insetBottom, onSignOut, onNavigate, brand = true }: { user: User; pendingCount: number; sessionNow: boolean; insetTop: number; insetBottom: number; onSignOut: () => void; onNavigate?: () => void; brand?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t, rtl } = useI18n();
  const extras: { href: string; label: string; icon: NavIconName }[] = [];
  if (canSeeIncome(user.role)) {
    extras.push({ href: '/income', label: 'Income', icon: 'income' });
    extras.push({ href: '/outcome', label: 'Expenses', icon: 'outcome' });
  }
  if (canManageStaff(user.role)) extras.push({ href: '/staff', label: 'Staff', icon: 'staff' });
  if (canManageSettings(user.role)) extras.push({ href: '/settings', label: 'Settings', icon: 'settings' });
  const items = [...ITEMS, ...extras];

  return (
    <View
      style={{ width: 240, paddingTop: Math.max(insetTop, 28), paddingBottom: Math.max(insetBottom, 24) }}
      className="justify-between bg-pine px-5"
    >
      <View>
        {brand ? (
          <>
            <Text style={font.display} className="text-3xl text-card">
              {t('Sekretariat')}
            </Text>
            <Text style={font.sans} className="mb-8 mt-1 text-sm text-sand">
              {t('Clinic desk')}
            </Text>
          </>
        ) : null}
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Pressable
              key={item.href}
              accessibilityRole="button"
              onPress={() => {
                router.push(item.href);
                onNavigate?.();
              }}
              className={`mb-1 flex-row items-center rounded-xl px-3 py-3 ${active ? 'bg-white/10' : ''}`}
            >
              <View className="me-3 h-5 w-5 items-center justify-center">
                <NavIcon name={item.icon} color={active ? '#ffffff' : '#d7f4f4'} />
              </View>
              <Text style={font.medium} className={`text-base ${active ? 'text-card' : 'text-sand'}`}>
                {t(item.label)}
              </Text>
              {item.href === '/bookings' && sessionNow ? <LiveDot /> : null}
              {item.href === '/pending' && pendingCount > 0 ? <PendingMark count={pendingCount} /> : null}
            </Pressable>
          );
        })}
      </View>
      <View className="flex-row items-center" style={{ direction: 'ltr' }}>
        <Text style={[font.semibold, rtl ? { textAlign: 'right' } : null]} className="me-3 flex-1 text-base text-card" numberOfLines={1}>
          {user.name}
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t('Sign out')} onPress={onSignOut} className="h-9 w-9 items-center justify-center rounded-full">
          <SignOutIcon color="#d7f4f4" />
        </Pressable>
        <LanguageSwitch tone="pine" />
      </View>
    </View>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  if (Platform.OS !== 'web') {
    return (
      <Text style={[font.medium, { color: '#0f5c5e', fontSize: 22, lineHeight: 24 }]}>{open ? '✕' : '☰'}</Text>
    );
  }
  const common = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: '#0f5c5e',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
  };
  if (open) {
    return (
      <svg {...common}>
        <line x1="6" y1="6" x2="18" y2="18" />
        <line x1="18" y1="6" x2="6" y2="18" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  );
}

export function MobileHeader({ user, open, onToggle }: { user: User; open: boolean; onToggle: () => void }) {
  const { t, rtl } = useI18n();
  const brandAlign = rtl ? { textAlign: 'right' as const } : null;
  return (
    <View className="flex-row items-center justify-between border-b border-line bg-paper px-4 py-3">
      <View className="me-3 flex-1">
        <Text style={[font.display, brandAlign]} className="text-2xl text-ink">
          {t('Sekretariat')}
        </Text>
        <Text style={[font.sans, brandAlign]} className="text-xs text-mute" numberOfLines={1}>
          {user.name}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={open ? t('Close menu') : t('Open menu')}
        onPress={onToggle}
        className="h-11 w-11 items-center justify-center rounded-xl border border-line bg-card"
      >
        <MenuIcon open={open} />
      </Pressable>
    </View>
  );
}

function LiveDot({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.15, duration: 1200, useNativeDriver: false }),
        Animated.timing(opacity, { toValue: 1, duration: 1200, useNativeDriver: false }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);
  const size = compact ? 8 : 12;
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLabel={t('A session is on now')}
      style={{
        opacity,
        marginStart: compact ? 4 : 'auto',
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#1f9d55',
      }}
    />
  );
}

function PendingMark({ count, compact = false }: { count: number; compact?: boolean }) {
  return (
    <View
      className={`flex-row items-center justify-center rounded-md ${compact ? '' : 'ms-auto'}`}
      style={{ backgroundColor: '#d92d20', paddingHorizontal: compact ? 4 : 6, paddingVertical: compact ? 1 : 2, minWidth: compact ? 22 : 28 }}
    >
      <Text style={[font.semibold, { color: '#ffffff', fontSize: compact ? 10 : 12, lineHeight: compact ? 13 : 16 }]}>!</Text>
      <Text style={[font.semibold, { color: '#ffffff', fontSize: compact ? 10 : 12, lineHeight: compact ? 13 : 16, marginStart: 2 }]}>
        {count}
      </Text>
    </View>
  );
}

function SignOutIcon({ color }: { color: string }) {
  if (Platform.OS !== 'web') {
    return <Text style={[font.medium, { color, fontSize: 16, lineHeight: 18 }]}>↪</Text>;
  }
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function NavIcon({ name, color }: { name: NavIconName; color: string }) {
  if (Platform.OS !== 'web') {
    const mark =
      name === 'dashboard'
        ? '▣'
        : name === 'bookings'
          ? '◷'
          : name === 'pending'
            ? '!'
            : name === 'book'
              ? '+'
              : name === 'selfbook'
                ? '✎'
                : name === 'month'
                  ? '▦'
                  : name === 'patients'
                    ? '☺'
                    : name === 'documents'
                      ? '▤'
                      : name === 'instruments'
                        ? '⚒'
                        : name === 'services'
                          ? '✦'
                          : name === 'income'
                          ? '$'
                          : name === 'outcome'
                            ? '↓'
                            : name === 'settings'
                              ? '⚙'
                              : '◉';
    return <Text style={[font.medium, { color, fontSize: 14, lineHeight: 18 }]}>{mark}</Text>;
  }

  const common = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  if (name === 'dashboard') {
    return (
      <svg {...common}>
        <rect x="3" y="3" width="8" height="8" rx="1" />
        <rect x="13" y="3" width="8" height="5" rx="1" />
        <rect x="13" y="10" width="8" height="11" rx="1" />
        <rect x="3" y="13" width="8" height="8" rx="1" />
      </svg>
    );
  }
  if (name === 'bookings') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    );
  }
  if (name === 'book') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </svg>
    );
  }
  if (name === 'pending') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    );
  }
  if (name === 'selfbook') {
    return (
      <svg {...common}>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <polyline points="9 16 11 18 15 14" />
      </svg>
    );
  }
  if (name === 'month') {
    return (
      <svg {...common}>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    );
  }
  if (name === 'patients') {
    return (
      <svg {...common}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    );
  }
  if (name === 'documents') {
    return (
      <svg {...common}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    );
  }
  if (name === 'instruments') {
    return (
      <svg {...common}>
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
    );
  }
  if (name === 'services') {
    return (
      <svg {...common}>
        <polygon points="12 2 15 9 22 9.5 17 14.5 18.5 22 12 18 5.5 22 7 14.5 2 9.5 9 9" />
      </svg>
    );
  }
  if (name === 'income') {
    return (
      <svg {...common}>
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    );
  }
  if (name === 'outcome') {
    return (
      <svg {...common}>
        <line x1="12" y1="3" x2="12" y2="16" />
        <polyline points="7 11 12 16 17 11" />
        <line x1="5" y1="21" x2="19" y2="21" />
      </svg>
    );
  }
  if (name === 'settings') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export function BottomNav({ inset, pendingCount, sessionNow }: { inset: number; pendingCount: number; sessionNow: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  return (
    <View style={{ paddingBottom: Math.max(inset, 8) }} className="flex-row border-t border-line bg-card px-1 pt-2">
      {ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Pressable key={item.href} accessibilityRole="button" onPress={() => router.push(item.href)} className="flex-1 items-center py-2">
            <Text style={font.medium} className={`text-xs ${active ? 'text-moss' : 'text-mute'}`}>
              {t(item.label)}
            </Text>
            {item.href === '/bookings' && sessionNow ? <LiveDot compact /> : null}
            {item.href === '/pending' && pendingCount > 0 ? <PendingMark count={pendingCount} compact /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}
