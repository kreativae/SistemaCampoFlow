import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { apiDownload } from '../../../../../src/lib/api';
import { useAuth } from '../../../../../src/lib/auth-context';

const reports = [
  { key: 'rebanho', label: 'Relatório de Rebanho', icon: '🐂', format: 'pdf' },
  { key: 'financeiro', label: 'Relatório Financeiro', icon: '💰', format: 'xlsx' },
  { key: 'pastagens', label: 'Relatório de Pastagens', icon: '🌱', format: 'pdf' },
  { key: 'insumos', label: 'Relatório de Insumos', icon: '📦', format: 'xlsx' },
  { key: 'reproducao', label: 'Relatório Reprodutivo', icon: '🧬', format: 'pdf' },
  { key: 'completo', label: 'Relatório Completo', icon: '📊', format: 'pdf' },
];

export default function ReportsScreen() {
  const { farmId } = useLocalSearchParams<{ farmId: string }>();
  const { accessToken } = useAuth();

  const handleDownload = async (key: string, format: string) => {
    try {
      await apiDownload(`/farms/${farmId}/reports/${key}?format=${format}`, `relatorio-${key}.${format}`, accessToken);
    } catch (err: any) {
      Alert.alert('Erro', err.message ?? 'Falha ao gerar relatório');
    }
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={s.title}>Relatórios disponíveis</Text>
      {reports.map((r) => (
        <TouchableOpacity key={r.key} style={s.card} onPress={() => handleDownload(r.key, r.format)}>
          <Text style={s.icon}>{r.icon}</Text>
          <View style={s.info}>
            <Text style={s.label}>{r.label}</Text>
            <Text style={s.format}>{r.format.toUpperCase()}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  title: { fontSize: 17, fontWeight: '700', color: '#333', marginBottom: 16 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  icon: { fontSize: 28 },
  info: { flex: 1 },
  label: { fontSize: 15, fontWeight: '600', color: '#333' },
  format: { fontSize: 12, color: '#999', marginTop: 2 },
});
