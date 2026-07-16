import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../../../../src/lib/api';
import { EmptyState } from '../../../../../src/components/EmptyState';

interface Crop { id: string; name: string; culture?: string; areaHectares?: number; startDate?: string; endDate?: string; status?: string }

export default function CropsScreen() {
  const { farmId } = useLocalSearchParams<{ farmId: string }>();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['crops', farmId],
    queryFn: () => apiFetch<Crop[]>(`/farms/${farmId}/crops`),
    enabled: !!farmId,
  });

  if (isLoading) return <View style={s.center}><ActivityIndicator size="large" color="#1B5E20" /></View>;
  if (!data?.length) return <EmptyState icon="🌾" title="Nenhuma safra" subtitle="Cadastre safras pela versão web" />;

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');

  return (
    <FlatList style={s.container} data={data} keyExtractor={(c) => c.id} contentContainerStyle={{ padding: 16 }} onRefresh={refetch} refreshing={false}
      renderItem={({ item }) => (
        <View style={s.card}>
          <View style={s.row}>
            <Text style={s.name}>{item.name}</Text>
            {item.status && <Text style={s.badge}>{item.status}</Text>}
          </View>
          <View style={s.row}>
            {item.culture && <Text style={s.meta}>{item.culture}</Text>}
            {item.areaHectares && <Text style={s.meta}>{item.areaHectares} ha</Text>}
          </View>
          {item.startDate && <Text style={s.dates}>{fmtDate(item.startDate)}{item.endDate ? ` → ${fmtDate(item.endDate)}` : ''}</Text>}
        </View>
      )}
    />
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  name: { fontSize: 16, fontWeight: '700', color: '#1B5E20', flex: 1 },
  badge: { backgroundColor: '#e8f5e9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, fontSize: 12, color: '#2e7d32', overflow: 'hidden' },
  meta: { fontSize: 13, color: '#666' },
  dates: { fontSize: 12, color: '#999', marginTop: 2 },
});
