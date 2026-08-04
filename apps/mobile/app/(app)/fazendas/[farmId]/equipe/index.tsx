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
  Switch,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { theme } from '../../../../../src/lib/theme';
import { Fab } from '../../../../../src/components/UI';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../../../../src/lib/api';
import { toApiDate, todayInput } from '../../../../../src/lib/dates';
import { EmptyState } from '../../../../../src/components/EmptyState';
import type { Employee, EmployeeType, TimeEntry } from '../../../../../src/lib/types';

const TYPES: EmployeeType[] = ['EFETIVO', 'CHAPA', 'TEMPORARIO', 'OUTRO'];

const TYPE_LABELS: Record<EmployeeType, string> = {
  EFETIVO: 'Efetivo',
  CHAPA: 'Chapa',
  TEMPORARIO: 'Temporário',
  OUTRO: 'Outro',
};

const TYPE_COLORS: Record<EmployeeType, { bg: string; text: string }> = {
  EFETIVO: { bg: '#E7F3EB', text: theme.colors.primary },
  CHAPA: { bg: '#FEF0C7', text: '#B54708' },
  TEMPORARIO: { bg: '#E0F2FE', text: theme.colors.info },
  OUTRO: { bg: '#F2F4F7', text: theme.colors.textMuted },
};

interface EmployeeForm {
  name: string;
  type: EmployeeType;
  role: string;
  document: string;
  phone: string;
  hourlyRate: string;
  active: boolean;
  notes: string;
}

const emptyForm: EmployeeForm = {
  name: '',
  type: 'EFETIVO',
  role: '',
  document: '',
  phone: '',
  hourlyRate: '',
  active: true,
  notes: '',
};

interface TimeEntryForm {
  workDate: string;
  hours: string;
  description: string;
  paid: boolean;
}

const emptyTimeEntryForm: TimeEntryForm = {
  workDate: todayInput(),
  hours: '',
  description: '',
  paid: false,
};

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Datas de calendário: formatar em UTC evita mostrar o dia anterior e
// corrige os registros gravados à meia-noite antes da varredura de fuso.
function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

