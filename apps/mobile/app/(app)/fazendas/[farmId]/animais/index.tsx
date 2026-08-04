import { useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useQuery } from '@tanstack/react-query';
import { theme } from '../../../../../src/lib/theme';
import { Fab } from '../../../../../src/components/UI';
import { useAnimals, useCreateAnimal, useDeleteAnimal } from '../../../../../src/hooks/use-animals';
import { EmptyState } from '../../../../../src/components/EmptyState';
import { ConfirmModal } from '../../../../../src/components/ConfirmModal';
import { apiFetch } from '../../../../../src/lib/api';
import { toApiDate } from '../../../../../src/lib/dates';
import type { Animal, AnimalPerformance, AnimalSex, AnimalCategory, Pasture } from '../../../../../src/lib/types';
import { ANIMAL_PERFORMANCE_LABEL, calcAnimalAge } from '../../../../../src/lib/types';
import { DateInput } from '../../../../../src/components/DateInput';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const SEX_OPTIONS = ['MALE', 'FEMALE'] as const;
const SEX_LABELS: Record<string, string> = { MALE: 'Macho', FEMALE: 'Fêmea' };
const CATEGORY_OPTIONS = ['BEZERRO', 'BEZERRA', 'NOVILHO', 'NOVILHA', 'GARROTE', 'BOI', 'VACA', 'TOURO', 'MATRIZ'] as const;
const PERFORMANCE_OPTIONS: AnimalPerformance[] = ['CABECEIRA', 'MEIO', 'FUNDO'];
const AGE_PERIOD_OPTIONS = ['0-4 meses', '5-12 meses', '13-24 meses', '25-36 meses', '36+ meses'] as const;
const AGE_PERIOD_SHORT: Record<string, string> = {
  '0-4 meses': '0-4m',
  '5-12 meses': '5-12m',
  '13-24 meses': '13-24m',
  '25-36 meses': '25-36m',
  '36+ meses': '36+',
};

const PERF_BADGE_STYLES: Record<AnimalPerformance, { bg: string; text: string }> = {
  CABECEIRA: { bg: '#DCFCE7', text: '#15803D' },
  MEIO: { bg: '#FEF9C3', text: '#854D0E' },
  FUNDO: { bg: '#FEE2E2', text: '#991B1B' },
};

type Filters = {
  categories: string[];
  sexes: string[];
  performances: string[];
  agePeriods: string[];
};

const EMPTY_FILTERS: Filters = { categories: [], sexes: [], performances: [], agePeriods: [] };

function countActiveFilters(f: Filters): number {
  return f.categories.length + f.sexes.length + f.performances.length + f.agePeriods.length;
}

