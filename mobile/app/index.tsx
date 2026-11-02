import { View } from 'react-native';
import { Redirect } from 'expo-router';

import { useAuth } from '../lib/auth';

export default function Index() {
  const { user, ready } = useAuth();
  if (!ready) return <View className="flex-1 bg-paper" />;
  return <Redirect href={user ? '/dashboard' : '/login'} />;
}
