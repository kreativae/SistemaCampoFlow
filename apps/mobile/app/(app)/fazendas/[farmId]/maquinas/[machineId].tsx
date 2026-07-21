import { useState } from 'react';
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { theme } from '../../../../../src/lib/theme';
import { apiFetch } from '../../../../../src/lib/api';
import type { Machine, MachineType, MachineMaintenance, MachineFuelRecord } from '../../../../../src/lib/types';

const TYPES: MachineType[] = ['TRATOR', 'CAMINHAO', 'IMPLEMENTO', 'OUTRO'];
const TYPE_LABELS: Record<MachineType, string> = {
  TRATOR: 'Trator',
  CAMINHAO: 'Caminhão',
  IMPLEMENTO: 'Implemento',
  OUTRO: 'Outro',
};
const TYPE_ICONS: Record<MachineType, keyof typeof Ionicons.glyphMap> = {
  TRATOR: 'construct',
  CAMINHAO: 'bus',
  IMPLEMENTO: 'hammer',
  OUTRO: 'cog',
};

function formatBRL(value: number | null | undefined): string {
  return (value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR');
}

function toISODate(dateStr: string): string {
  // dateStr expected as DD/MM/AAAA, converts to ISO for API
  const parts = dateStr.split('/');
  if (parts.length !== 3) return new Date().toISOString();
  const [day, month, year] = parts;
  return new Date(Number(year), Number(month) - 1, Number(day)).toISOString();
}

function todayBR(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

interface MaintenanceForm {
  description: string;
  cost: string;
  hourMeterAt: string;
  performedAt: string;
  notes: string;
}

interface FuelForm {
  liters: string;
  cost: string;
  hourMeterAt: string;
  recordedAt: string;
  notes: string;
}

interface MachineForm {
  name: string;
  type: MachineType;
  brand: string;
  model: string;
  year: string;
  currentHourMeter: string;
  notes: string;
}

export default function MachineDetailScreen() {
  const { farmId, machineId } = useLocalSearchParams<{ farmId: string; machineId: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const [showEdit, setShowEdit] = useState(false);
  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false);
  const [showFuelForm, setShowFuelForm] = useState(false);

  const [editForm, setEditForm] = useState<MachineForm>({
    name: '',
    type: 'TRATOR',
    brand: '',
    model: '',
    year: '',
    currentHourMeter: '',
    notes: '',
  });

  const [maintenanceForm, setMaintenanceForm] = useState<MaintenanceForm>({
    description: '',
    cost: '',
    hourMeterAt: '',
    performedAt: todayBR(),
    notes: '',
  });

  const [fuelForm, setFuelForm] = useState<FuelForm>({
    liters: '',
    cost: '',
    hourMeterAt: '',
    recordedAt: todayBR(),
    notes: '',
  });

  const {
    data: machine,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['machine', farmId, machineId],
    queryFn: () => apiFetch<Machine>(`/fazendas/${farmId}/maquinas/${machineId}`),
    enabled: !!farmId && !!machineId,
  });

  const openEdit = () => {
    if (!machine) return;
    setEditForm({
      name: machine.name,
      type: machine.type,
      brand: machine.brand ?? '',
      model: machine.model ?? '',
      year: machine.year ? String(machine.year) : '',
      currentHourMeter: String(machine.currentHourMeter ?? ''),
      notes: machine.notes ?? '',
    });
    setShowEdit(true);
  };

  const updateMachine = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch(`/fazendas/${farmId}/maquinas/${machineId}`, { method: 'PATCH', body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['machine', farmId, machineId] });
      qc.invalidateQueries({ queryKey: ['machines', farmId] });
      setShowEdit(false);
    },
    onError: (err: any) => Alert.alert('Erro', err.message),
  });

  const deleteMachine = useMutation({
    mutationFn: () => apiFetch(`/fazendas/${farmId}/maquinas/${machineId}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['machines', farmId] });
      router.back();
    },
    onError: (err: any) => Alert.alert('Erro', err.message),
  });

  const createMaintenance = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch(`/fazendas/${farmId}/maquinas/${machineId}/manutencoes`, { method: 'POST', body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['machine', farmId, machineId] });
      setShowMaintenanceForm(false);
      setMaintenanceForm({ description: '', cost: '', hourMeterAt: '', performedAt: todayBR(), notes: '' });
    },
    onError: (err: any) => Alert.alert('Erro', err.message),
  });

  const deleteMaintenance = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/fazendas/${farmId}/maquinas/${machineId}/manutencoes/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['machine', farmId, machineId] }),
    onError: (err: any) => Alert.alert('Erro', err.message),
  });

  const createFuelRecord = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch(`/fazendas/${farmId}/maquinas/${machineId}/registros-combustivel`, { method: 'POST', body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['machine', farmId, machineId] });
      setShowFuelForm(false);
      setFuelForm({ liters: '', cost: '', hourMeterAt: '', recordedAt: todayBR(), notes: '' });
    },
    onError: (err: any) => Alert.alert('Erro', err.message),
  });

  const deleteFuelRecord = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/fazendas/${farmId}/maquinas/${machineId}/registros-combustivel/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['machine', farmId, machineId] }),
    onError: (err: any) => Alert.alert('Erro', err.message),
  });

  const handleDeleteMachine = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Excluir máquina?', `Deseja excluir "${machine?.name}"? Essa ação não pode ser desfeita.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => deleteMachine.mutate() },
    ]);
  };

  const handleSaveEdit = () => {
    if (!editForm.name.trim()) {
      Alert.alert('Erro', 'Nome é obrigatório');
      return;
    }
    updateMachine.mutate({
      name: editForm.name.trim(),
      type: editForm.type,
      brand: editForm.brand.trim() || null,
      model: editForm.model.trim() || null,
      year: editForm.year ? Number(editForm.year) : null,
      currentHourMeter: editForm.currentHourMeter ? Number(editForm.currentHourMeter) : 0,
      notes: editForm.notes.trim() || null,
    });
  };

  const handleSaveMaintenance = () => {
    if (!maintenanceForm.description.trim()) {
      Alert.alert('Erro', 'Descrição é obrigatória');
      return;
    }
    createMaintenance.mutate({
      description: maintenanceForm.description.trim(),
      cost: maintenanceForm.cost ? Number(maintenanceForm.cost) : null,
      hourMeterAt: maintenanceForm.hourMeterAt ? Number(maintenanceForm.hourMeterAt) : null,
      performedAt: toISODate(maintenanceForm.performedAt),
      notes: maintenanceForm.notes.trim() || null,
    });
  };

  const handleSaveFuel = () => {
    if (!fuelForm.liters) {
      Alert.alert('Erro', 'Litros é obrigatório');
      return;
    }
    createFuelRecord.mutate({
      liters: Number(fuelForm.liters),
      cost: fuelForm.cost ? Number(fuelForm.cost) : null,
      hourMeterAt: fuelForm.hourMeterAt ? Number(fuelForm.hourMeterAt) : null,
      recordedAt: toISODate(fuelForm.recordedAt),
      notes: fuelForm.notes.trim() || null,
    });
  };

  const handleDeleteMaintenance = (item: MachineMaintenance) => {
    Alert.alert('Excluir manutenção?', item.description, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => deleteMaintenance.mutate(item.id) },
    ]);
  };

  const handleDeleteFuelRecord = (item: MachineFuelRecord) => {
    Alert.alert('Excluir registro?', `${item.liters} L`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => deleteFuelRecord.mutate(item.id) },
    ]);
  };

  if (isLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!machine) {
    return (
      <View style={s.center}>
        <Text style={s.emptyText}>Máquina não encontrada</Text>
      </View>
    );
  }

  const maintenances = machine.maintenances ?? [];
  const fuelRecords = machine.fuelRecords ?? [];

  const maintenanceCost = maintenances.reduce(
    (sum: number, m: MachineMaintenance) => sum + (m.cost ?? 0),
    0,
  );
  const fuelCost = fuelRecords.reduce((sum: number, f: MachineFuelRecord) => sum + (f.cost ?? 0), 0);
  const totalLiters = fuelRecords.reduce((sum: number, f: MachineFuelRecord) => sum + (f.liters ?? 0), 0);
  const totalCost = maintenanceCost + fuelCost;

  return (
    <View style={s.container}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.primary} />}
      >
        {/* Header card */}
        <Animated.View entering={FadeInDown.springify().damping(16)}>
          <View style={s.headerCard}>
            <View style={s.headerTop}>
              <View style={s.avatar}>
                <Ionicons name={TYPE_ICONS[machine.type as MachineType]} size={26} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.machineName}>{machine.name}</Text>
                <View style={s.typeBadge}>
                  <Text style={s.typeBadgeText}>{TYPE_LABELS[machine.type as MachineType]}</Text>
                </View>
              </View>
              <TouchableOpacity style={s.iconBtn} onPress={openEdit}>
                <Ionicons name="pencil" size={18} color={theme.colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity style={s.iconBtn} onPress={handleDeleteMachine}>
                <Ionicons name="trash" size={18} color={theme.colors.danger} />
              </TouchableOpacity>
            </View>

            <View style={s.infoRow}>
              {!!machine.brand && (
                <View style={s.infoItem}>
                  <Text style={s.infoLabel}>Marca</Text>
                  <Text style={s.infoValue}>{machine.brand}</Text>
                </View>
              )}
              {!!machine.model && (
                <View style={s.infoItem}>
                  <Text style={s.infoLabel}>Modelo</Text>
                  <Text style={s.infoValue}>{machine.model}</Text>
                </View>
              )}
              {!!machine.year && (
                <View style={s.infoItem}>
                  <Text style={s.infoLabel}>Ano</Text>
                  <Text style={s.infoValue}>{machine.year}</Text>
                </View>
              )}
            </View>

            <View style={s.hourMeterBox}>
              <Text style={s.hourMeterLabel}>Horímetro atual</Text>
              <Text style={s.hourMeterValue}>{machine.currentHourMeter} h</Text>
            </View>

            {!!machine.notes && (
              <View style={s.notesBox}>
                <Text style={s.notesText}>{machine.notes}</Text>
              </View>
            )}
          </View>
        </Animated.View>

        {/* Cost summary */}
        <Animated.View entering={FadeInDown.delay(60).springify().damping(16)}>
          <View style={s.card}>
            <Text style={s.sectionTitle}>Resumo de custos</Text>
            <View style={s.summaryGrid}>
              <View style={s.summaryItem}>
                <Text style={s.summaryLabel}>Manutenção</Text>
                <Text style={s.summaryValue}>{formatBRL(maintenanceCost)}</Text>
              </View>
              <View style={s.summaryItem}>
                <Text style={s.summaryLabel}>Combustível</Text>
                <Text style={s.summaryValue}>{formatBRL(fuelCost)}</Text>
              </View>
              <View style={s.summaryItem}>
                <Text style={s.summaryLabel}>Litros totais</Text>
                <Text style={s.summaryValue}>{totalLiters.toLocaleString('pt-BR')} L</Text>
              </View>
              <View style={s.summaryItem}>
                <Text style={s.summaryLabel}>Custo total</Text>
                <Text style={[s.summaryValue, { color: theme.colors.primary }]}>{formatBRL(totalCost)}</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Maintenance log */}
        <Animated.View entering={FadeInDown.delay(120).springify().damping(16)}>
          <View style={s.card}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Manutenções</Text>
              <TouchableOpacity
                style={s.addBtn}
                onPress={() => {
                  setMaintenanceForm({ description: '', cost: '', hourMeterAt: '', performedAt: todayBR(), notes: '' });
                  setShowMaintenanceForm(true);
                }}
              >
                <Ionicons name="add" size={18} color={theme.colors.primary} />
                <Text style={s.addBtnText}>Adicionar</Text>
              </TouchableOpacity>
            </View>

            {maintenances.length === 0 ? (
              <Text style={s.emptyHint}>Nenhuma manutenção registrada</Text>
            ) : (
              maintenances.map((item: MachineMaintenance) => (
                <TouchableOpacity
                  key={item.id}
                  style={s.logItem}
                  activeOpacity={0.7}
                  onLongPress={() => handleDeleteMaintenance(item)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.logTitle}>{item.description}</Text>
                    <View style={s.logMetaRow}>
                      <Text style={s.logMeta}>{formatDate(item.performedAt)}</Text>
                      {item.hourMeterAt != null && <Text style={s.logMeta}>• {item.hourMeterAt} h</Text>}
                    </View>
                    {!!item.notes && <Text style={s.logNotes}>{item.notes}</Text>}
                  </View>
                  <Text style={s.logCost}>{formatBRL(item.cost)}</Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        </Animated.View>

        {/* Fuel records */}
        <Animated.View entering={FadeInDown.delay(180).springify().damping(16)}>
          <View style={s.card}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Abastecimentos</Text>
              <TouchableOpacity
                style={s.addBtn}
                onPress={() => {
                  setFuelForm({ liters: '', cost: '', hourMeterAt: '', recordedAt: todayBR(), notes: '' });
                  setShowFuelForm(true);
                }}
              >
                <Ionicons name="add" size={18} color={theme.colors.primary} />
                <Text style={s.addBtnText}>Adicionar</Text>
              </TouchableOpacity>
            </View>

            {fuelRecords.length === 0 ? (
              <Text style={s.emptyHint}>Nenhum abastecimento registrado</Text>
            ) : (
              fuelRecords.map((item: MachineFuelRecord) => (
                <TouchableOpacity
                  key={item.id}
                  style={s.logItem}
                  activeOpacity={0.7}
                  onLongPress={() => handleDeleteFuelRecord(item)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.logTitle}>{item.liters} L</Text>
                    <View style={s.logMetaRow}>
                      <Text style={s.logMeta}>{formatDate(item.recordedAt)}</Text>
                      {item.hourMeterAt != null && <Text style={s.logMeta}>• {item.hourMeterAt} h</Text>}
                    </View>
                    {!!item.notes && <Text style={s.logNotes}>{item.notes}</Text>}
                  </View>
                  <Text style={s.logCost}>{formatBRL(item.cost)}</Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        </Animated.View>
      </ScrollView>

      {/* Edit machine modal */}
      <Modal visible={showEdit} animationType="slide" transparent>
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.modal}>
            <ScrollView>
              <View style={s.modalHandle} />
              <Text style={s.modalTitle}>Editar máquina</Text>

              <Text style={s.label}>Nome *</Text>
              <TextInput
                style={s.input}
                value={editForm.name}
                onChangeText={(v) => setEditForm({ ...editForm, name: v })}
                placeholder="Ex: Trator John Deere"
              />

              <Text style={s.label}>Tipo</Text>
              <View style={s.chipRow}>
                {TYPES.map((t: MachineType) => (
                  <TouchableOpacity
                    key={t}
                    style={[s.chip, editForm.type === t && s.chipActive]}
                    onPress={() => setEditForm({ ...editForm, type: t })}
                  >
                    <Text style={[s.chipText, editForm.type === t && s.chipTextActive]}>{TYPE_LABELS[t]}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.label}>Marca</Text>
              <TextInput
                style={s.input}
                value={editForm.brand}
                onChangeText={(v) => setEditForm({ ...editForm, brand: v })}
                placeholder="Ex: John Deere"
              />

              <Text style={s.label}>Modelo</Text>
              <TextInput
                style={s.input}
                value={editForm.model}
                onChangeText={(v) => setEditForm({ ...editForm, model: v })}
                placeholder="Ex: 5075E"
              />

              <Text style={s.label}>Ano</Text>
              <TextInput
                style={s.input}
                value={editForm.year}
                onChangeText={(v) => setEditForm({ ...editForm, year: v })}
                keyboardType="numeric"
                placeholder="Ex: 2022"
              />

              <Text style={s.label}>Horímetro atual</Text>
              <TextInput
                style={s.input}
                value={editForm.currentHourMeter}
                onChangeText={(v) => setEditForm({ ...editForm, currentHourMeter: v })}
                keyboardType="numeric"
                placeholder="Ex: 1200"
              />

              <Text style={s.label}>Observações</Text>
              <TextInput
                style={[s.input, s.textArea]}
                value={editForm.notes}
                onChangeText={(v) => setEditForm({ ...editForm, notes: v })}
                placeholder="Observações adicionais"
                multiline
                numberOfLines={3}
              />

              <View style={s.modalActions}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => setShowEdit(false)}>
                  <Text style={s.cancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.saveBtn} onPress={handleSaveEdit} disabled={updateMachine.isPending}>
                  {updateMachine.isPending ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>Salvar</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add maintenance modal */}
      <Modal visible={showMaintenanceForm} animationType="slide" transparent>
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.modal}>
            <ScrollView>
              <View style={s.modalHandle} />
              <Text style={s.modalTitle}>Nova manutenção</Text>

              <Text style={s.label}>Descrição *</Text>
              <TextInput
                style={s.input}
                value={maintenanceForm.description}
                onChangeText={(v) => setMaintenanceForm({ ...maintenanceForm, description: v })}
                placeholder="Ex: Troca de óleo"
              />

              <Text style={s.label}>Custo (R$)</Text>
              <TextInput
                style={s.input}
                value={maintenanceForm.cost}
                onChangeText={(v) => setMaintenanceForm({ ...maintenanceForm, cost: v })}
                keyboardType="numeric"
                placeholder="Ex: 350,00"
              />

              <Text style={s.label}>Horímetro</Text>
              <TextInput
                style={s.input}
                value={maintenanceForm.hourMeterAt}
                onChangeText={(v) => setMaintenanceForm({ ...maintenanceForm, hourMeterAt: v })}
                keyboardType="numeric"
                placeholder="Ex: 1200"
              />

              <Text style={s.label}>Data (DD/MM/AAAA)</Text>
              <TextInput
                style={s.input}
                value={maintenanceForm.performedAt}
                onChangeText={(v) => setMaintenanceForm({ ...maintenanceForm, performedAt: v })}
                placeholder="DD/MM/AAAA"
              />

              <Text style={s.label}>Observações</Text>
              <TextInput
                style={[s.input, s.textArea]}
                value={maintenanceForm.notes}
                onChangeText={(v) => setMaintenanceForm({ ...maintenanceForm, notes: v })}
                placeholder="Observações adicionais"
                multiline
                numberOfLines={3}
              />

              <View style={s.modalActions}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => setShowMaintenanceForm(false)}>
                  <Text style={s.cancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.saveBtn} onPress={handleSaveMaintenance} disabled={createMaintenance.isPending}>
                  {createMaintenance.isPending ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>Salvar</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add fuel record modal */}
      <Modal visible={showFuelForm} animationType="slide" transparent>
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.modal}>
            <ScrollView>
              <View style={s.modalHandle} />
              <Text style={s.modalTitle}>Novo abastecimento</Text>

              <Text style={s.label}>Litros *</Text>
              <TextInput
                style={s.input}
                value={fuelForm.liters}
                onChangeText={(v) => setFuelForm({ ...fuelForm, liters: v })}
                keyboardType="numeric"
                placeholder="Ex: 80"
              />

              <Text style={s.label}>Custo (R$)</Text>
              <TextInput
                style={s.input}
                value={fuelForm.cost}
                onChangeText={(v) => setFuelForm({ ...fuelForm, cost: v })}
                keyboardType="numeric"
                placeholder="Ex: 480,00"
              />

              <Text style={s.label}>Horímetro</Text>
              <TextInput
                style={s.input}
                value={fuelForm.hourMeterAt}
                onChangeText={(v) => setFuelForm({ ...fuelForm, hourMeterAt: v })}
                keyboardType="numeric"
                placeholder="Ex: 1200"
              />

              <Text style={s.label}>Data (DD/MM/AAAA)</Text>
              <TextInput
                style={s.input}
                value={fuelForm.recordedAt}
                onChangeText={(v) => setFuelForm({ ...fuelForm, recordedAt: v })}
                placeholder="DD/MM/AAAA"
              />

              <Text style={s.label}>Observações</Text>
              <TextInput
                style={[s.input, s.textArea]}
                value={fuelForm.notes}
                onChangeText={(v) => setFuelForm({ ...fuelForm, notes: v })}
                placeholder="Observações adicionais"
                multiline
                numberOfLines={3}
              />

              <View style={s.modalActions}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => setShowFuelForm(false)}>
                  <Text style={s.cancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.saveBtn} onPress={handleSaveFuel} disabled={createFuelRecord.isPending}>
                  {createFuelRecord.isPending ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>Salvar</Text>}
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.bg },
  emptyText: { fontSize: 15, color: theme.colors.textMuted },

  headerCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: theme.radius.md,
    backgroundColor: '#EAF3EC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  machineName: { fontSize: 19, fontWeight: '800', color: theme.colors.text, marginBottom: 4 },
  typeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.primaryLight + '22',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
  },
  typeBadgeText: { fontSize: 12, fontWeight: '700', color: theme.colors.primary },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },

  infoRow: { flexDirection: 'row', gap: 20, marginTop: 16, flexWrap: 'wrap' },
  infoItem: { minWidth: 70 },
  infoLabel: { fontSize: 11, color: theme.colors.textFaint, marginBottom: 2, textTransform: 'uppercase', fontWeight: '600' },
  infoValue: { fontSize: 14, color: theme.colors.text, fontWeight: '600' },

  hourMeterBox: {
    marginTop: 16,
    backgroundColor: theme.colors.bg,
    borderRadius: theme.radius.md,
    padding: 14,
    alignItems: 'center',
  },
  hourMeterLabel: { fontSize: 12, color: theme.colors.textMuted, marginBottom: 4 },
  hourMeterValue: { fontSize: 28, fontWeight: '800', color: theme.colors.primary, letterSpacing: -0.5 },

  notesBox: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: theme.colors.border },
  notesText: { fontSize: 13, color: theme.colors.textMuted, lineHeight: 19 },

  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.text },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addBtnText: { fontSize: 13, fontWeight: '700', color: theme.colors.primary },

  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  summaryItem: { minWidth: '42%', flexGrow: 1 },
  summaryLabel: { fontSize: 12, color: theme.colors.textMuted, marginBottom: 4 },
  summaryValue: { fontSize: 17, fontWeight: '700', color: theme.colors.text },

  emptyHint: { fontSize: 13, color: theme.colors.textFaint, textAlign: 'center', paddingVertical: 12 },

  logItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    gap: 10,
  },
  logTitle: { fontSize: 14, fontWeight: '600', color: theme.colors.text },
  logMetaRow: { flexDirection: 'row', gap: 6, marginTop: 2 },
  logMeta: { fontSize: 12, color: theme.colors.textMuted },
  logNotes: { fontSize: 12, color: theme.colors.textFaint, marginTop: 4 },
  logCost: { fontSize: 14, fontWeight: '700', color: theme.colors.text },

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
  textArea: { minHeight: 70, textAlignVertical: 'top' },
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
