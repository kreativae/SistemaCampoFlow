import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../../../../src/lib/api';
import { EmptyState } from '../../../../../src/components/EmptyState';

interface Deal { id: string; type: string; date: string; counterpart?: string; totalValue?: number; status?: string; items?: number }

export default function DealsScreen() {
  const { farmId } = useLocalSearchParams<{ farmId: string }>();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['deals', farmId],
    queryFn: () => apiFetch<Deal[]>(`/farms/${farmId}/deals`),
    enabled: !!farmId,
  });

  if (isLoading) return <View style={s.center}><ActivityIndicator size="large" color="#1B5E20" /></View>;
  if (!data?.length) return <EmptyState icon="🤝" title="Nenhum negócio" subtitle="Registre negócios pela versão web" />;

  const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');

  return (
    <FlatList style={s.container} data={data} keyExtractor={(d) => d.id} contentContainerStyle={{ padding: 16 }} onRefresh={refetch} refreshing={false}
      renderItem={({ item }) => (
        <View style={s.card}>
          <View style={s.row}>
            <Text style={s.type}>{item.type}</Text>
            <Text style={s.date}>{fmtDate(item.date)}</Text>
          </View>
          {item.counterpart && <Text style={s.counterpart}>{item.counterpart}</Text>}
          <View style={s.row}>
            {item.totalValue !== undefined && <Text style={s.value}>{fmt(item.totalValue)}</Text>}
            {item.status && <Text style={s.status}>{item.status}</Text>}
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
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  type: { fontSize: 15, fontWeight: '700', color: '#1B5E20' },
  date: { fontSize: 13, color: '#666' },
  counterpart: { fontSize: 14, color: '#333', marginBottom: 4 },
  value: { fontSize: 15, fontWeight: '700', color: '#2e7d32' },
  status: { fontSize: 12, color: '#666', backgroundColor: '#f5f5f5', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
});