export default function TeamScreen() {
  const { farmId } = useLocalSearchParams<{ farmId: string }>();
  const queryClient = useQueryClient();

  const [typeFilter, setTypeFilter] = useState<EmployeeType | 'TODOS'>('TODOS');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState<EmployeeForm>(emptyForm);

  const [showEntryForm, setShowEntryForm] = useState(false);
  const [entryEmployeeId, setEntryEmployeeId] = useState<string | null>(null);
  const [entryForm, setEntryForm] = useState<TimeEntryForm>(emptyTimeEntryForm);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['employees', farmId],
    queryFn: () => apiFetch<Employee[]>(`/fazendas/${farmId}/funcionarios`),
    enabled: !!farmId,
  });

  const { data: expandedEmployee, isLoading: isLoadingDetail } = useQuery({
    queryKey: ['employee', farmId, expandedId],
    queryFn: () => apiFetch<Employee>(`/fazendas/${farmId}/funcionarios/${expandedId}`),
    enabled: !!farmId && !!expandedId,
  });

  const resetForm = () => {
    setForm(emptyForm);
    setEditing(null);
  };

  const createEmployee = useMutation({
    mutationFn: (body: unknown) => apiFetch(`/fazendas/${farmId}/funcionarios`, { method: 'POST', body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', farmId] });
      setShowForm(false);
      resetForm();
    },
    onError: (err: any) => Alert.alert('Erro', err.message ?? 'Não foi possível salvar o funcionário'),
  });

  const updateEmployee = useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
      apiFetch(`/fazendas/${farmId}/funcionarios/${id}`, { method: 'PATCH', body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', farmId] });
      queryClient.invalidateQueries({ queryKey: ['employee', farmId, editing?.id] });
      setShowForm(false);
      resetForm();
    },
    onError: (err: any) => Alert.alert('Erro', err.message ?? 'Não foi possível atualizar o funcionário'),
  });

  const deleteEmployee = useMutation({
    mutationFn: (id: string) => apiFetch(`/fazendas/${farmId}/funcionarios/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', farmId] });
      setExpandedId((current) => (current === null ? current : null));
    },
    onError: (err: any) => Alert.alert('Erro', err.message ?? 'Não foi possível excluir o funcionário'),
  });

  const createTimeEntry = useMutation({
    mutationFn: ({ employeeId, ...body }: { employeeId: string } & Record<string, unknown>) =>
      apiFetch(`/fazendas/${farmId}/funcionarios/${employeeId}/horas`, { method: 'POST', body }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['employees', farmId] });
      queryClient.invalidateQueries({ queryKey: ['employee', farmId, variables.employeeId] });
      setShowEntryForm(false);
      setEntryForm(emptyTimeEntryForm);
      setEntryEmployeeId(null);
    },
    onError: (err: any) => Alert.alert('Erro', err.message ?? 'Não foi possível lançar as horas'),
  });

  const deleteTimeEntry = useMutation({
    mutationFn: ({ employeeId, entryId }: { employeeId: string; entryId: string }) =>
      apiFetch(`/fazendas/${farmId}/funcionarios/${employeeId}/horas/${entryId}`, { method: 'DELETE' }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['employees', farmId] });
      queryClient.invalidateQueries({ queryKey: ['employee', farmId, variables.employeeId] });
    },
    onError: (err: any) => Alert.alert('Erro', err.message ?? 'Não foi possível excluir o lançamento'),
  });

  const summary = useMemo(() => {
    const list = data ?? [];
    return list.reduce(
      (acc: { employeeCount: number; activeCount: number; totalHours: number; totalCost: number }, e: Employee) => {
        acc.employeeCount += 1;
        if (e.active) acc.activeCount += 1;
        acc.totalHours += e.totalHours ?? 0;
        acc.totalCost += e.totalCost ?? 0;
        return acc;
      },
      { employeeCount: 0, activeCount: 0, totalHours: 0, totalCost: 0 },
    );
  }, [data]);

  const filtered = useMemo(() => {
    const list = data ?? [];
    if (typeFilter === 'TODOS') return list;
    return list.filter((e: Employee) => e.type === typeFilter);
  }, [data, typeFilter]);

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (employee: Employee) => {
    setEditing(employee);
    setForm({
      name: employee.name,
      type: employee.type,
      role: employee.role ?? '',
      document: employee.document ?? '',
      phone: employee.phone ?? '',
      hourlyRate: String(employee.hourlyRate ?? ''),
      active: employee.active,
      notes: employee.notes ?? '',
    });
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      Alert.alert('Erro', 'Nome é obrigatório');
      return;
    }
    if (!form.hourlyRate || Number.isNaN(Number(form.hourlyRate))) {
      Alert.alert('Erro', 'Valor por hora é obrigatório');
      return;
    }
    const body = {
      name: form.name.trim(),
      type: form.type,
      role: form.role.trim() || undefined,
      document: form.document.trim() || undefined,
      phone: form.phone.trim() || undefined,
      hourlyRate: Number(form.hourlyRate),
      active: form.active,
      notes: form.notes.trim() || undefined,
    };
    if (editing) updateEmployee.mutate({ id: editing.id, ...body });
    else createEmployee.mutate(body);
  };

  const handleDelete = (employee: Employee) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert('Excluir funcionário?', `Deseja excluir "${employee.name}"? Essa ação não pode ser desfeita.`, [
      { text: 'Cancelar' },
      { text: 'Excluir', style: 'destructive', onPress: () => deleteEmployee.mutate(employee.id) },
    ]);
  };

  const toggleExpand = (id: string) => {
    Haptics.selectionAsync();
    setExpandedId((current) => (current === id ? null : id));
  };

  const openEntryForm = (employeeId: string) => {
    setEntryEmployeeId(employeeId);
    setEntryForm(emptyTimeEntryForm);
    setShowEntryForm(true);
  };

  const handleSaveEntry = () => {
    if (!entryEmployeeId) return;
    if (!entryForm.workDate) {
      Alert.alert('Erro', 'Data é obrigatória');
      return;
    }
    if (!entryForm.hours || Number.isNaN(Number(entryForm.hours))) {
      Alert.alert('Erro', 'Horas é obrigatório');
      return;
    }
    createTimeEntry.mutate({
      employeeId: entryEmployeeId,
      workDate: toApiDate(entryForm.workDate),
      hours: Number(entryForm.hours),
      description: entryForm.description.trim() || undefined,
      paid: entryForm.paid,
    });
  };

  const handleDeleteEntry = (employeeId: string, entryId: string) => {
    Alert.alert('Excluir lançamento?', 'Deseja excluir este lançamento de horas?', [
      { text: 'Cancelar' },
      { text: 'Excluir', style: 'destructive', onPress: () => deleteTimeEntry.mutate({ employeeId, entryId }) },
    ]);
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
      {!data?.length ? (
        <EmptyState icon="👥" title="Nenhum funcionário" subtitle="Toque no + para cadastrar" />
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={filtered}
          keyExtractor={(e: Employee) => e.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 96 }}
          onRefresh={refetch}
          refreshing={isRefetching}
          ListHeaderComponent={
            <View>
              <Animated.View entering={FadeInDown.springify().damping(16)} style={s.summaryCard}>
                <View style={s.summaryRow}>
                  <View style={s.summaryItem}>
                    <Text style={s.summaryValue}>{summary.employeeCount}</Text>
                    <Text style={s.summaryLabel}>Funcionários</Text>
                  </View>
                  <View style={s.summaryItem}>
                    <Text style={s.summaryValue}>{summary.activeCount}</Text>
                    <Text style={s.summaryLabel}>Ativos</Text>
                  </View>
                  <View style={s.summaryItem}>
                    <Text style={s.summaryValue}>{summary.totalHours.toFixed(1)}h</Text>
                    <Text style={s.summaryLabel}>Horas</Text>
                  </View>
                  <View style={s.summaryItem}>
                    <Text style={[s.summaryValue, { fontSize: 15 }]}>{formatBRL(summary.totalCost)}</Text>
                    <Text style={s.summaryLabel}>Custo total</Text>
                  </View>
                </View>
              </Animated.View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterScroll} contentContainerStyle={{ gap: 8 }}>
                <TouchableOpacity
                  style={[s.chip, typeFilter === 'TODOS' && s.chipActive]}
                  onPress={() => setTypeFilter('TODOS')}
                >
                  <Text style={[s.chipText, typeFilter === 'TODOS' && s.chipTextActive]}>TODOS</Text>
                </TouchableOpacity>
                {TYPES.map((t: EmployeeType) => (
                  <TouchableOpacity
                    key={t}
                    style={[s.chip, typeFilter === t && s.chipActive]}
                    onPress={() => setTypeFilter(t)}
                  >
                    <Text style={[s.chipText, typeFilter === t && s.chipTextActive]}>{TYPE_LABELS[t]}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          }
          ListEmptyComponent={
            <EmptyState icon="🔍" title="Nenhum resultado" subtitle="Nenhum funcionário para esse filtro" />
          }
          renderItem={({ item, index }: { item: Employee; index: number }) => {
            const typeColor = TYPE_COLORS[item.type];
            const expanded = expandedId === item.id;
            return (
              <Animated.View entering={FadeInDown.delay(Math.min(index, 10) * 60).springify().damping(16)}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => toggleExpand(item.id)}
                  onLongPress={() => handleDelete(item)}
                >
                  <View style={s.card}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={[s.avatar, { backgroundColor: typeColor.bg }]}>
                        <Ionicons name="person" size={19} color={typeColor.text} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={s.name}>{item.name}</Text>
                          {!item.active && (
                            <View style={s.inactiveBadge}>
                              <Text style={s.inactiveBadgeText}>Inativo</Text>
                            </View>
                          )}
                        </View>
                        <View style={s.row}>
                          <View style={[s.typeBadge, { backgroundColor: typeColor.bg }]}>
                            <Text style={[s.typeBadgeText, { color: typeColor.text }]}>{TYPE_LABELS[item.type]}</Text>
                          </View>
                          {item.role ? <Text style={s.meta}>{item.role}</Text> : null}
                          {item.phone ? <Text style={s.meta}>{item.phone}</Text> : null}
                        </View>
                      </View>
                      <TouchableOpacity onPress={() => openEdit(item)} hitSlop={8}>
                        <Ionicons name="create-outline" size={20} color={theme.colors.textMuted} />
                      </TouchableOpacity>
                      <Ionicons
                        name={expanded ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color={theme.colors.textFaint}
                      />
                    </View>

                    <View style={s.statsRow}>
                      <View style={s.statBox}>
                        <Text style={s.statLabel}>R$/hora</Text>
                        <Text style={s.statValue}>{formatBRL(item.hourlyRate)}</Text>
                      </View>
                      <View style={s.statBox}>
                        <Text style={s.statLabel}>Horas</Text>
                        <Text style={s.statValue}>{(item.totalHours ?? 0).toFixed(1)}h</Text>
                      </View>
                      <View style={s.statBox}>
                        <Text style={s.statLabel}>Custo</Text>
                        <Text style={s.statValue}>{formatBRL(item.grossCost ?? 0)}</Text>
                      </View>
                    </View>

                    {expanded && (
                      <View style={s.detail}>
                        <View style={s.detailHeaderRow}>
                          <Text style={s.detailTitle}>Lançamentos de horas</Text>
                          <TouchableOpacity style={s.addEntryBtn} onPress={() => openEntryForm(item.id)}>
                            <Ionicons name="add" size={16} color={theme.colors.primary} />
                            <Text style={s.addEntryText}>Lançar horas</Text>
                          </TouchableOpacity>
                        </View>

                        {isLoadingDetail && expandedId === item.id ? (
                          <ActivityIndicator color={theme.colors.primary} style={{ marginVertical: 12 }} />
                        ) : expandedEmployee?.timeEntries?.length ? (
                          expandedEmployee.timeEntries.map((entry: TimeEntry) => (
                            <View key={entry.id} style={s.entryRow}>
                              <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                  <Text style={s.entryDate}>{formatDate(entry.workDate)}</Text>
                                  <Text style={s.entryHours}>{entry.hours}h</Text>
                                  <View style={[s.paidBadge, entry.paid ? s.paidBadgeYes : s.paidBadgeNo]}>
                                    <Text style={[s.paidBadgeText, entry.paid ? s.paidBadgeTextYes : s.paidBadgeTextNo]}>
                                      {entry.paid ? 'Pago' : 'Pendente'}
                                    </Text>
                                  </View>
                                </View>
                                {entry.description ? <Text style={s.entryDescription}>{entry.description}</Text> : null}
                              </View>
                              <TouchableOpacity
                                onPress={() => handleDeleteEntry(item.id, entry.id)}
                                hitSlop={8}
                              >
                                <Ionicons name="trash-outline" size={16} color={theme.colors.danger} />
                              </TouchableOpacity>
                            </View>
                          ))
                        ) : (
                          <Text style={s.noEntries}>Nenhum lançamento de horas ainda.</Text>
                        )}
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              </Animated.View>
            );
          }}
        />
      )}

      <Fab onPress={openCreate} />

      <Modal visible={showForm} animationType="slide" transparent>
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.modal}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <View style={s.grabber} />
              <Text style={s.modalTitle}>{editing ? 'Editar Funcionário' : 'Novo Funcionário'}</Text>

              <Text style={s.label}>Nome *</Text>
              <TextInput
                style={s.input}
                value={form.name}
                onChangeText={(v: string) => setForm({ ...form, name: v })}
                placeholder="Ex: João da Silva"
              />

              <Text style={s.label}>Tipo *</Text>
              <View style={s.chipRow}>
                {TYPES.map((t: EmployeeType) => (
                  <TouchableOpacity
                    key={t}
                    style={[s.chip, form.type === t && s.chipActive]}
                    onPress={() => setForm({ ...form, type: t })}
                  >
                    <Text style={[s.chipText, form.type === t && s.chipTextActive]}>{TYPE_LABELS[t]}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.label}>Função</Text>
              <TextInput
                style={s.input}
                value={form.role}
                onChangeText={(v: string) => setForm({ ...form, role: v })}
                placeholder="Ex: Vaqueiro"
              />

              <Text style={s.label}>CPF</Text>
              <TextInput
                style={s.input}
                value={form.document}
                onChangeText={(v: string) => setForm({ ...form, document: v })}
                placeholder="000.000.000-00"
                keyboardType="numeric"
              />

              <Text style={s.label}>Telefone</Text>
              <TextInput
                style={s.input}
                value={form.phone}
                onChangeText={(v: string) => setForm({ ...form, phone: v })}
                placeholder="(00) 00000-0000"
                keyboardType="phone-pad"
              />

              <Text style={s.label}>Valor por hora (R$) *</Text>
              <TextInput
                style={s.input}
                value={form.hourlyRate}
                onChangeText={(v: string) => setForm({ ...form, hourlyRate: v })}
                placeholder="Ex: 15.50"
                keyboardType="decimal-pad"
              />

              <View style={s.switchRow}>
                <Text style={s.label}>Ativo</Text>
                <Switch
                  value={form.active}
                  onValueChange={(v: boolean) => setForm({ ...form, active: v })}
                  trackColor={{ false: theme.colors.border, true: theme.colors.primaryLight }}
                  thumbColor="#fff"
                />
              </View>

              <Text style={s.label}>Observações</Text>
              <TextInput
                style={[s.input, s.textArea]}
                value={form.notes}
                onChangeText={(v: string) => setForm({ ...form, notes: v })}
                placeholder="Observações adicionais"
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
                  disabled={createEmployee.isPending || updateEmployee.isPending}
                >
                  {createEmployee.isPending || updateEmployee.isPending ? (
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

      <Modal visible={showEntryForm} animationType="slide" transparent>
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.modal}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <View style={s.grabber} />
              <Text style={s.modalTitle}>Lançar Horas</Text>

              <DateInput label="Data *" value={entryForm.workDate} onChange={(v: string) => setEntryForm({ ...entryForm, workDate: v })} />

              <Text style={s.label}>Horas *</Text>
              <TextInput
                style={s.input}
                value={entryForm.hours}
                onChangeText={(v: string) => setEntryForm({ ...entryForm, hours: v })}
                placeholder="Ex: 8"
                keyboardType="decimal-pad"
              />

              <Text style={s.label}>Descrição</Text>
              <TextInput
                style={s.input}
                value={entryForm.description}
                onChangeText={(v: string) => setEntryForm({ ...entryForm, description: v })}
                placeholder="Ex: Manejo do gado"
              />

              <View style={s.switchRow}>
                <Text style={s.label}>Pago</Text>
                <Switch
                  value={entryForm.paid}
                  onValueChange={(v: boolean) => setEntryForm({ ...entryForm, paid: v })}
                  trackColor={{ false: theme.colors.border, true: theme.colors.primaryLight }}
                  thumbColor="#fff"
                />
              </View>

              <View style={s.modalActions}>
                <TouchableOpacity
                  style={s.cancelBtn}
                  onPress={() => {
                    setShowEntryForm(false);
                    setEntryForm(emptyTimeEntryForm);
                    setEntryEmployeeId(null);
                  }}
                >
                  <Text style={s.cancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.saveBtn} onPress={handleSaveEntry} disabled={createTimeEntry.isPending}>
                  {createTimeEntry.isPending ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>Salvar</Text>}
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

  summaryCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryItem: { alignItems: 'center', flex: 1 },
  summaryValue: { fontSize: 18, fontWeight: '800', color: theme.colors.primary },
  summaryLabel: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2, textAlign: 'center' },

  filterScroll: { marginBottom: 14 },

  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
  },
  avatar: { width: 42, height: 42, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  name: { fontSize: 16, fontWeight: '700', color: theme.colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  meta: { fontSize: 13, color: theme.colors.textMuted },

  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  typeBadgeText: { fontSize: 11, fontWeight: '700' },

  inactiveBadge: { backgroundColor: '#FEE4E2', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  inactiveBadgeText: { fontSize: 11, fontWeight: '700', color: theme.colors.danger },

  statsRow: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statLabel: { fontSize: 11, color: theme.colors.textFaint },
  statValue: { fontSize: 14, fontWeight: '700', color: theme.colors.text, marginTop: 2 },

  detail: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.colors.border },
  detailHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  detailTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.text },
  addEntryBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addEntryText: { fontSize: 12, fontWeight: '700', color: theme.colors.primary },

  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  entryDate: { fontSize: 13, fontWeight: '600', color: theme.colors.text },
  entryHours: { fontSize: 13, fontWeight: '700', color: theme.colors.primary },
  entryDescription: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  noEntries: { fontSize: 13, color: theme.colors.textFaint, paddingVertical: 8 },

  paidBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  paidBadgeYes: { backgroundColor: '#D1FADF' },
  paidBadgeNo: { backgroundColor: '#FEF0C7' },
  paidBadgeText: { fontSize: 10, fontWeight: '700' },
  paidBadgeTextYes: { color: theme.colors.success },
  paidBadgeTextNo: { color: theme.colors.warning },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(16,24,40,0.55)', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    padding: 24,
    maxHeight: '88%',
  },
  grabber: {
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
    borderRadius: 20,
    backgroundColor: theme.colors.bg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipText: { fontSize: 13, color: theme.colors.textMuted, fontWeight: '600' },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20, marginBottom: 20 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: theme.radius.sm, backgroundColor: theme.colors.bg, alignItems: 'center' },
  cancelText: { fontSize: 15, fontWeight: '600', color: theme.colors.textMuted },
  saveBtn: { flex: 1, padding: 14, borderRadius: theme.radius.sm, backgroundColor: theme.colors.primary, alignItems: 'center' },
  saveText: { fontSize: 15, fontWeight: '600', color: '#fff' },
});
