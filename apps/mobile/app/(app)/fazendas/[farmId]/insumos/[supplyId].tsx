import { useState } from 'react';
import { DateInput } from '../../../../../src/components/DateInput';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  Package,
  ArrowUpCircle,
  ArrowDownCircle,
  Trash2,
  Pencil,
  Plus,
  AlertTriangle,
  Clock,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../../../../src/lib/api';
import { theme } from '../../../../../src/lib/theme';
import type {
  Supply,
  SupplyMovement,
  SupplyMovementType,
  SupplyCategory,
} from '../../../../../src/lib/types';

const CATEGORIES: SupplyCategory[] = [
  'SAL_MINERAL',
  'RACAO',
  'FERTILIZANTE',
  'HERBICIDA',
  'DEFENSIVO',
  'OUTROS',
];

const CATEGORY_LABELS: Record<SupplyCategory, string> = {
  SAL_MINERAL: 'Sal mineral',
  RACAO: 'Ração',
  FERTILIZANTE: 'Fertilizante',
  HERBICIDA: 'Herbicida',
  DEFENSIVO: 'Defensivo',
  OUTROS: 'Outros',
};

const MOVEMENT_TYPES: SupplyMovementType[] = ['ENTRADA', 'SAIDA'];

const MOVEMENT_LABELS: Record<SupplyMovementType, string> = {
  ENTRADA: 'Entrada',
  SAIDA: 'Saída',
};

interface MovementForm {
  type: SupplyMovementType;
  quantity: string;
  notes: string;
  occurredAt: string;
}

