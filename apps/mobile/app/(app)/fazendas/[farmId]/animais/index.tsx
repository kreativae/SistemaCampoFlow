import { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useAnimals, useDeleteAnimal } from '../../../../../src/hooks/use-animals';
import { EmptyState } from '../../../../../src/components/EmptyState';
import { ConfirmModal } from '../../../../../src/components/ConfirmModal';
import type { Animal } from '../../../../../src/lib/types';

export default function AnimalsScreen() {
  const { farmId } = useLocalSearchParams<{ farmId: string }>();
  const { data: animals, isLoading, refetch } = useAnimals(farmId);
  const deleteAnimal = useDeleteAnimal(farmId);
  const [search, setSearch] = useState('');
  const [toDelete, setToDelete] = useState<Animal | null>(null);

  const filtered = (animals ?? []).filter((a) =>
    a.name?.toLowerCase().includes(search.toLowerCase()) ||
    a.earTag?.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) return <View style={s.center}><ActivityIndicator size="large" color="#1B5E20" /></View>;

  return (
    <View style={s.container}>
      <TextInput style={s.search} placeholder="Buscar animal..." value={search} onChangeText={setSearch} />
      {filtered.length === 0 ? (
        <EmptyState icon="🐂" title="Nenhum animal" subtitle="Cadastre animais pela versão web" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ padding: 16, paddingTop: 0 }}
          onRefresh={refetch}
          refreshing={false}
          renderItem={({ item }) => (
            <TouchableOpacity style={s.card} onPress={() => router.push(`/(app)/fazendas/${farmId}/animais/${item.id}`)} onLongPress={() => setToDelete(item)}>
              <View style={s.row}>
                <Text style={s.name}>{item.name || item.earTag || 'Sem nome'}</Text>
                {item.breed && <Text style={s.badge}>{item.breed}</Text>}
              </View>
              <View style={s.row}>
                {item.earTag && <Text style={s.meta}>#{item.earTag}</Text>}
                {item.category && <Text style={s.meta}>{item.category}</Text>}
                {item.currentWeightKg && <Text style={s.meta}>{item.currentWeightKg} kg</Text>}
              </View>
            </TouchableOpacity>
          )}
        />
      )}
      <ConfirmModal
        visible={!!toDelete}
        title="Excluir animal"
        message={`Deseja excluir "${toDelete?.name || toDelete?.earTag}"?`}
        confirmLabel="Excluir"
        destructive
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          if (!toDelete) return;
          deleteAnimal.mutate(toDelete.id, {
            onSuccess: () => setToDelete(null),
            onError: (err: any) => { setToDelete(null); Alert.alert('Erro', err.message); },
          });
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  search: { margin: 16, marginBottom: 8, backgroundColor: '#fff', borderRadius: 10, padding: 12, fontSize: 15, borderWidth: 1, borderColor: '#e0e0e0' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  name: { fontSize: 16, fontWeight: '700', color: '#1B5E20', flex: 1 },
  badge: { backgroundColor: '#e8f5e9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, fontSize: 12, color: '#2e7d32' },
  meta: { fontSize: 13, color: '#666' },
});
