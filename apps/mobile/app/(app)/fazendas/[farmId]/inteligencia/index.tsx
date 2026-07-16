import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../../../../src/lib/api';

interface BIData {
  kpis?: { label: string; value: string | number; trend?: string }[];
  insights?: string[];
}

export default function IntelligenceScreen() {
  const { farmId } = useLocalSearchParams<{ farmId: string }>();
  const { data, isLoading } = useQuery({
    queryKey: ['bi', farmId],
    queryFn: () => apiFetch<BIData>(`/farms/${farmId}/bi`),
    enabled: !!farmId,
  });

  if (isLoading) return <View style={s.center}><ActivityIndicator size="large" color="#1B5E20" /></View>;

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={s.title}>Inteligência</Text>

      {data?.kpis && data.kpis.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Indicadores</Text>
          {data.kpis.map((kpi, i) => (
            <View key={i} style={s.kpiRow}>
              <Text style={s.kpiLabel}>{kpi.label}</Text>
              <View style={s.kpiRight}>
                <Text style={s.kpiValue}>{kpi.value}</Text>
                {kpi.trend && <Text style={[s.kpiTrend, { color: kpi.trend.startsWith('+') ? '#2e7d32' : '#c62828' }]}>{kpi.trend}</Text>}
              </View>
            </View>
          ))}
        </View>
      )}

      {data?.insights && data.insights.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Insights</Text>
          {data.insights.map((ins, i) => (
            <Text key={i} style={s.insight}>• {ins}</Text>
          ))}
        </View>
      )}

      {(!data?.kpis?.length && !data?.insights?.length) && (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>📊</Text>
          <Text style={s.emptyText}>Dados insuficientes para gerar análises</Text>
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: '#333', marginBottom: 16 },
  section: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1B5E20', marginBottom: 12 },
  kpiRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  kpiLabel: { fontSize: 14, color: '#666', flex: 1 },
  kpiRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kpiValue: { fontSize: 16, fontWeight: '700', color: '#333' },
  kpiTrend: { fontSize: 13, fontWeight: '600' },
  insight: { fontSize: 14, color: '#333', lineHeight: 22, marginBottom: 8 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 15, color: '#666', textAlign: 'center' },
});
