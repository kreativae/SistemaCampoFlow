import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { usePastures } from '../../../../../src/hooks/use-pastures';
import { EmptyState } from '../../../../../src/components/EmptyState';

export default function PasturesScreen() {
  const { farmId } = useLocalSearchParams<{ farmId: string }>();
  const { data: pastures, isLoading, refetch } = usePastures(farmId);

  if (isLoading) return <View style={s.center}><ActivityIndicator size="large" color="#1B5E20" /></View>;
  if (!pastures?.length) return <EmptyState icon="🌱" title="Nenhuma pastagem" subtitle="Cadastre pastagens pela versão web" />;

  return (
    <FlatList
      style={s.container}
      data={pastures}
      keyExtractor={(p) => p.id}
      contentContainerStyle={{ padding: 16 }}
      onRefresh={refetch}
      refreshing={false}
      renderItem={({ item }) => (
        <View style={s.card}>
          <Text style={s.name}>{item.name}</Text>
          <View style={s.row}>
            <Text style={s.meta}>{item.areaHectares} ha</Text>
            {item.grassType && <Text style={s.meta}>{item.grassType}</Text>}
          </View>
          {item.animalHeadCount !== undefined && item.animalHeadCount > 0 && (
            <Text style={s.animals}>{item.animalHeadCount} animais</Text>
          )}
        </View>
      )}
    />
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  name: { fontSize: 16, fontWeight: '700', color: '#1B5E20', marginBottom: 6 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  meta: { fontSize: 13, color: '#666' },
  animals: { fontSize: 13, color: '#666', marginTop: 4 },
});
