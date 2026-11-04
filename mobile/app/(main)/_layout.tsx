import { useEffect, useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { Redirect, Slot, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MobileHeader, SideNav } from '../../components/Nav';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { WIDE, minutesOf, todayISO } from '../../lib/format';
import { publishPendingCount, subscribePendingCount } from '../../lib/pendingBadge';

export default function MainLayout() {
  const { user, ready, signOut } = useAuth();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const wide = width >= WIDE;
  const [pendingCount, setPendingCount] = useState(0);
  const [sessionNow, setSessionNow] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => subscribePendingCount(setPendingCount), []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname, wide]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const look = () => {
      api.reservations({ pending: true }).then((data) => {
        if (active) publishPendingCount(data.reservations.length);
      }).catch(() => {});
      api.reservations({ date: todayISO() }).then((data) => {
        if (!active) return;
        const now = new Date();
        const minute = now.getHours() * 60 + now.getMinutes();
        const anyUser = user.role === 'admin';
        setSessionNow(
          data.reservations.some((visit) => {
            if (visit.status === 'cancelled') return false;
            if (!anyUser && visit.doctorId !== user.id) return false;
            return minutesOf(visit.startTime) <= minute && minutesOf(visit.endTime) > minute;
          }),
        );
      }).catch(() => {});
    };
    look();
    const timer = setInterval(look, 30000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [user, pathname]);

  if (!ready) return <View className="flex-1 bg-paper" />;
  if (!user) return <Redirect href="/login" />;

  const sideNav = (
    <SideNav
      user={user}
      pendingCount={pendingCount}
      sessionNow={sessionNow}
      insetTop={wide ? insets.top : 16}
      insetBottom={insets.bottom}
      brand={wide}
      onSignOut={() => void signOut()}
      onNavigate={() => setMenuOpen(false)}
    />
  );

  return (
    <View className="flex-1 flex-row bg-paper">
      {wide ? sideNav : null}
      <View className="flex-1" style={{ paddingTop: wide ? 0 : insets.top, paddingBottom: wide ? 0 : insets.bottom }}>
        {wide ? null : <MobileHeader user={user} open={menuOpen} onToggle={() => setMenuOpen((open) => !open)} />}
        <View className="flex-1">
          <Slot />
          {!wide && menuOpen ? (
            <View className="absolute bottom-0 left-0 right-0 top-0 flex-row">
              {sideNav}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close menu"
                onPress={() => setMenuOpen(false)}
                className="flex-1"
                style={{ backgroundColor: 'rgba(18, 48, 51, 0.4)' }}
              />
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}
