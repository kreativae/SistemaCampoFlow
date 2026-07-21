import { Redirect, Stack } from 'expo-router';
import { useAuth } from '../../src/lib/auth-context';
import { ActivityIndicator, View } from 'react-native';

export default function AppLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#1B5E20" />
      </View>
    );
  }

  if (!user) return <Redirect href="/(auth)/entrar" />;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#0B3D20' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
        headerBackTitle: 'Voltar',
      }}
    >
      <Stack.Screen name="fazendas/index" options={{ headerShown: false }} />
      <Stack.Screen name="fazendas/[farmId]" options={{ headerShown: false }} />
      <Stack.Screen name="conta/perfil" options={{ title: 'Perfil' }} />
      <Stack.Screen name="conta/assinatura" options={{ title: 'Assinatura' }} />
      <Stack.Screen name="suporte/index" options={{ title: 'Suporte' }} />
    </Stack>
  );
}