function toggleInArray(arr: string[], value: string): string[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

export default function AnimalsScreen() {
  const { farmId } = useLocalSearchParams<{ farmId: string }>();
  const { data: animals, isLoading, refetch } = useAnimals(farmId);
  const createAnimal = useCreateAnimal(farmId);
  const deleteAnimal = useDeleteAnimal(farmId);
  const [search, setSearch] = useState('');
  const [toDelete, setToDelete] = useState<Animal | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [form, setForm] = useState({ earTag: '', name: '', sex: 'MALE', breed: '', category: 'BEZERRO', currentWeightKg: '', birthDate: '' });

  // Fetch pastures for potential future use
  useQuery({
    queryKey: ['pastures', farmId],
    queryFn: () => apiFetch<Pasture[]>(`/fazendas/${farmId}/pastagens`),
    enabled: !!farmId,
  });

  const activeFilterCount = countActiveFilters(filters);

  const filtered = useMemo(() => {
    let list: Animal[] = animals ?? [];

    // Text search
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) => a.name?.toLowerCase().includes(q) || a.earTag?.toLowerCase().includes(q),
      );
    }

    // Category filter
    if (filters.categories.length > 0) {
      list = list.filter((a) => filters.categories.includes(a.category));
    }

    // Sex filter
    if (filters.sexes.length > 0) {
      list = list.filter((a) => filters.sexes.includes(a.sex));
    }

    // Performance filter
    if (filters.performances.length > 0) {
      list = list.filter((a) => a.performance && filters.performances.includes(a.performance));
    }

    // Age period filter
    if (filters.agePeriods.length > 0) {
      list = list.filter((a) => {
        const age = calcAnimalAge(a);
        return age && filters.agePeriods.includes(age.category);
      });
    }

    return list;
  }, [animals, search, filters]);

  const handleCreate = () => {
    if (!form.earTag) { Alert.alert('Erro', 'Brinco é obrigatório'); return; }
    createAnimal.mutate(
      { earTag: form.earTag, name: form.name || undefined, sex: form.sex as AnimalSex, breed: form.breed || undefined, category: form.category as AnimalCategory, currentWeightKg: form.currentWeightKg ? Number(form.currentWeightKg) : undefined, birthDate: toApiDate(form.birthDate) },
      {
        onSuccess: () => { setShowForm(false); setForm({ earTag: '', name: '', sex: 'MALE', breed: '', category: 'BEZERRO', currentWeightKg: '', birthDate: '' }); },
        onError: (err: any) => Alert.alert('Erro', err.message),
      },
    );
  };

  const toggleFilters = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowFilters((v) => !v);
  };

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
  };

  if (isLoading) return <View style={s.center}><ActivityIndicator size="large" color={theme.colors.primary} /></View>;

  return (
    <View style={s.container}>
      {/* Search + Filter bar */}
      <View style={s.searchRow}>
        <TextInput style={s.search} placeholder="Buscar animal..." value={search} onChangeText={setSearch} />
        <TouchableOpacity style={s.filterBtn} onPress={toggleFilters} activeOpacity={0.7}>
          <Ionicons name="options-outline" size={20} color={showFilters ? '#fff' : theme.colors.primary} />
          {activeFilterCount > 0 && (
            <View style={s.filterBadge}>
              <Text style={s.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Filter panel */}
      {showFilters && (
        <View style={s.filterPanel}>
          <View style={s.filterSection}>
            <Text style={s.filterLabel}>Categoria</Text>
            <View style={s.chipRow}>
              {CATEGORY_OPTIONS.map((c) => {
                const active = filters.categories.includes(c);
                return (
                  <TouchableOpacity
                    key={c}
                    style={[s.filterChip, active && s.filterChipActive]}
                    onPress={() => setFilters((f) => ({ ...f, categories: toggleInArray(f.categories, c) }))}
                  >
                    <Text style={[s.filterChipText, active && s.filterChipTextActive]}>{c}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={s.filterSection}>
            <Text style={s.filterLabel}>Sexo</Text>
            <View style={s.chipRow}>
              {SEX_OPTIONS.map((o) => {
                const active = filters.sexes.includes(o);
                return (
                  <TouchableOpacity
                    key={o}
                    style={[s.filterChip, active && s.filterChipActive]}
                    onPress={() => setFilters((f) => ({ ...f, sexes: toggleInArray(f.sexes, o) }))}
                  >
                    <Text style={[s.filterChipText, active && s.filterChipTextActive]}>{SEX_LABELS[o]}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={s.filterSection}>
            <Text style={s.filterLabel}>Desempenho</Text>
            <View style={s.chipRow}>
              {PERFORMANCE_OPTIONS.map((p) => {
                const active = filters.performances.includes(p);
                return (
                  <TouchableOpacity
                    key={p}
                    style={[s.filterChip, active && s.filterChipActive]}
                    onPress={() => setFilters((f) => ({ ...f, performances: toggleInArray(f.performances, p) }))}
                  >
                    <Text style={[s.filterChipText, active && s.filterChipTextActive]}>{ANIMAL_PERFORMANCE_LABEL[p]}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={s.filterSection}>
            <Text style={s.filterLabel}>Período (idade)</Text>
            <View style={s.chipRow}>
              {AGE_PERIOD_OPTIONS.map((p) => {
                const active = filters.agePeriods.includes(p);
                return (
                  <TouchableOpacity
                    key={p}
                    style={[s.filterChip, active && s.filterChipActive]}
                    onPress={() => setFilters((f) => ({ ...f, agePeriods: toggleInArray(f.agePeriods, p) }))}
                  >
                    <Text style={[s.filterChipText, active && s.filterChipTextActive]}>{AGE_PERIOD_SHORT[p]}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {activeFilterCount > 0 && (
            <TouchableOpacity style={s.clearFiltersBtn} onPress={clearFilters}>
              <Ionicons name="close-circle-outline" size={16} color={theme.colors.danger} />
              <Text style={s.clearFiltersText}>Limpar filtros</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Results count */}
      {(search || activeFilterCount > 0) && (
        <Text style={s.resultCount}>{filtered.length} animal(is) encontrado(s)</Text>
      )}

      {filtered.length === 0 ? (
        <EmptyState icon="🐂" title="Nenhum animal" subtitle="Toque no + para cadastrar" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ padding: 16, paddingTop: 0 }}
          onRefresh={refetch}
          refreshing={false}
          renderItem={({ item, index }) => {
            const age = calcAnimalAge(item);
            return (
              <Animated.View entering={FadeInDown.delay(Math.min(index, 10) * 60).springify().damping(16)}>
                <TouchableOpacity
                  style={s.card}
                  activeOpacity={0.85}
                  onPress={() => router.push(`/(app)/fazendas/${farmId}/animais/${item.id}`)}
                  onLongPress={() => setToDelete(item)}
                >
                  <View style={s.cardRow}>
                    <View style={s.avatar}>
                      <Ionicons name="paw" size={19} color={theme.colors.primary} />
                    </View>
                    <View style={s.cardContent}>
                      <View style={s.row}>
                        <Text style={s.name} numberOfLines={1}>{item.name || item.earTag || 'Sem nome'}</Text>
                        {item.performance && (
                          <View style={[s.perfBadge, { backgroundColor: PERF_BADGE_STYLES[item.performance as AnimalPerformance].bg }]}>
                            <Text style={[s.perfBadgeText, { color: PERF_BADGE_STYLES[item.performance as AnimalPerformance].text }]}>
                              {ANIMAL_PERFORMANCE_LABEL[item.performance as AnimalPerformance]}
                            </Text>
                          </View>
                        )}
                      </View>
                      <View style={s.row}>
                        {item.earTag && <Text style={s.meta}>#{item.earTag}</Text>}
                        {item.category && <Text style={s.meta}>{item.category}</Text>}
                        {item.sex && <Text style={s.meta}>{SEX_LABELS[item.sex]}</Text>}
                      </View>
                      <View style={s.row}>
                        {item.currentWeightKg != null && (
                          <View style={s.weightBadge}>
                            <Ionicons name="scale-outline" size={12} color={theme.colors.primary} />
                            <Text style={s.weightText}>{item.currentWeightKg} kg</Text>
                          </View>
                        )}
                        {age && (
                          <View style={s.ageBadge}>
                            <Ionicons name="calendar-outline" size={12} color={theme.colors.textMuted} />
                            <Text style={s.ageText}>{age.label}</Text>
                          </View>
                        )}
                        {item.breed && <Text style={s.breedBadge}>{item.breed}</Text>}
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#98A2B3" />
                  </View>
                </TouchableOpacity>
              </Animated.View>
            );
          }}
        />
      )}

      <Fab onPress={() => setShowForm(true)} />

      <Modal visible={showForm} animationType="slide" transparent>
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.modal}>
            <ScrollView>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: theme.colors.border, alignSelf: 'center', marginBottom: 14 }} />
              <Text style={s.modalTitle}>Novo Animal</Text>
              <Text style={s.label}>Brinco *</Text>
              <TextInput style={s.input} value={form.earTag} onChangeText={(v) => setForm({ ...form, earTag: v })} placeholder="Ex: 001" />
              <Text style={s.label}>Nome</Text>
              <TextInput style={s.input} value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} placeholder="Opcional" />
              <Text style={s.label}>Sexo</Text>
              <View style={s.chipRow}>
                {SEX_OPTIONS.map((o) => (
                  <TouchableOpacity key={o} style={[s.chip, form.sex === o && s.chipActive]} onPress={() => setForm({ ...form, sex: o })}>
                    <Text style={[s.chipText, form.sex === o && s.chipTextActive]}>{SEX_LABELS[o]}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={s.label}>Categoria</Text>
              <View style={s.chipRow}>
                {CATEGORY_OPTIONS.map((o) => (
                  <TouchableOpacity key={o} style={[s.chip, form.category === o && s.chipActive]} onPress={() => setForm({ ...form, category: o })}>
                    <Text style={[s.chipText, form.category === o && s.chipTextActive]}>{o}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={s.label}>Raca</Text>
              <TextInput style={s.input} value={form.breed} onChangeText={(v) => setForm({ ...form, breed: v })} placeholder="Ex: Nelore" />
              <DateInput label="Data de nascimento" value={form.birthDate} onChange={(v: string) => setForm({ ...form, birthDate: v })} placeholder="Opcional" />
              <Text style={s.label}>Peso (kg)</Text>
              <TextInput style={s.input} value={form.currentWeightKg} onChangeText={(v) => setForm({ ...form, currentWeightKg: v })} keyboardType="numeric" placeholder="Ex: 350" />
              <View style={s.modalActions}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => setShowForm(false)}>
                  <Text style={s.cancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.saveBtn} onPress={handleCreate} disabled={createAnimal.isPending}>
                  {createAnimal.isPending ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>Salvar</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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
  container: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  searchRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, gap: 8 },
  search: { flex: 1, backgroundColor: '#fff', borderRadius: 10, padding: 12, fontSize: 15, borderWidth: 1, borderColor: '#e0e0e0' },
  filterBtn: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#E7F3EB', justifyContent: 'center', alignItems: 'center' },
  filterBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: theme.colors.danger, borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  filterBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  filterPanel: { marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 8 },
  filterSection: { marginBottom: 12 },
  filterLabel: { fontSize: 13, fontWeight: '700', color: theme.colors.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#e0e0e0' },
  filterChipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  filterChipText: { fontSize: 12, color: '#555' },
  filterChipTextActive: { color: '#fff', fontWeight: '600' },
  clearFiltersBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', paddingVertical: 6 },
  clearFiltersText: { fontSize: 13, color: theme.colors.danger, fontWeight: '600' },
  resultCount: { fontSize: 13, color: theme.colors.textMuted, marginHorizontal: 16, marginBottom: 4 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: theme.colors.border, shadowColor: '#101828', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardContent: { flex: 1 },
  avatar: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#E7F3EB', justifyContent: 'center', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' },
  name: { fontSize: 16, fontWeight: '700', color: theme.colors.primary, flexShrink: 1 },
  perfBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  perfBadgeText: { fontSize: 11, fontWeight: '700' },
  meta: { fontSize: 13, color: '#666' },
  weightBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#E7F3EB', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  weightText: { fontSize: 12, fontWeight: '700', color: theme.colors.primary },
  ageBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ageText: { fontSize: 12, color: theme.colors.textMuted },
  breedBadge: { backgroundColor: '#e8f5e9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, fontSize: 12, color: '#2e7d32', overflow: 'hidden' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f0f0f0', borderWidth: 1, borderColor: '#e0e0e0' },
  chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipText: { fontSize: 13, color: '#555' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(16,24,40,0.55)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '85%' },
  modalTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3, color: theme.colors.primary, marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 4, marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 15, backgroundColor: '#fafafa' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20, marginBottom: 20 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: '#f0f0f0', alignItems: 'center' },
  cancelText: { fontSize: 15, fontWeight: '600', color: '#666' },
  saveBtn: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: theme.colors.primary, alignItems: 'center' },
  saveText: { fontSize: 15, fontWeight: '600', color: '#fff' },
});
