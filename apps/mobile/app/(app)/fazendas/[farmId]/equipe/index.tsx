import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../../../../src/lib/api';
import { EmptyState } from '../../../../../src/components/EmptyState';

interface Employee { id: string; name: string; role?: string; phone?: string }

export default function TeamScreen() {
  const { farmId } = useLocalSearchParams<{ farmId: string }>();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['employees', farmId],
    queryFn: () => apiFetch<Employee[]>(`/farms/${farmId}/employees`),
    enabled: !!farmId,
  });

  if (isLoading) return <View style={s.center}><ActivityIndicator size="large" color="#1B5E20" /></View>;
  if (!data?.length) return <EmptyState icon="👥" title="Nenhum funcionário" subtitle="Cadastre pela versão web" />;

  return (
    <FlatList style={s.container} data={data} keyExtractor={(e) => e.id} contentContainerStyle={{ padding: 16 }} onRefresh={refetch} refreshing={false}
      renderItem={({ item }) => (
        <View style={s.card}>
          <Text style={s.name}>{item.name}</Text>
          <View style={s.row}>
            {item.role && <Text style={s.meta}>{item.role}</Text>}
            {item.phone && <Text style={s.meta}>{item.phone}</Text>}
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
  name: { fontSize: 16, fontWeight: '700', color: '#333', marginBottom: 4 },
  row: { flexDirection: 'row', gap: 12 },
  meta: { fontSize: 13, color: '#666' },
});
