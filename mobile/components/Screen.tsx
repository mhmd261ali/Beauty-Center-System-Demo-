import { forwardRef, type ReactNode } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';

import { WIDE } from '../lib/format';

export const Screen = forwardRef<ScrollView, { children: ReactNode }>(function Screen({ children }, ref) {
  const { width } = useWindowDimensions();
  const wide = width >= WIDE;
  return (
    <ScrollView
      ref={ref}
      className="flex-1 bg-paper"
      contentContainerStyle={{
        paddingHorizontal: wide ? 36 : 16,
        paddingTop: wide ? 28 : 12,
        paddingBottom: 48,
      }}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
});

export function Panel({ children }: { children: ReactNode }) {
  return <View className="mb-4 rounded-2xl border border-line bg-card p-4">{children}</View>;
}
