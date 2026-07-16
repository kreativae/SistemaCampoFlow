import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { apiFetch } from '../../../../src/lib/api';

interface DashboardData {
  totalAnimals: number;
  averageWeightKg: number;
  averageDailyGainKg: number;
  stockingRate: { totalCapacity: number; occupiedHeadCount: number; occupancyRate: number };
  currentMonthFinance: { receita: number; despesa: number; saldo: number };
  pendingAlerts: any[];
}

const modules = [
  { key: 'animais', label: 'Rebanho', icon: '🐂' },
  { key: 'pastagens', label: 'Pastagens', icon: '🌱' },
  { key: 'financeiro', label: 'Financeiro', icon: '💰' },
  { key: 'reproducao', label: 'Reprodução', icon: '🧬' },
  { key: 'insumos', label: 'Insumos', icon: '📦' },
  { key: 'maquinas', label: 'Máquinas', icon: '🚜' },
  { key: 'equipe', label: 'Equipe', icon: '👥' },
  { key: 'agenda', label: 'Agenda', icon: '📅' },
  { key: 'safras', label: 'Safras', icon: '🌾' },
  { key: 'negocios', label: 'Negócios', icon: '🤝' },
  { key: 'documentos', label: 'Documentos', icon: '📄' },
  { key: 'relatorios', label: 'Relatórios', icon: '📊' },
  { key: 'inteligencia', label: 'Inteligência', icon: '🧠' },
  { key: 'notificacoes', label: 'Notificações', icon: '🔔' },
  { key: 'contatos', label: 'Contatos', icon: '📇' },
];

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={s.metric}>
      <Text style={s.metricValue}>{value}</Text>
      <Text style={s.metricLabel}>{label}</Text>
    </View>
  );
}

export default function FarmDashboard() {
  const { farmId } = useLocalSearchParams<{ farmId: string }>();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const res = await apiFetch<DashboardData>(`/farms/${farmId}/dashboard/overview`);
      setData(res);
    } catch (err: any) {
      Alert.alert('Erro', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, [farmId]);

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#1B5E20" /></View>;

  const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 16 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#1B5E20" />}>
      {data && (
        <>
          <View style={s.metricsRow}>
            <MetricCard label="Animais" value={data.totalAnimals} />
            <MetricCard label="Peso médio" value={`${data.averageWeightKg.toFixed(0)} kg`} />
          </View>
          <View style={s.metricsRow}>
            <MetricCard label="GMD" value={`${data.averageDailyGainKg.toFixed(2)} kg`} />
            <MetricCard label="Ocupação" value={`${(data.stockingRate.occupancyRate * 100).toFixed(0)}%`} />
          </View>
          <View style={s.financeCard}>
            <Text style={s.financeTitle}>Financeiro do mês</Text>
            <View style={s.financeRow}>
              <Text style={[s.financeValue, { color: '#2e7d32' }]}>{fmt(data.currentMonthFinance.receita)}</Text>
              <Text style={[s.financeValue, { color: '#c62828' }]}>{fmt(data.currentMonthFinance.despesa)}</Text>
              <Text style={[s.financeValue, { color: data.currentMonthFinance.saldo >= 0 ? '#2e7d32' : '#c62828' }]}>{fmt(data.currentMonthFinance.saldo)}</Text>
            </View>
            <View style={s.financeRow}>
              <Text style={s.financeLabel}>Receita</Text>
              <Text style={s.financeLabel}>Despesa</Text>
              <Text style={s.financeLabel}>Saldo</Text>
            </View>
          </View>
        </>
      )}
      <Text style={s.sectionTitle}>Módulos</Text>
      <View style={s.modulesGrid}>
        {modules.map((m) => (
          <TouchableOpacity key={m.key} style={s.moduleCard} onPress={() => router.push(`/(app)/fazendas/${farmId}/${m.key}`)}>
            <Text style={s.moduleIcon}>{m.icon}</Text>
            <Text style={s.moduleLabel}>{m.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  metricsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  metric: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  metricValue: { fontSize: 22, fontWeight: '700', color: '#1B5E20' },
  metricLabel: { fontSize: 12, color: '#666', marginTop: 4 },
  financeCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  financeTitle: { fontSize: 15, fontWeight: '600', color: '#333', marginBottom: 12 },
  financeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  financeValue: { fontSize: 16, fontWeight: '700', flex: 1, textAlign: 'center' },
  financeLabel: { fontSize: 11, color: '#999', flex: 1, textAlign: 'center', marginTop: 2 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#333', marginBottom: 12 },
  modulesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  moduleCard: { width: '47%', backgroundColor: '#fff', borderRadius: 12, padding: 20, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  moduleIcon: { fontSize: 28, marginBottom: 8 },
  moduleLabel: { fontSize: 14, fontWeight: '600', color: '#333' },
});
