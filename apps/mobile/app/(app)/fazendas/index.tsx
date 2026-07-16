import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { apiFetch } from '../../../src/lib/api';
import { useAuth } from '../../../src/lib/auth-context';
import type { Farm } from '../../../src/lib/types';

export default function FarmsScreen() {
  const { logout } = useAuth();
  const [farms, setFarms] = useState<Farm[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Farm[]>('/farms')
      .then(setFarms)
      .catch((err) => Alert.alert('Erro', err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color="#1B5E20" /></View>;
  }

  return (
    <View style={s.container}>
      {farms.length === 0 ? (
        <View style={s.center}>
          <Text style={s.empty}>Nenhuma fazenda cadastrada</Text>
          <Text style={s.emptyHint}>Crie uma fazenda pela versão web para começar</Text>
        </View>
      ) : (
        <FlatList
          data={farms}
          keyExtractor={(f) => f.id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <TouchableOpacity style={s.card} onPress={() => router.push(`/(app)/fazendas/${item.id}`)}>
              <Text style={s.name}>{item.name}</Text>
              <Text style={s.area}>{item.totalAreaHectares ? `${item.totalAreaHectares} ha` : 'Área não informada'}</Text>
            </TouchableOpacity>
          )}
        />
      )}
      <View style={s.footer}>
        <TouchableOpacity style={s.footerBtn} onPress={() => router.push('/(app)/conta/perfil')}>
          <Text style={s.footerText}>Perfil</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.footerBtn} onPress={() => router.push('/(app)/conta/assinatura')}>
          <Text style={s.footerText}>Assinatura</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.footerBtn} onPress={() => router.push('/(app)/suporte')}>
          <Text style={s.footerText}>Suporte</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.footerBtn} onPress={logout}>
          <Text style={[s.footerText, { color: '#d32f2f' }]}>Sair</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  empty: { fontSize: 18, fontWeight: '600', color: '#333' },
  emptyHint: { fontSize: 14, color: '#666', marginTop: 8, textAlign: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  name: { fontSize: 18, fontWeight: '700', color: '#1B5E20' },
  area: { fontSize: 13, color: '#999', marginTop: 2 },
  footer: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#e0e0e0', backgroundColor: '#fff' },
  footerBtn: { paddingVertical: 8, paddingHorizontal: 12 },
  footerText: { fontSize: 14, fontWeight: '600', color: '#1B5E20' },
});
