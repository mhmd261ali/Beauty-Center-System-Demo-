import { View, useWindowDimensions } from 'react-native';
import { Redirect, Slot, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomNav, MobileHeader, SideNav } from '../../components/Nav';
import { useAuth } from '../../lib/auth';
import { WIDE } from '../../lib/format';

export default function MainLayout() {
  const { user, ready, signOut } = useAuth();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const wide = width >= WIDE;

  if (!ready) return <View className="flex-1 bg-paper" />;
  if (!user) return <Redirect href="/login" />;

  return (
    <View className="flex-1 flex-row bg-paper">
      {wide ? <SideNav user={user} insetTop={insets.top} insetBottom={insets.bottom} onSignOut={() => void signOut()} /> : null}
      <View className="flex-1" style={{ paddingTop: wide ? 0 : insets.top }}>
        {wide ? null : (
          <MobileHeader
            user={user}
            onSignOut={() => void signOut()}
            onDashboard={() => router.push('/dashboard')}
            onStaff={() => router.push('/staff')}
            onIncome={() => router.push('/income')}
          />
        )}
        <View className="flex-1">
          <Slot />
        </View>
        {wide ? null : <BottomNav inset={insets.bottom} />}
      </View>
    </View>
  );
}
