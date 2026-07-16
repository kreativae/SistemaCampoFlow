import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../src/lib/auth-context';

export default function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#1B5E20" />
      </View>
    );
  }

  if (!user) return <Redirect href="/(auth)/entrar" />;
  return <Redirect href="/(app)/fazendas" />;
}
