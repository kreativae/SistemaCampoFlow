import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Linking } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../../../../src/lib/api';
import { EmptyState } from '../../../../../src/components/EmptyState';

interface Contact { id: string; name: string; role?: string; phone?: string; email?: string; company?: string }

export default function ContactsScreen() {
  const { farmId } = useLocalSearchParams<{ farmId: string }>();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['contacts', farmId],
    queryFn: () => apiFetch<Contact[]>(`/farms/${farmId}/contacts`),
    enabled: !!farmId,
  });

  if (isLoading) return <View style={s.center}><ActivityIndicator size="large" color="#1B5E20" /></View>;
  if (!data?.length) return <EmptyState icon="📇" title="Nenhum contato" subtitle="Cadastre contatos pela versão web" />;

  return (
    <FlatList style={s.container} data={data} keyExtractor={(c) => c.id} contentContainerStyle={{ padding: 16 }} onRefresh={refetch} refreshing={false}
      renderItem={({ item }) => (
        <View style={s.card}>
          <Text style={s.name}>{item.name}</Text>
          {item.role && <Text style={s.role}>{item.role}</Text>}
          {item.company && <Text style={s.company}>{item.company}</Text>}
          <View style={s.actions}>
            {item.phone && (
              <TouchableOpacity style={s.actionBtn} onPress={() => Linking.openURL(`tel:${item.phone}`)}>
                <Text style={s.actionText}>Ligar</Text>
              </TouchableOpacity>
            )}
            {item.email && (
              <TouchableOpacity style={s.actionBtn} onPress={() => Linking.openURL(`mailto:${item.email}`)}>
                <Text style={s.actionText}>E-mail</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    />
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  name: { fontSize: 16, fontWeight: '700', color: '#333' },
  role: { fontSize: 13, color: '#1B5E20', marginTop: 2 },
  company: { fontSize: 13, color: '#666', marginTop: 2 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  actionBtn: { backgroundColor: '#e8f5e9', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  actionText: { fontSize: 13, fontWeight: '600', color: '#1B5E20' },
});
