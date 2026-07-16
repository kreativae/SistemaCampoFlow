import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../../../../src/lib/api';
import { EmptyState } from '../../../../../src/components/EmptyState';

interface Notification { id: string; title: string; message: string; read: boolean; createdAt: string; type?: string }

export default function NotificationsScreen() {
  const { farmId } = useLocalSearchParams<{ farmId: string }>();
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['notifications', farmId],
    queryFn: () => apiFetch<Notification[]>(`/farms/${farmId}/notifications`),
    enabled: !!farmId,
  });
  const markRead = useMutation({
    mutationFn: (id: string) => apiFetch(`/farms/${farmId}/notifications/${id}/read`, { method: 'PATCH' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications', farmId] }),
  });

  if (isLoading) return <View style={s.center}><ActivityIndicator size="large" color="#1B5E20" /></View>;
  if (!data?.length) return <EmptyState icon="🔔" title="Nenhuma notificação" />;

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');

  return (
    <FlatList style={s.container} data={data} keyExtractor={(n) => n.id} contentContainerStyle={{ padding: 16 }} onRefresh={refetch} refreshing={false}
      renderItem={({ item }) => (
        <TouchableOpacity style={[s.card, !item.read && s.unread]} onPress={() => !item.read && markRead.mutate(item.id)}>
          <View style={s.row}>
            <Text style={s.title}>{item.title}</Text>
            <Text style={s.date}>{fmtDate(item.createdAt)}</Text>
          </View>
          <Text style={s.message}>{item.message}</Text>
        </TouchableOpacity>
      )}
    />
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  unread: { borderLeftWidth: 4, borderLeftColor: '#1B5E20' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  title: { fontSize: 15, fontWeight: '700', color: '#333', flex: 1 },
  date: { fontSize: 12, color: '#999' },
  message: { fontSize: 14, color: '#666', lineHeight: 20 },
});
