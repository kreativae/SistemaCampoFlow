import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="entrar" />
      <Stack.Screen name="cadastrar" />
      <Stack.Screen name="esqueci-senha" />
    </Stack>
  );
}
