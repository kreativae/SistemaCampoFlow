import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../../../../src/lib/api';
import { EmptyState } from '../../../../../src/components/EmptyState';

interface ReproEvent { id: string; type: string; date: string; animalName?: string; notes?: string; result?: string }

export default function ReproductionScreen() {
  const { farmId } = useLocalSearchParams<{ farmId: string }>();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['reproduction', farmId],
    queryFn: () => apiFetch<ReproEvent[]>(`/farms/${farmId}/reproduction`),
    enabled: !!farmId,
  });

  if (isLoading) return <View style={s.center}><ActivityIndicator size="large" color="#1B5E20" /></View>;
  if (!data?.length) return <EmptyState icon="🧬" title="Nenhum evento reprodutivo" subtitle="Registre pela versão web" />;

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');

  return (
    <FlatList style={s.container} data={data} keyExtractor={(e) => e.id} contentContainerStyle={{ padding: 16 }} onRefresh={refetch} refreshing={false}
      renderItem={({ item }) => (
        <View style={s.card}>
          <View style={s.row}>
            <Text style={s.type}>{item.type}</Text>
            <Text style={s.date}>{fmtDate(item.date)}</Text>
          </View>
          {item.animalName && <Text style={s.animal}>{item.animalName}</Text>}
          {item.result && <Text style={s.result}>{item.result}</Text>}
          {item.notes && <Text style={s.notes}>{item.notes}</Text>}
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
  animal: { fontSize: 14, color: '#333', marginTop: 2 },
  result: { fontSize: 13, color: '#2e7d32', marginTop: 2 },
  notes: { fontSize: 13, color: '#999', marginTop: 4 },
});
