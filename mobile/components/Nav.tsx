import { Platform, Pressable, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';

import { canManageStaff, canSeeIncome } from '../lib/permissions';
import type { User } from '../lib/types';
import { font, RolePill } from './ui';

const ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { href: '/bookings', label: 'Bookings', icon: 'bookings' },
  { href: '/reserve', label: 'Book', icon: 'book' },
  { href: '/calendar', label: 'Month', icon: 'month' },
  { href: '/patients', label: 'Patients', icon: 'patients' },
  { href: '/documents', label: 'Documents', icon: 'documents' },
  { href: '/instruments', label: 'Equipment', icon: 'instruments' },
] as const;

type NavIconName = (typeof ITEMS)[number]['icon'] | 'staff' | 'income';

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SideNav({ user, insetTop, insetBottom, onSignOut }: { user: User; insetTop: number; insetBottom: number; onSignOut: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const extras: { href: string; label: string; icon: NavIconName }[] = [];
  if (canSeeIncome(user.role)) extras.push({ href: '/income', label: 'Income', icon: 'income' });
  if (canManageStaff(user.role)) extras.push({ href: '/staff', label: 'Staff', icon: 'staff' });
  const items = [...ITEMS, ...extras];

  return (
    <View
      style={{ width: 240, paddingTop: Math.max(insetTop, 28), paddingBottom: Math.max(insetBottom, 24) }}
      className="justify-between bg-pine px-5"
    >
      <View>
        <Text style={font.display} className="text-3xl text-card">
          Halden
        </Text>
        <Text style={font.sans} className="mb-8 mt-1 text-sm text-sand">
          Clinic
        </Text>
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Pressable
              key={item.href}
              accessibilityRole="button"
              onPress={() => router.push(item.href)}
              className={`mb-1 flex-row items-center rounded-xl px-3 py-3 ${active ? 'bg-white/10' : ''}`}
            >
              <View className="mr-3 h-5 w-5 items-center justify-center">
                <NavIcon name={item.icon} color={active ? '#ffffff' : '#d7f4f4'} />
              </View>
              <Text style={font.medium} className={`text-base ${active ? 'text-card' : 'text-sand'}`}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View>
        <Text style={font.semibold} className="text-base text-card">
          {user.name}
        </Text>
        <View className="mb-4 mt-2 self-start">
          <RolePill role={user.role} />
        </View>
        <Pressable accessibilityRole="button" onPress={onSignOut}>
          <Text style={font.medium} className="text-sm text-sand">
            Sign out
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export function MobileHeader({
  user,
  onSignOut,
  onStaff,
  onIncome,
  onDashboard,
}: {
  user: User;
  onSignOut: () => void;
  onStaff: () => void;
  onIncome: () => void;
  onDashboard: () => void;
}) {
  return (
    <View className="flex-row items-center justify-between border-b border-line bg-paper px-4 py-3">
      <View>
        <Text style={font.display} className="text-2xl text-ink">
          Halden
        </Text>
        <Text style={font.sans} className="text-xs text-mute">
          {user.name}
        </Text>
      </View>
      <View className="flex-row items-center">
        <Pressable accessibilityRole="button" onPress={onDashboard} className="mr-4">
          <Text style={font.medium} className="text-sm text-moss">
            Dashboard
          </Text>
        </Pressable>
        {canSeeIncome(user.role) ? (
          <Pressable accessibilityRole="button" onPress={onIncome} className="mr-4">
            <Text style={font.medium} className="text-sm text-moss">
              Income
            </Text>
          </Pressable>
        ) : null}
        {canManageStaff(user.role) ? (
          <Pressable accessibilityRole="button" onPress={onStaff} className="mr-4">
            <Text style={font.medium} className="text-sm text-moss">
              Staff
            </Text>
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" onPress={onSignOut}>
          <Text style={font.medium} className="text-sm text-moss">
            Sign out
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function NavIcon({ name, color }: { name: NavIconName; color: string }) {
  if (Platform.OS !== 'web') {
    const mark =
      name === 'dashboard'
        ? '▣'
        : name === 'bookings'
        ? '◷'
        : name === 'book'
          ? '+'
          : name === 'month'
            ? '▦'
            : name === 'patients'
              ? '☺'
              : name === 'documents'
                ? '▤'
                : name === 'instruments'
                  ? '⚒'
                  : name === 'income'
                    ? '$'
                    : '◉';
    return (
      <Text style={[font.medium, { color, fontSize: 14, lineHeight: 18 }]}>{mark}</Text>
    );
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
  if (name === 'income') {
    return (
      <svg {...common}>
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
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

export function BottomNav({ inset }: { inset: number }) {
  const pathname = usePathname();
  const router = useRouter();
  return (
    <View style={{ paddingBottom: Math.max(inset, 8) }} className="flex-row border-t border-line bg-card px-1 pt-2">
      {ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Pressable key={item.href} accessibilityRole="button" onPress={() => router.push(item.href)} className="flex-1 items-center py-2">
            <Text style={font.medium} className={`text-xs ${active ? 'text-moss' : 'text-mute'}`}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
