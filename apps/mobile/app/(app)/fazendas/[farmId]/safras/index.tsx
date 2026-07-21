import { useMemo, useState } from 'react';
import { DateInput } from '../../../../../src/components/DateInput';
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
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { theme } from '../../../../../src/lib/theme';
import { apiFetch } from '../../../../../src/lib/api';
import { EmptyState } from '../../../../../src/components/EmptyState';
import type { CropCycle, CropCycleStatus, CropSaleUnit } from '../../../../../src/lib/types';

const STATUS_FILTERS: Array<{ key: 'TODOS' | CropCycleStatus; label: string }> = [
  { key: 'TODOS', label: 'Todos' },
  { key: 'PLANEJADA', label: 'Planejada' },
  { key: 'PLANTADA', label: 'Plantada' },
  { key: 'COLHIDA', label: 'Colhida' },
];

const STATUS_COLORS: Record<CropCycleStatus, string> = {
  PLANEJADA: theme.colors.info,
  PLANTADA: theme.colors.warning,
  COLHIDA: theme.colors.success,
};

const STATUS_LABELS: Record<CropCycleStatus, string> = {
  PLANEJADA: 'Planejada',
  PLANTADA: 'Plantada',
  COLHIDA: 'Colhida',
};

const SALE_UNITS: CropSaleUnit[] = ['SACA60', 'KG', 'ARROBA'];

const SALE_UNIT_LABELS: Record<CropSaleUnit, string> = {
  SACA60: 'Saca 60kg',
  KG: 'Kg',
  ARROBA: 'Arroba',
};

interface FormState {
  cropName: string;
  variety: string;
  areaHectares: string;
  plantedAt: string;
  expectedHarvestAt: string;
  yieldKg: string;
  salePricePerUnit: string;
  saleUnit: CropSaleUnit | null;
  notes: string;
}

const EMPTY_FORM: FormState = {
  cropName: '',
  variety: '',
  areaHectares: '',
  plantedAt: '',
  expectedHarvestAt: '',
  yieldKg: '',
  salePricePerUnit: '',
  saleUnit: null,
  notes: '',
};

