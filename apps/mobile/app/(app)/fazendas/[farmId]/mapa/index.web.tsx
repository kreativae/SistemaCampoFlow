import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function MapScreenWeb() {
  return (
    <View style={s.container}>
      <Ionicons name="map-outline" size={48} color="#9CA3AF" />
      <Text style={s.title}>Mapa indisponível na web</Text>
      <Text style={s.subtitle}>Use o aplicativo no dispositivo para acessar o mapa interativo.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  title: { fontSize: 18, fontWeight: '700', color: '#374151', marginTop: 16 },
  subtitle: { fontSize: 14, color: '#9CA3AF', marginTop: 8, textAlign: 'center' },
});