interface EditForm {
  name: string;
  category: SupplyCategory;
  unit: string;
  currentQuantity: string;
  minimumQuantity: string;
  expirationDate: string;
  notes: string;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyMovementForm(): MovementForm {
  return { type: 'ENTRADA', quantity: '', notes: '', occurredAt: todayISO() };
}

function formatDate(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR');
}

export default function SupplyDetailScreen() {
  const { farmId, supplyId } = useLocalSearchParams<{ farmId: string; supplyId: string }>();
  const queryClient = useQueryClient();

  const { data: supply, isLoading, refetch } = useQuery({
    queryKey: ['supply', farmId, supplyId],
    queryFn: () => apiFetch<Supply>(`/fazendas/${farmId}/insumos/${supplyId}`),
    enabled: !!farmId && !!supplyId,
  });

  // Movement modal state
  const [showMovementForm, setShowMovementForm] = useState(false);
  const [movementForm, setMovementForm] = useState<MovementForm>(emptyMovementForm());

  const createMovement = useMutation({
    mutationFn: (body: any) =>
      apiFetch(`/fazendas/${farmId}/insumos/${supplyId}/movimentacoes`, {
        method: 'POST',
        body,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supply', farmId, supplyId] });
      queryClient.invalidateQueries({ queryKey: ['supplies', farmId] });
      setShowMovementForm(false);
      setMovementForm(emptyMovementForm());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (err: any) => Alert.alert('Erro', err.message),
  });

  const deleteMovement = useMutation({
    mutationFn: (movId: string) =>
      apiFetch(`/fazendas/${farmId}/insumos/${supplyId}/movimentacoes/${movId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supply', farmId, supplyId] });
      queryClient.invalidateQueries({ queryKey: ['supplies', farmId] });
    },
    onError: (err: any) => Alert.alert('Erro', err.message),
  });

  // Edit supply modal state
  const [showEditForm, setShowEditForm] = useState(false);
  const [editForm, setEditForm] = useState<EditForm | null>(null);

  const openEditForm = () => {
    if (!supply) return;
    setEditForm({
      name: supply.name,
      category: supply.category,
      unit: supply.unit,
      currentQuantity: String(supply.currentQuantity ?? ''),
      minimumQuantity: String(supply.minimumQuantity ?? ''),
      expirationDate: supply.expirationDate ? supply.expirationDate.slice(0, 10) : '',
      notes: supply.notes ?? '',
    });
    setShowEditForm(true);
  };

  const updateSupply = useMutation({
    mutationFn: (body: any) =>
      apiFetch(`/fazendas/${farmId}/insumos/${supplyId}`, { method: 'PATCH', body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supply', farmId, supplyId] });
      queryClient.invalidateQueries({ queryKey: ['supplies', farmId] });
      setShowEditForm(false);
      setEditForm(null);
    },
    onError: (err: any) => Alert.alert('Erro', err.message),
  });

  const deleteSupply = useMutation({
    mutationFn: () => apiFetch(`/fazendas/${farmId}/insumos/${supplyId}`, { method: 'DELETE' }),
    onSuccess: () => router.back(),
    onError: (err: any) => Alert.alert('Erro', err.message),
  });

  if (isLoading || !supply) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiration = supply.expirationDate ? new Date(supply.expirationDate) : null;
  const isExpired = !!expiration && expiration.getTime() < today.getTime();
  const daysToExpire = expiration
    ? Math.ceil((expiration.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const isExpiringSoon = !isExpired && daysToExpire !== null && daysToExpire <= 30;
  const isLowStock = supply.currentQuantity <= supply.minimumQuantity;

  const progressRatio = supply.minimumQuantity > 0
    ? Math.min(supply.currentQuantity / (supply.minimumQuantity * 2), 1)
    : supply.currentQuantity > 0
      ? 1
      : 0;

  const movements = [...(supply.movements ?? [])].sort(
    (a: SupplyMovement, b: SupplyMovement) =>
      new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );

  const handleDeleteSupply = () => {
    Alert.alert('Excluir insumo?', `Deseja excluir "${supply.name}"? Essa ação não pode ser desfeita.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => deleteSupply.mutate() },
    ]);
  };

  const handleDeleteMovement = (mov: SupplyMovement) => {
    Alert.alert('Excluir movimentação?', 'Essa ação não pode ser desfeita.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => deleteMovement.mutate(mov.id) },
    ]);
  };

  const handleSaveMovement = () => {
    const qty = Number(movementForm.quantity.replace(',', '.'));
    if (!qty || qty <= 0) {
      Alert.alert('Erro', 'Informe uma quantidade válida.');
      return;
    }
    createMovement.mutate({
      type: movementForm.type,
      quantity: qty,
      notes: movementForm.notes || undefined,
      occurredAt: movementForm.occurredAt || todayISO(),
    });
  };

  const handleSaveEdit = () => {
    if (!editForm) return;
    if (!editForm.name.trim()) {
      Alert.alert('Erro', 'Nome é obrigatório.');
      return;
    }
    const currentQuantity = Number(editForm.currentQuantity.replace(',', '.'));
    const minimumQuantity = Number(editForm.minimumQuantity.replace(',', '.'));
    updateSupply.mutate({
      name: editForm.name.trim(),
      category: editForm.category,
      unit: editForm.unit.trim() || 'un',
      currentQuantity: Number.isFinite(currentQuantity) ? currentQuantity : undefined,
      minimumQuantity: Number.isFinite(minimumQuantity) ? minimumQuantity : undefined,
      expirationDate: editForm.expirationDate || null,
      notes: editForm.notes || null,
    });
  };

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      refreshControl={
        <RefreshControl refreshing={false} onRefresh={refetch} tintColor={theme.colors.primary} />
      }
    >
      {/* Header card */}
      <Animated.View entering={FadeInDown.delay(50).springify().damping(16)} style={s.headerCard}>
        <View style={s.headerTop}>
          <View style={s.headerIcon}>
            <Package size={26} color={theme.colors.primary} strokeWidth={1.8} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.supplyName}>{supply.name}</Text>
            <View style={s.tagsRow}>
              <View style={s.tag}>
                <Text style={s.tagText}>
                  {supply.category === 'OUTROS' && supply.customCategory
                    ? supply.customCategory
                    : CATEGORY_LABELS[supply.category as SupplyCategory] ?? supply.category}
                </Text>
              </View>
              <View style={s.tag}>
                <Text style={s.tagText}>{supply.unit}</Text>
              </View>
            </View>
          </View>
          <View style={s.headerActions}>
            <TouchableOpacity style={s.iconBtn} onPress={openEditForm}>
              <Pencil size={16} color={theme.colors.primary} strokeWidth={2} />
            </TouchableOpacity>
            <TouchableOpacity style={s.iconBtn} onPress={handleDeleteSupply}>
              <Trash2 size={16} color={theme.colors.danger} strokeWidth={2} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.quantityBlock}>
          <Text style={s.quantityValue}>
            {supply.currentQuantity}
            <Text style={s.quantityUnit}> {supply.unit}</Text>
          </Text>
          <Text style={s.quantityMin}>Mínimo: {supply.minimumQuantity} {supply.unit}</Text>
        </View>

        <View style={s.progressTrack}>
          <View
            style={[
              s.progressFill,
              {
                width: `${Math.round(progressRatio * 100)}%`,
                backgroundColor: isLowStock ? theme.colors.warning : theme.colors.success,
              },
            ]}
          />
        </View>

        {(isLowStock || isExpired || isExpiringSoon) && (
          <View style={s.alertsRow}>
            {isLowStock && (
              <View style={[s.alertBadge, { backgroundColor: '#FEF3E2' }]}>
                <AlertTriangle size={13} color={theme.colors.warning} strokeWidth={2} />
                <Text style={[s.alertText, { color: theme.colors.warning }]}>Estoque baixo</Text>
              </View>
            )}
            {isExpired && (
              <View style={[s.alertBadge, { backgroundColor: '#FEF3F2' }]}>
                <AlertTriangle size={13} color={theme.colors.danger} strokeWidth={2} />
                <Text style={[s.alertText, { color: theme.colors.danger }]}>Vencido</Text>
              </View>
            )}
            {isExpiringSoon && (
              <View style={[s.alertBadge, { backgroundColor: '#FEF3E2' }]}>
                <Clock size={13} color={theme.colors.warning} strokeWidth={2} />
                <Text style={[s.alertText, { color: theme.colors.warning }]}>
                  Vence em {daysToExpire} dia{daysToExpire === 1 ? '' : 's'}
                </Text>
              </View>
            )}
          </View>
        )}

        {supply.expirationDate && (
          <Text style={s.expirationText}>Validade: {formatDate(supply.expirationDate)}</Text>
        )}
        {supply.notes ? <Text style={s.notesText}>{supply.notes}</Text> : null}
      </Animated.View>

      {/* Movement history */}
      <Animated.View entering={FadeInDown.delay(100).springify().damping(16)} style={s.section}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Movimentações</Text>
          <TouchableOpacity
            style={s.addBtn}
            onPress={() => {
              setMovementForm(emptyMovementForm());
              setShowMovementForm(true);
            }}
          >
            <Plus size={14} color="#fff" strokeWidth={2.5} />
            <Text style={s.addBtnText}>Nova</Text>
          </TouchableOpacity>
        </View>

        {movements.length === 0 ? (
          <Text style={s.emptyText}>Nenhuma movimentação registrada.</Text>
        ) : (
          movements.map((mov: SupplyMovement, index: number) => (
            <Animated.View
              key={mov.id}
              entering={FadeInDown.delay(Math.min(index, 10) * 40).springify().damping(16)}
              style={s.movementRow}
            >
              <View
                style={[
                  s.movementIcon,
                  {
                    backgroundColor: mov.type === 'ENTRADA' ? '#ECFDF3' : '#FEF3F2',
                  },
                ]}
              >
                {mov.type === 'ENTRADA' ? (
                  <ArrowUpCircle size={18} color={theme.colors.success} strokeWidth={2} />
                ) : (
                  <ArrowDownCircle size={18} color={theme.colors.danger} strokeWidth={2} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <View style={s.movementTopRow}>
                  <Text style={s.movementType}>
                    {MOVEMENT_LABELS[mov.type]}{' '}
                    <Text
                      style={{
                        color: mov.type === 'ENTRADA' ? theme.colors.success : theme.colors.danger,
                      }}
                    >
                      {mov.type === 'ENTRADA' ? '+' : '-'}
                      {mov.quantity} {supply.unit}
                    </Text>
                  </Text>
                  <Text style={s.movementDate}>{formatDate(mov.occurredAt)}</Text>
                </View>
                {mov.notes ? <Text style={s.movementNotes}>{mov.notes}</Text> : null}
              </View>
              <TouchableOpacity style={s.deleteMovBtn} onPress={() => handleDeleteMovement(mov)}>
                <Ionicons name="trash-outline" size={16} color={theme.colors.textFaint} />
              </TouchableOpacity>
            </Animated.View>
          ))
        )}
      </Animated.View>

      {/* Add movement modal */}
      <Modal visible={showMovementForm} animationType="slide" transparent>
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.modal}>
            <ScrollView>
              <View style={s.modalHandle} />
              <Text style={s.modalTitle}>Nova movimentação</Text>

              <Text style={s.label}>Tipo</Text>
              <View style={s.chipRow}>
                {MOVEMENT_TYPES.map((t: SupplyMovementType) => (
                  <TouchableOpacity
                    key={t}
                    style={[s.chip, movementForm.type === t && s.chipActive]}
                    onPress={() => setMovementForm({ ...movementForm, type: t })}
                  >
                    <Text style={[s.chipText, movementForm.type === t && s.chipTextActive]}>
                      {MOVEMENT_LABELS[t]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.label}>Quantidade *</Text>
              <TextInput
                style={s.input}
                value={movementForm.quantity}
                onChangeText={(v) => setMovementForm({ ...movementForm, quantity: v })}
                keyboardType="numeric"
                placeholder={`Ex: 10 ${supply.unit}`}
              />

              <DateInput label="Data" value={movementForm.occurredAt} onChange={(v) => setMovementForm({ ...movementForm, occurredAt: v })} />

              <Text style={s.label}>Observações</Text>
              <TextInput
                style={[s.input, { minHeight: 70, textAlignVertical: 'top' }]}
                value={movementForm.notes}
                onChangeText={(v) => setMovementForm({ ...movementForm, notes: v })}
                placeholder="Opcional"
                multiline
              />

              <View style={s.modalActions}>
                <TouchableOpacity
                  style={s.cancelBtn}
                  onPress={() => {
                    setShowMovementForm(false);
                    setMovementForm(emptyMovementForm());
                  }}
                >
                  <Text style={s.cancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.saveBtn}
                  onPress={handleSaveMovement}
                  disabled={createMovement.isPending}
                >
                  {createMovement.isPending ? (
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

      {/* Edit supply modal */}
      <Modal visible={showEditForm} animationType="slide" transparent>
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.modal}>
            <ScrollView>
              <View style={s.modalHandle} />
              <Text style={s.modalTitle}>Editar insumo</Text>

              {editForm && (
                <>
                  <Text style={s.label}>Nome *</Text>
                  <TextInput
                    style={s.input}
                    value={editForm.name}
                    onChangeText={(v) => setEditForm({ ...editForm, name: v })}
                    placeholder="Ex: Sal mineral"
                  />

                  <Text style={s.label}>Categoria</Text>
                  <View style={s.chipRow}>
                    {CATEGORIES.map((c: SupplyCategory) => (
                      <TouchableOpacity
                        key={c}
                        style={[s.chip, editForm.category === c && s.chipActive]}
                        onPress={() => setEditForm({ ...editForm, category: c })}
                      >
                        <Text style={[s.chipText, editForm.category === c && s.chipTextActive]}>
                          {CATEGORY_LABELS[c]}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={s.label}>Unidade</Text>
                  <TextInput
                    style={s.input}
                    value={editForm.unit}
                    onChangeText={(v) => setEditForm({ ...editForm, unit: v })}
                    placeholder="Ex: kg, L, un"
                  />

                  <Text style={s.label}>Quantidade atual</Text>
                  <TextInput
                    style={s.input}
                    value={editForm.currentQuantity}
                    onChangeText={(v) => setEditForm({ ...editForm, currentQuantity: v })}
                    keyboardType="numeric"
                    placeholder="Ex: 100"
                  />

                  <Text style={s.label}>Quantidade mínima</Text>
                  <TextInput
                    style={s.input}
                    value={editForm.minimumQuantity}
                    onChangeText={(v) => setEditForm({ ...editForm, minimumQuantity: v })}
                    keyboardType="numeric"
                    placeholder="Ex: 20"
                  />

                  <DateInput label="Validade" value={editForm.expirationDate} onChange={(v) => setEditForm({ ...editForm, expirationDate: v })} />

                  <Text style={s.label}>Observações</Text>
                  <TextInput
                    style={[s.input, { minHeight: 70, textAlignVertical: 'top' }]}
                    value={editForm.notes}
                    onChangeText={(v) => setEditForm({ ...editForm, notes: v })}
                    placeholder="Opcional"
                    multiline
                  />

                  <View style={s.modalActions}>
                    <TouchableOpacity
                      style={s.cancelBtn}
                      onPress={() => {
                        setShowEditForm(false);
                        setEditForm(null);
                      }}
                    >
                      <Text style={s.cancelText}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={s.saveBtn}
                      onPress={handleSaveEdit}
                      disabled={updateSupply.isPending}
                    >
                      {updateSupply.isPending ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={s.saveText}>Salvar</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.bg },

  headerCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: 18,
    marginBottom: 16,
    ...theme.shadow.card,
  },
  headerTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.md,
    backgroundColor: '#ECFDF3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  supplyName: { fontSize: 19, fontWeight: '800', color: theme.colors.text, letterSpacing: -0.3 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  tag: {
    backgroundColor: theme.colors.bg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: { fontSize: 12, color: theme.colors.textMuted, fontWeight: '600' },
  headerActions: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: theme.colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },

  quantityBlock: { marginTop: 18 },
  quantityValue: { fontSize: 34, fontWeight: '800', color: theme.colors.text, letterSpacing: -0.5 },
  quantityUnit: { fontSize: 16, fontWeight: '600', color: theme.colors.textMuted },
  quantityMin: { fontSize: 13, color: theme.colors.textMuted, marginTop: 2 },

  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.bg,
    marginTop: 10,
    overflow: 'hidden',
  },
  progressFill: { height: 8, borderRadius: 4 },

  alertsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  alertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  alertText: { fontSize: 12, fontWeight: '700' },

  expirationText: { fontSize: 13, color: theme.colors.textMuted, marginTop: 12 },
  notesText: { fontSize: 13, color: theme.colors.textMuted, marginTop: 6, lineHeight: 18 },

  section: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: 16,
    marginBottom: 16,
    ...theme.shadow.card,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.text },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  emptyText: { fontSize: 13, color: theme.colors.textFaint, paddingVertical: 8 },

  movementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  movementIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  movementTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  movementType: { fontSize: 14, fontWeight: '600', color: theme.colors.text },
  movementDate: { fontSize: 12, color: theme.colors.textFaint },
  movementNotes: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  deleteMovBtn: { padding: 6 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(16,24,40,0.55)', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    padding: 24,
    maxHeight: '85%',
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
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
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