function deriveStatus(crop: CropCycle): CropCycleStatus {
  if (crop.harvestedAt) return 'COLHIDA';
  const planted = new Date(crop.plantedAt);
  if (!Number.isNaN(planted.getTime()) && planted.getTime() <= Date.now()) return 'PLANTADA';
  return 'PLANEJADA';
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

function formatNumber(value: number | null, suffix = ''): string {
  if (value === null || value === undefined) return '—';
  return `${value.toLocaleString('pt-BR')}${suffix}`;
}

export default function CropCyclesScreen() {
  const { farmId } = useLocalSearchParams<{ farmId: string }>();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<'TODOS' | CropCycleStatus>('TODOS');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CropCycle | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['crop-cycles', farmId],
    queryFn: () => apiFetch<CropCycle[]>(`/fazendas/${farmId}/safras`),
    enabled: !!farmId,
  });

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditing(null);
  };

  const createCrop = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiFetch(`/fazendas/${farmId}/safras`, { method: 'POST', body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crop-cycles', farmId] });
      setShowForm(false);
      resetForm();
    },
    onError: (err: any) => Alert.alert('Erro', err.message ?? 'Não foi possível salvar a safra'),
  });

  const updateCrop = useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
      apiFetch(`/fazendas/${farmId}/safras/${id}`, { method: 'PATCH', body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crop-cycles', farmId] });
      setShowForm(false);
      resetForm();
    },
    onError: (err: any) => Alert.alert('Erro', err.message ?? 'Não foi possível atualizar a safra'),
  });

  const deleteCrop = useMutation({
    mutationFn: (id: string) => apiFetch(`/fazendas/${farmId}/safras/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['crop-cycles', farmId] }),
    onError: (err: any) => Alert.alert('Erro', err.message ?? 'Não foi possível excluir a safra'),
  });

  const crops = useMemo<CropCycle[]>(() => data ?? [], [data]);

  const filteredCrops = useMemo<CropCycle[]>(() => {
    if (statusFilter === 'TODOS') return crops;
    return crops.filter((c: CropCycle) => deriveStatus(c) === statusFilter);
  }, [crops, statusFilter]);

  const summary = useMemo(() => {
    const totalHectares = crops.reduce((acc: number, c: CropCycle) => acc + (c.areaHectares ?? 0), 0);
    const activeCount = crops.filter((c: CropCycle) => deriveStatus(c) !== 'COLHIDA').length;
    return { total: crops.length, totalHectares, activeCount };
  }, [crops]);

  const openCreate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    resetForm();
    setShowForm(true);
  };

  const openEdit = (crop: CropCycle) => {
    Haptics.selectionAsync().catch(() => {});
    setEditing(crop);
    setForm({
      cropName: crop.cropName,
      variety: crop.variety ?? '',
      areaHectares: crop.areaHectares !== null ? String(crop.areaHectares) : '',
      plantedAt: crop.plantedAt ? crop.plantedAt.slice(0, 10) : '',
      expectedHarvestAt: crop.expectedHarvestAt ? crop.expectedHarvestAt.slice(0, 10) : '',
      yieldKg: crop.yieldKg !== null ? String(crop.yieldKg) : '',
      salePricePerUnit: crop.salePricePerUnit !== null ? String(crop.salePricePerUnit) : '',
      saleUnit: crop.saleUnit,
      notes: crop.notes ?? '',
    });
    setShowForm(true);
  };

  const handleDelete = (crop: CropCycle) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    Alert.alert('Excluir safra?', `Deseja excluir "${crop.cropName}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => deleteCrop.mutate(crop.id) },
    ]);
  };

  const handleSave = () => {
    if (!form.cropName.trim()) {
      Alert.alert('Erro', 'Nome da cultura é obrigatório');
      return;
    }
    if (!form.plantedAt.trim()) {
      Alert.alert('Erro', 'Data de plantio é obrigatória');
      return;
    }
    const body: Record<string, unknown> = {
      cropName: form.cropName.trim(),
      variety: form.variety.trim() || undefined,
      areaHectares: form.areaHectares ? Number(form.areaHectares) : undefined,
      plantedAt: form.plantedAt.trim(),
      expectedHarvestAt: form.expectedHarvestAt.trim() || undefined,
      yieldKg: form.yieldKg ? Number(form.yieldKg) : undefined,
      salePricePerUnit: form.salePricePerUnit ? Number(form.salePricePerUnit) : undefined,
      saleUnit: form.saleUnit ?? undefined,
      notes: form.notes.trim() || undefined,
    };
    if (editing) {
      updateCrop.mutate({ id: editing.id, ...body });
    } else {
      createCrop.mutate(body);
    }
  };

  if (isLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={s.filterRow}>
        {STATUS_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[s.filterChip, statusFilter === f.key && s.filterChipActive]}
            onPress={() => setStatusFilter(f.key)}
          >
            <Text style={[s.filterChipText, statusFilter === f.key && s.filterChipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {crops.length > 0 && (
        <View style={s.summaryBanner}>
          <View style={s.summaryItem}>
            <Text style={s.summaryValue}>{summary.total}</Text>
            <Text style={s.summaryLabel}>Safras</Text>
          </View>
          <View style={s.summaryDivider} />
          <View style={s.summaryItem}>
            <Text style={s.summaryValue}>{summary.totalHectares.toLocaleString('pt-BR')}</Text>
            <Text style={s.summaryLabel}>Hectares</Text>
          </View>
          <View style={s.summaryDivider} />
          <View style={s.summaryItem}>
            <Text style={s.summaryValue}>{summary.activeCount}</Text>
            <Text style={s.summaryLabel}>Ativas</Text>
          </View>
        </View>
      )}

      {!filteredCrops.length ? (
        <EmptyState
          icon="🌾"
          title="Nenhuma safra"
          subtitle={statusFilter === 'TODOS' ? 'Toque no + para cadastrar uma safra' : 'Nenhuma safra com esse status'}
        />
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={filteredCrops}
          keyExtractor={(item: CropCycle) => item.id}
          contentContainerStyle={{ padding: 16 }}
          onRefresh={refetch}
          refreshing={isRefetching}
          renderItem={({ item, index }: { item: CropCycle; index: number }) => {
            const status = deriveStatus(item);
            const statusColor = STATUS_COLORS[status];
            return (
              <Animated.View entering={FadeInDown.delay(Math.min(index, 10) * 60).springify().damping(16)}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => router.push(`/(app)/fazendas/${farmId}/safras/${item.id}` as any)}
                  onLongPress={() => handleDelete(item)}
                >
                  <View style={s.card}>
                    <View style={s.cardHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.cropName}>{item.cropName}</Text>
                        {item.variety ? <Text style={s.variety}>{item.variety}</Text> : null}
                      </View>
                      <View style={[s.statusBadge, { backgroundColor: `${statusColor}1A` }]}>
                        <View style={[s.statusDot, { backgroundColor: statusColor }]} />
                        <Text style={[s.statusText, { color: statusColor }]}>{STATUS_LABELS[status]}</Text>
                      </View>
                    </View>

                    <View style={s.cardBody}>
                      <View style={s.infoItem}>
                        <Ionicons name="resize-outline" size={14} color={theme.colors.textMuted} />
                        <Text style={s.infoText}>{formatNumber(item.areaHectares, ' ha')}</Text>
                      </View>
                      <View style={s.infoItem}>
                        <Ionicons name="leaf-outline" size={14} color={theme.colors.textMuted} />
                        <Text style={s.infoText}>Plantio: {formatDate(item.plantedAt)}</Text>
                      </View>
                      {item.expectedHarvestAt ? (
                        <View style={s.infoItem}>
                          <Ionicons name="calendar-outline" size={14} color={theme.colors.textMuted} />
                          <Text style={s.infoText}>Colheita prevista: {formatDate(item.expectedHarvestAt)}</Text>
                        </View>
                      ) : null}
                      {item.yieldKg !== null ? (
                        <View style={s.infoItem}>
                          <Ionicons name="stats-chart-outline" size={14} color={theme.colors.textMuted} />
                          <Text style={s.infoText}>Produtividade: {formatNumber(item.yieldKg, ' kg')}</Text>
                        </View>
                      ) : null}
                    </View>

                    <TouchableOpacity style={s.editBtn} onPress={() => openEdit(item)} hitSlop={8}>
                      <Ionicons name="create-outline" size={16} color={theme.colors.primary} />
                      <Text style={s.editBtnText}>Editar</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            );
          }}
        />
      )}

      <TouchableOpacity style={s.fab} onPress={openCreate} activeOpacity={0.85}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <Modal visible={showForm} animationType="slide" transparent>
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.modal}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={s.modalHandle} />
              <Text style={s.modalTitle}>{editing ? 'Editar Safra' : 'Nova Safra'}</Text>

              <Text style={s.label}>Cultura *</Text>
              <TextInput
                style={s.input}
                value={form.cropName}
                onChangeText={(v: string) => setForm({ ...form, cropName: v })}
                placeholder="Ex: Soja, Milho, Café"
                placeholderTextColor={theme.colors.textFaint}
              />

              <Text style={s.label}>Variedade</Text>
              <TextInput
                style={s.input}
                value={form.variety}
                onChangeText={(v: string) => setForm({ ...form, variety: v })}
                placeholder="Ex: TMG 7062"
                placeholderTextColor={theme.colors.textFaint}
              />

              <Text style={s.label}>Área (hectares)</Text>
              <TextInput
                style={s.input}
                value={form.areaHectares}
                onChangeText={(v: string) => setForm({ ...form, areaHectares: v })}
                keyboardType="numeric"
                placeholder="Ex: 25.5"
                placeholderTextColor={theme.colors.textFaint}
              />

              <DateInput label="Data de plantio *" value={form.plantedAt} onChange={(v: string) => setForm({ ...form, plantedAt: v })} />

              <DateInput label="Colheita prevista" value={form.expectedHarvestAt} onChange={(v: string) => setForm({ ...form, expectedHarvestAt: v })} />

              <Text style={s.label}>Produtividade (kg)</Text>
              <TextInput
                style={s.input}
                value={form.yieldKg}
                onChangeText={(v: string) => setForm({ ...form, yieldKg: v })}
                keyboardType="numeric"
                placeholder="Ex: 45000"
                placeholderTextColor={theme.colors.textFaint}
              />

              <Text style={s.label}>Preço de venda (por unidade)</Text>
              <TextInput
                style={s.input}
                value={form.salePricePerUnit}
                onChangeText={(v: string) => setForm({ ...form, salePricePerUnit: v })}
                keyboardType="numeric"
                placeholder="Ex: 120.50"
                placeholderTextColor={theme.colors.textFaint}
              />

              <Text style={s.label}>Unidade de venda</Text>
              <View style={s.chipRow}>
                {SALE_UNITS.map((u: CropSaleUnit) => (
                  <TouchableOpacity
                    key={u}
                    style={[s.chip, form.saleUnit === u && s.chipActive]}
                    onPress={() => setForm({ ...form, saleUnit: form.saleUnit === u ? null : u })}
                  >
                    <Text style={[s.chipText, form.saleUnit === u && s.chipTextActive]}>{SALE_UNIT_LABELS[u]}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.label}>Observações</Text>
              <TextInput
                style={[s.input, s.textArea]}
                value={form.notes}
                onChangeText={(v: string) => setForm({ ...form, notes: v })}
                placeholder="Anotações sobre a safra"
                placeholderTextColor={theme.colors.textFaint}
                multiline
                numberOfLines={4}
              />

              <View style={s.modalActions}>
                <TouchableOpacity
                  style={s.cancelBtn}
                  onPress={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                >
                  <Text style={s.cancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.saveBtn}
                  onPress={handleSave}
                  disabled={createCrop.isPending || updateCrop.isPending}
                >
                  {createCrop.isPending || updateCrop.isPending ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={s.saveText}>Salvar</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filterChipText: { fontSize: 13, fontWeight: '600', color: theme.colors.textMuted },
  filterChipTextActive: { color: '#fff' },

  summaryBanner: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 14,
    ...theme.shadow.card,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 1, backgroundColor: theme.colors.border },
  summaryValue: { fontSize: 18, fontWeight: '800', color: theme.colors.primary },
  summaryLabel: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },

  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  cropName: { fontSize: 16, fontWeight: '700', color: theme.colors.text },
  variety: { fontSize: 13, color: theme.colors.textMuted, marginTop: 2 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.lg,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: '700' },

  cardBody: { gap: 6 },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoText: { fontSize: 13, color: theme.colors.textMuted },

  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: theme.radius.sm,
    backgroundColor: `${theme.colors.primary}14`,
  },
  editBtnText: { fontSize: 12, fontWeight: '700', color: theme.colors.primary },

  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadow.fab,
  },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(16,24,40,0.55)', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    padding: 24,
    maxHeight: '88%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    alignSelf: 'center',
    marginBottom: 14,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3, color: theme.colors.primary, marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: theme.colors.textMuted, marginBottom: 4, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    padding: 12,
    fontSize: 15,
    backgroundColor: theme.colors.bg,
    color: theme.colors.text,
  },
  textArea: { minHeight: 90, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.bg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipText: { fontSize: 13, color: theme.colors.textMuted },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20, marginBottom: 20 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: theme.radius.sm, backgroundColor: theme.colors.bg, alignItems: 'center' },
  cancelText: { fontSize: 15, fontWeight: '600', color: theme.colors.textMuted },
  saveBtn: { flex: 1, padding: 14, borderRadius: theme.radius.sm, backgroundColor: theme.colors.primary, alignItems: 'center' },
  saveText: { fontSize: 15, fontWeight: '600', color: '#fff' },
});
