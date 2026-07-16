import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { apiFetch, apiDownload } from '../../../../../src/lib/api';
import { useAuth } from '../../../../../src/lib/auth-context';
import { EmptyState } from '../../../../../src/components/EmptyState';

interface Document { id: string; name: string; type?: string; size?: number; createdAt: string; url?: string }

export default function DocumentsScreen() {
  const { farmId } = useLocalSearchParams<{ farmId: string }>();
  const { accessToken } = useAuth();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['documents', farmId],
    queryFn: () => apiFetch<Document[]>(`/farms/${farmId}/documents`),
    enabled: !!farmId,
  });

  if (isLoading) return <View style={s.center}><ActivityIndicator size="large" color="#1B5E20" /></View>;
  if (!data?.length) return <EmptyState icon="📄" title="Nenhum documento" subtitle="Envie documentos pela versão web" />;

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');
  const fmtSize = (b?: number) => {
    if (!b) return '';
    if (b < 1024) return `${b} B`;
    if (b < 1048576) return `${(b / 1024).toFixed(0)} KB`;
    return `${(b / 1048576).toFixed(1)} MB`;
  };

  const handleDownload = async (doc: Document) => {
    try {
      await apiDownload(`/farms/${farmId}/documents/${doc.id}/download`, doc.name, accessToken);
    } catch (err: any) {
      Alert.alert('Erro', err.message ?? 'Falha ao baixar');
    }
  };

  return (
    <FlatList style={s.container} data={data} keyExtractor={(d) => d.id} contentContainerStyle={{ padding: 16 }} onRefresh={refetch} refreshing={false}
      renderItem={({ item }) => (
        <TouchableOpacity style={s.card} onPress={() => handleDownload(item)}>
          <Text style={s.name}>{item.name}</Text>
          <View style={s.row}>
            <Text style={s.meta}>{fmtDate(item.createdAt)}</Text>
            {item.type && <Text style={s.meta}>{item.type}</Text>}
            <Text style={s.meta}>{fmtSize(item.size)}</Text>
          </View>
        </TouchableOpacity>
      )}
    />
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  name: { fontSize: 15, fontWeight: '600', color: '#333', marginBottom: 4 },
  row: { flexDirection: 'row', gap: 12 },
  meta: { fontSize: 12, color: '#999' },
});
