import { useEffect, useState } from 'react';
import { Image, Platform, View } from 'react-native';

import { getToken, serverUrl } from '../lib/api';

export function InstrumentPhoto({ id, size = 96 }: { id: number; size?: number }) {
  const [source, setSource] = useState<{ uri: string; headers?: { Authorization: string } } | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    (async () => {
      const token = await getToken();
      const url = `${serverUrl()}/api/instruments/${id}/image`;
      if (Platform.OS !== 'web') {
        if (active) setSource({ uri: url, headers: { Authorization: `Bearer ${token ?? ''}` } });
        return;
      }
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token ?? ''}` } });
      if (!response.ok) return;
      const blob = await response.blob();
      objectUrl = URL.createObjectURL(blob);
      if (active) setSource({ uri: objectUrl });
    })();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);

  if (!source) {
    return <View className="bg-sand" style={{ width: size, height: size, borderRadius: 12 }} />;
  }

  return (
    <Image
      source={source}
      accessibilityIgnoresInvertColors
      style={{ width: size, height: size, borderRadius: 12, backgroundColor: '#d7f4f4' }}
    />
  );
}
