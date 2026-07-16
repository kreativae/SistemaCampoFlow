import { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../../../../src/lib/api';
import { EmptyState } from '../../../../../src/components/EmptyState';

interface Transaction { id: string; date: string; description: string; amount: number; type: 'RECEITA' | 'DESPESA'; category?: string }

export default function FinanceScreen() {
  const { farmId } = useLocalSearchParams<{ farmId: string }>();
  const [filter, setFilter] = useState<'TODOS' | 'RECEITA' | 'DESPESA'>('TODOS');
  const { data: transactions, isLoading, refetch } = useQuery({
    queryKey: ['finance', farmId],
    queryFn: () => apiFetch<Transaction[]>(`/farms/${farmId}/finance`),
    enabled: !!farmId,
  });

  if (isLoading) return <View style={s.center}><ActivityIndicator size="large" color="#1B5E20" /></View>;

  const filtered = (transactions ?? []).filter((t) => filter === 'TODOS' || t.type === filter);
  const total = filtered.reduce((sum, t) => sum + (t.type === 'RECEITA' ? t.amount : -t.amount), 0);
  const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');

  return (
    <View style={s.container}>
      <View style={s.summary}>
        <Text style={s.summaryLabel}>Saldo do período</Text>
        <Text style={[s.summaryValue, { color: total >= 0 ? '#2e7d32' : '#c62828' }]}>{fmt(total)}</Text>
      </View>
      <View style={s.filters}>
        {(['TODOS', 'RECEITA', 'DESPESA'] as const).map((f) => (
          <TouchableOpacity key={f} style={[s.filterBtn, filter === f && s.filterActive]} onPress={() => setFilter(f)}>
            <Text style={[s.filterText, filter === f && s.filterTextActive]}>{f === 'TODOS' ? 'Todos' : f === 'RECEITA' ? 'Receitas' : 'Despesas'}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {filtered.length === 0 ? (
        <EmptyState icon="💰" title="Nenhum lançamento" />
      ) : (
        <FlatList data={filtered} keyExtractor={(t) => t.id} contentContainerStyle={{ padding: 16, paddingTop: 0 }} onRefresh={refetch} refreshing={false}
          renderItem={({ item }) => (
            <View style={s.card}>
              <View style={s.row}>
                <Text style={s.description}>{item.description}</Text>
                <Text style={[s.amount, { color: item.type === 'RECEITA' ? '#2e7d32' : '#c62828' }]}>{item.type === 'RECEITA' ? '+' : '-'}{fmt(item.amount)}</Text>
              </View>
              <View style={s.row}>
                <Text style={s.meta}>{fmtDate(item.date)}</Text>
                {item.category && <Text style={s.meta}>{item.category}</Text>}
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  summary: { backgroundColor: '#fff', margin: 16, borderRadius: 12, padding: 16, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  summaryLabel: { fontSize: 13, color: '#666' },
  summaryValue: { fontSize: 24, fontWeight: '700', marginTop: 4 },
  filters: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#e0e0e0' },
  filterActive: { backgroundColor: '#1B5E20' },
  filterText: { fontSize: 13, color: '#666', fontWeight: '600' },
  filterTextActive: { color: '#fff' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  description: { fontSize: 15, fontWeight: '600', color: '#333', flex: 1, marginRight: 8 },
  amount: { fontSize: 15, fontWeight: '700' },
  meta: { fontSize: 12, color: '#999' },
});
