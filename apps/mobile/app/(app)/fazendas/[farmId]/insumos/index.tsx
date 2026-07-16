import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../../../../src/lib/api';
import { EmptyState } from '../../../../../src/components/EmptyState';

interface Supply { id: string; name: string; category?: string; unit?: string; currentStock?: number; minimumStock?: number }

export default function SuppliesScreen() {
  const { farmId } = useLocalSearchParams<{ farmId: string }>();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['supplies', farmId],
    queryFn: () => apiFetch<Supply[]>(`/farms/${farmId}/supplies`),
    enabled: !!farmId,
  });

  if (isLoading) return <View style={s.center}><ActivityIndicator size="large" color="#1B5E20" /></View>;
  if (!data?.length) return <EmptyState icon="📦" title="Nenhum insumo" subtitle="Cadastre insumos pela versão web" />;

  return (
    <FlatList style={s.container} data={data} keyExtractor={(i) => i.id} contentContainerStyle={{ padding: 16 }} onRefresh={refetch} refreshing={false}
      renderItem={({ item }) => {
        const low = !!(item.minimumStock && item.currentStock !== undefined && item.currentStock <= item.minimumStock);
        return (
          <View style={[s.card, low ? s.cardLow : undefined]}>
            <View style={s.row}>
              <Text style={s.name}>{item.name}</Text>
              {item.category && <Text style={s.badge}>{item.category}</Text>}
            </View>
            <Text style={s.stock}>Estoque: {item.currentStock ?? 0} {item.unit ?? 'un'}{low ? ' ⚠️ Baixo' : ''}</Text>
          </View>
        );
      }}
    />
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  cardLow: { borderLeftWidth: 4, borderLeftColor: '#ff9800' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  name: { fontSize: 16, fontWeight: '700', color: '#333', flex: 1 },
  badge: { backgroundColor: '#e3f2fd', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, fontSize: 12, color: '#1565c0' },
  stock: { fontSize: 13, color: '#666' },
});
