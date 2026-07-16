import { View, Text, SectionList, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../../../../src/lib/api';
import { EmptyState } from '../../../../../src/components/EmptyState';

interface Event { id: string; title: string; date: string; type?: string; description?: string }

export default function AgendaScreen() {
  const { farmId } = useLocalSearchParams<{ farmId: string }>();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['events', farmId],
    queryFn: () => apiFetch<Event[]>(`/farms/${farmId}/events`),
    enabled: !!farmId,
  });

  if (isLoading) return <View style={s.center}><ActivityIndicator size="large" color="#1B5E20" /></View>;
  if (!data?.length) return <EmptyState icon="📅" title="Nenhum evento" subtitle="Cadastre eventos pela versão web" />;

  const grouped = data.reduce<Record<string, Event[]>>((acc, e) => {
    const key = new Date(e.date).toLocaleDateString('pt-BR');
    (acc[key] ??= []).push(e);
    return acc;
  }, {});

  const sections = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([title, data]) => ({ title, data }));

  return (
    <SectionList style={s.container} sections={sections} keyExtractor={(e) => e.id} contentContainerStyle={{ padding: 16 }} onRefresh={refetch} refreshing={false}
      renderSectionHeader={({ section }) => <Text style={s.sectionHeader}>{section.title}</Text>}
      renderItem={({ item }) => (
        <View style={s.card}>
          <Text style={s.title}>{item.title}</Text>
          {item.type && <Text style={s.type}>{item.type}</Text>}
          {item.description && <Text style={s.desc}>{item.description}</Text>}
        </View>
      )}
    />
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  sectionHeader: { fontSize: 14, fontWeight: '700', color: '#1B5E20', marginTop: 12, marginBottom: 6 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  title: { fontSize: 15, fontWeight: '600', color: '#333' },
  type: { fontSize: 12, color: '#666', marginTop: 2 },
  desc: { fontSize: 13, color: '#999', marginTop: 4 },
});
