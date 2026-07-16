import { View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAnimal } from '../../../../../src/hooks/use-animals';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../../../../src/lib/api';

function Field({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null;
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <Text style={s.fieldValue}>{String(value)}</Text>
    </View>
  );
}

interface Weighing { id: string; date: string; weightKg: number }
interface Vaccination { id: string; date: string; vaccine: string; dose?: string }

export default function AnimalDetailScreen() {
  const { farmId, animalId } = useLocalSearchParams<{ farmId: string; animalId: string }>();
  const { data: animal, isLoading, refetch } = useAnimal(farmId, animalId);
  const { data: weighings } = useQuery({
    queryKey: ['weighings', farmId, animalId],
    queryFn: () => apiFetch<Weighing[]>(`/farms/${farmId}/animals/${animalId}/weighings`),
    enabled: !!farmId && !!animalId,
  });
  const { data: vaccinations } = useQuery({
    queryKey: ['vaccinations', farmId, animalId],
    queryFn: () => apiFetch<Vaccination[]>(`/farms/${farmId}/animals/${animalId}/vaccinations`),
    enabled: !!farmId && !!animalId,
  });

  if (isLoading || !animal) return <View style={s.center}><ActivityIndicator size="large" color="#1B5E20" /></View>;

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 16 }} refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor="#1B5E20" />}>
      <Text style={s.title}>{animal.name || animal.earTag || 'Animal'}</Text>
      <View style={s.section}>
        <Text style={s.sectionTitle}>Dados gerais</Text>
        <Field label="Brinco" value={animal.earTag} />
        <Field label="RFID" value={animal.rfid} />
        <Field label="Raça" value={animal.breed} />
        <Field label="Categoria" value={animal.category} />
        <Field label="Sexo" value={animal.sex} />
        <Field label="Peso" value={animal.currentWeightKg ? `${animal.currentWeightKg} kg` : undefined} />
        <Field label="Nascimento" value={animal.birthDate ? fmtDate(animal.birthDate) : undefined} />
        <Field label="Ativo" value={animal.active ? 'Sim' : 'Não'} />
      </View>
      {weighings && weighings.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Pesagens ({weighings.length})</Text>
          {weighings.slice(0, 10).map((w) => (
            <View key={w.id} style={s.listItem}>
              <Text style={s.listPrimary}>{w.weightKg} kg</Text>
              <Text style={s.listSecondary}>{fmtDate(w.date)}</Text>
            </View>
          ))}
        </View>
      )}
      {vaccinations && vaccinations.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Vacinações ({vaccinations.length})</Text>
          {vaccinations.slice(0, 10).map((v) => (
            <View key={v.id} style={s.listItem}>
              <Text style={s.listPrimary}>{v.vaccine}</Text>
              <Text style={s.listSecondary}>{fmtDate(v.date)}{v.dose ? ` · ${v.dose}` : ''}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '700', color: '#1B5E20', marginBottom: 16 },
  section: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#333', marginBottom: 12 },
  field: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  fieldLabel: { fontSize: 14, color: '#666' },
  fieldValue: { fontSize: 14, fontWeight: '600', color: '#333' },
  listItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  listPrimary: { fontSize: 14, fontWeight: '600', color: '#333' },
  listSecondary: { fontSize: 13, color: '#666' },
});
