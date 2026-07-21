import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { queryClient, asyncStoragePersister } from '../src/lib/query-client';
import { AuthProvider } from '../src/lib/auth-context';
import { setupOfflineSync } from '../src/lib/offline-sync';
import { registerForPushNotifications, sendPushTokenToServer } from '../src/lib/push-notifications';

setupOfflineSync();

export default function RootLayout() {
  useEffect(() => {
    registerForPushNotifications()
      .then((token) => { if (token) sendPushTokenToServer(token); })
      .catch(() => {});
  }, []);

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister: asyncStoragePersister, maxAge: 1000 * 60 * 60 * 24 }}>
      <AuthProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }} />
      </AuthProvider>
    </PersistQueryClientProvider>
  );
}
