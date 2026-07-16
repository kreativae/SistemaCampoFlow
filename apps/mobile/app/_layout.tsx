import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { queryClient, asyncStoragePersister } from '../src/lib/query-client';
import { AuthProvider } from '../src/lib/auth-context';

export default function RootLayout() {
  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister: asyncStoragePersister, maxAge: 1000 * 60 * 60 * 24 }}>
      <AuthProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }} />
      </AuthProvider>
    </PersistQueryClientProvider>
  );
}
