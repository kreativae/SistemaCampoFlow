import { useState, useMemo } from 'react';
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
  Dimensions,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Svg, { Rect, Text as SvgText, Line } from 'react-native-svg';
import { theme } from '../../../../../src/lib/theme';
import { Fab } from '../../../../../src/components/UI';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../../../../src/lib/api';
import { EmptyState } from '../../../../../src/components/EmptyState';
import type { Transaction, CashFlowBucket } from '../../../../../src/lib/types';

const CATEGORIES = ['NUTRICAO', 'MEDICAMENTOS', 'FUNCIONARIOS', 'COMBUSTIVEL', 'MAQUINARIO', 'ENERGIA', 'VENDA_ANIMAL', 'OUTROS'] as const;

type PeriodFilter = 'DIA' | 'SEMANA' | 'MES' | 'ANO' | 'TODOS';
type TypeFilter = 'TODOS' | 'RECEITA' | 'DESPESA';
type Granularity = 'daily' | 'weekly' | 'monthly';

const PERIOD_LABELS: Record<PeriodFilter, string> = {
  DIA: 'Dia',
  SEMANA: 'Semana',
  MES: 'Mês',
  ANO: 'Ano',
  TODOS: 'Todos',
};

const GRANULARITY_LABELS: Record<Granularity, string> = {
  daily: 'Diário',
  weekly: 'Semanal',
  monthly: 'Mensal',
};

const todayISO = () => new Date().toISOString().slice(0, 10);

const emptyForm = {
  type: 'DESPESA' as 'RECEITA' | 'DESPESA',
  category: 'OUTROS',
  description: '',
  amount: '',
  dueDate: todayISO(),
  alreadyPaid: false,
};

function getDateRangeForPeriod(period: PeriodFilter): { start: Date; end: Date } | null {
  const now = new Date();
  switch (period) {
    case 'DIA':
      return {
        start: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
        end: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999),
      };
    case 'SEMANA': {
      const day = now.getDay();
      const mondayOffset = day === 0 ? 6 : day - 1;
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    case 'MES':
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
      };
    case 'ANO':
      return {
        start: new Date(now.getFullYear(), 0, 1),
        end: new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999),
      };
    case 'TODOS':
      return null;
  }
}

const CHART_HEIGHT = 180;
const CHART_PADDING_LEFT = 60;
const CHART_PADDING_RIGHT = 16;
const CHART_PADDING_TOP = 16;
const CHART_PADDING_BOTTOM = 40;

function CashFlowChart({ data }: { data: CashFlowBucket[] }) {
  const screenWidth = Dimensions.get('window').width - 32;
  const chartWidth = screenWidth;
  const drawWidth = chartWidth - CHART_PADDING_LEFT - CHART_PADDING_RIGHT;
  const drawHeight = CHART_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM;

  if (data.length === 0) {
    return (
      <View style={s.chartContainer}>
        <Text style={s.chartTitle}>Fluxo de Caixa</Text>
        <Text style={[s.meta, { textAlign: 'center', marginTop: 12 }]}>Sem dados para exibir</Text>
      </View>
    );
  }

  const maxVal = Math.max(
    ...data.map((b: CashFlowBucket) => Math.max(b.receita, b.despesa)),
    1,
  );

  const barGroupWidth = drawWidth / data.length;
  const barWidth = Math.max(barGroupWidth * 0.35, 4);
  const gap = barGroupWidth * 0.05;

  const fmt = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(0)}k`;
    return String(Math.round(n));
  };

  const ySteps = 4;
  const yLines: number[] = [];
  for (let i = 0; i <= ySteps; i++) {
    yLines.push((maxVal / ySteps) * i);
  }

  return (
    <View style={s.chartContainer}>
      <Text style={s.chartTitle}>Fluxo de Caixa</Text>
      <Svg width={chartWidth} height={CHART_HEIGHT}>
        {/* Y-axis labels and grid lines */}
        {yLines.map((val: number, i: number) => {
          const y = CHART_PADDING_TOP + drawHeight - (val / maxVal) * drawHeight;
          return (
            <React.Fragment key={`y-${i}`}>
              <Line
                x1={CHART_PADDING_LEFT}
                y1={y}
                x2={chartWidth - CHART_PADDING_RIGHT}
                y2={y}
                stroke="#e0e0e0"
                strokeWidth={1}
                strokeDasharray="4,4"
              />
              <SvgText
                x={CHART_PADDING_LEFT - 6}
                y={y + 4}
                textAnchor="end"
                fontSize={10}
                fill="#999"
              >
                {fmt(val)}
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* Bars */}
        {data.map((bucket: CashFlowBucket, i: number) => {
          const groupX = CHART_PADDING_LEFT + i * barGroupWidth;
          const receitaH = (bucket.receita / maxVal) * drawHeight;
          const despesaH = (bucket.despesa / maxVal) * drawHeight;

          return (
            <React.Fragment key={`bar-${i}`}>
              {/* Receita bar */}
              <Rect
                x={groupX + gap}
                y={CHART_PADDING_TOP + drawHeight - receitaH}
                width={barWidth}
                height={receitaH}
                rx={3}
                fill="#12B76A"
              />
              {/* Despesa bar */}
              <Rect
                x={groupX + barWidth + gap * 2}
                y={CHART_PADDING_TOP + drawHeight - despesaH}
                width={barWidth}
                height={despesaH}
                rx={3}
                fill="#D92D20"
              />
              {/* X-axis label */}
              <SvgText
                x={groupX + barGroupWidth / 2}
                y={CHART_HEIGHT - 8}
                textAnchor="middle"
                fontSize={9}
                fill="#999"
              >
                {bucket.period.length > 7 ? bucket.period.slice(5) : bucket.period}
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* X-axis line */}
        <Line
          x1={CHART_PADDING_LEFT}
          y1={CHART_PADDING_TOP + drawHeight}
          x2={chartWidth - CHART_PADDING_RIGHT}
          y2={CHART_PADDING_TOP + drawHeight}
          stroke="#ccc"
          strokeWidth={1}
        />
      </Svg>
      <View style={s.legendRow}>
        <View style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: '#12B76A' }]} />
          <Text style={s.legendText}>Receita</Text>
        </View>
        <View style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: '#D92D20' }]} />
          <Text style={s.legendText}>Despesa</Text>
        </View>
      </View>
    </View>
  );
}

import React from 'react';

export default function FinanceScreen() {
  const { farmId } = useLocalSearchParams<{ farmId: string }>();
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('TODOS');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('MES');
  const [granularity, setGranularity] = useState<Granularity>('monthly');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: transactions, isLoading, refetch } = useQuery({
    queryKey: ['finance', farmId],
    queryFn: () => apiFetch<Transaction[]>(`/fazendas/${farmId}/lancamentos`),
    enabled: !!farmId,
  });

  const { data: cashFlowData } = useQuery({
    queryKey: ['cashflow', farmId, granularity],
    queryFn: () =>
      apiFetch<CashFlowBucket[]>(
        `/fazendas/${farmId}/financeiro/fluxo-caixa?granularity=${granularity}`,
      ),
    enabled: !!farmId,
  });

  const createTx = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch(`/fazendas/${farmId}/lancamentos`, { method: 'POST', body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', farmId] });
      queryClient.invalidateQueries({ queryKey: ['cashflow', farmId] });
      closeForm();
    },
    onError: (err: Error) => Alert.alert('Erro', err.message),
  });

  const updateItem = useMutation({
    mutationFn: ({ id, ...body }: Record<string, unknown> & { id: string }) =>
      apiFetch(`/fazendas/${farmId}/financeiro/${id}`, { method: 'PATCH', body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', farmId] });
      queryClient.invalidateQueries({ queryKey: ['cashflow', farmId] });
      closeForm();
    },
    onError: (e: Error) => Alert.alert('Erro', e.message),
  });

  const deleteItem = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/fazendas/${farmId}/financeiro/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', farmId] });
      queryClient.invalidateQueries({ queryKey: ['cashflow', farmId] });
    },
    onError: (e: Error) => Alert.alert('Erro', e.message),
  });

  const markPaid = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/fazendas/${farmId}/lancamentos/${id}/pagar`, { method: 'PATCH' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', farmId] });
      queryClient.invalidateQueries({ queryKey: ['cashflow', farmId] });
    },
    onError: (e: Error) => Alert.alert('Erro', e.message),
  });

  const markUnpaid = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/fazendas/${farmId}/lancamentos/${id}/desfazer-pagamento`, { method: 'PATCH' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', farmId] });
      queryClient.invalidateQueries({ queryKey: ['cashflow', farmId] });
    },
    onError: (e: Error) => Alert.alert('Erro', e.message),
  });

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, dueDate: todayISO() });
    setShowForm(true);
  };

  const openEdit = (item: Transaction) => {
    setEditing(item);
    setForm({
      type: item.type,
      category: item.category ?? 'OUTROS',
      description: item.description ?? '',
      amount: String(item.amount),
      dueDate: item.dueDate ? item.dueDate.slice(0, 10) : todayISO(),
      alreadyPaid: !!item.paidAt,
    });
    setShowForm(true);
  };

  const confirmDelete = (item: Transaction) => {
    Alert.alert(
      'Excluir lançamento',
      `Deseja excluir "${item.description || item.category}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: () => deleteItem.mutate(item.id) },
      ],
    );
  };

  const confirmMarkPaid = (item: Transaction) => {
    Alert.alert(
      'Marcar como pago',
      `Confirma o pagamento de "${item.description || item.category}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Confirmar', onPress: () => markPaid.mutate(item.id) },
      ],
    );
  };

  const confirmMarkUnpaid = (item: Transaction) => {
    Alert.alert(
      'Marcar como pendente',
      `Desfazer pagamento de "${item.description || item.category}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Confirmar', onPress: () => markUnpaid.mutate(item.id) },
      ],
    );
  };

  const handleSave = () => {
    if (!form.amount) {
      Alert.alert('Erro', 'Valor é obrigatório');
      return;
    }
    const body: Record<string, unknown> = {
      type: form.type,
      category: form.category,
      description: form.description || undefined,
      amount: Number(form.amount),
      dueDate: form.dueDate || todayISO(),
    };
    if (form.alreadyPaid && !editing) {
      body.paidAt = new Date().toISOString();
    }
    if (editing) {
      updateItem.mutate({ id: editing.id, ...body });
    } else {
      createTx.mutate(body);
    }
  };

  const isSaving = createTx.isPending || updateItem.isPending;

  const filtered = useMemo(() => {
    const all = transactions ?? [];
    const range = getDateRangeForPeriod(periodFilter);
    return all.filter((t: Transaction) => {
      if (typeFilter !== 'TODOS' && t.type !== typeFilter) return false;
      if (range) {
        const ref = new Date(t.paidAt ?? t.dueDate);
        if (ref < range.start || ref > range.end) return false;
      }
      return true;
    });
  }, [transactions, typeFilter, periodFilter]);

  const total = filtered.reduce(
    (sum: number, t: Transaction) => sum + (t.type === 'RECEITA' ? t.amount : -t.amount),
    0,
  );
  const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');

  if (isLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <FlatList
        data={filtered}
        keyExtractor={(t: Transaction) => t.id}
        contentContainerStyle={{ padding: 16, paddingTop: 0 }}
        onRefresh={refetch}
        refreshing={false}
        ListHeaderComponent={
          <>
            {/* Summary card */}
            <View style={s.summary}>
              <Text style={s.summaryLabel}>Saldo do período</Text>
              <Text style={[s.summaryValue, { color: total >= 0 ? '#2e7d32' : '#c62828' }]}>
                {fmt(total)}
              </Text>
            </View>

            {/* Period filter */}
            <View style={s.filters}>
              {(['DIA', 'SEMANA', 'MES', 'ANO', 'TODOS'] as PeriodFilter[]).map(
                (p: PeriodFilter) => (
                  <TouchableOpacity
                    key={p}
                    style={[s.filterBtn, periodFilter === p && s.filterActive]}
                    onPress={() => setPeriodFilter(p)}
                  >
                    <Text style={[s.filterText, periodFilter === p && s.filterTextActive]}>
                      {PERIOD_LABELS[p]}
                    </Text>
                  </TouchableOpacity>
                ),
              )}
            </View>

            {/* Type filter */}
            <View style={s.filters}>
              {(['TODOS', 'RECEITA', 'DESPESA'] as TypeFilter[]).map((f: TypeFilter) => (
                <TouchableOpacity
                  key={f}
                  style={[s.filterBtn, typeFilter === f && s.filterActive]}
                  onPress={() => setTypeFilter(f)}
                >
                  <Text style={[s.filterText, typeFilter === f && s.filterTextActive]}>
                    {f === 'TODOS' ? 'Todos' : f === 'RECEITA' ? 'Receitas' : 'Despesas'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Cash flow chart */}
            <CashFlowChart data={cashFlowData ?? []} />

            {/* Granularity selector */}
            <View style={[s.filters, { marginTop: 0 }]}>
              {(['daily', 'weekly', 'monthly'] as Granularity[]).map((g: Granularity) => (
                <TouchableOpacity
                  key={g}
                  style={[s.chipSmall, granularity === g && s.chipSmallActive]}
                  onPress={() => setGranularity(g)}
                >
                  <Text style={[s.chipSmallText, granularity === g && s.chipSmallTextActive]}>
                    {GRANULARITY_LABELS[g]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        }
        ListEmptyComponent={
          <EmptyState icon="💰" title="Nenhum lançamento" subtitle="Toque no + para cadastrar" />
        }
        renderItem={({ item, index }: { item: Transaction; index: number }) => (
          <Animated.View entering={FadeInDown.delay(Math.min(index, 10) * 60).springify().damping(16)}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => openEdit(item)}
              onLongPress={() => confirmDelete(item)}
            >
              <View style={[s.card, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
                <View
                  style={[
                    s.txIcon,
                    { backgroundColor: item.type === 'RECEITA' ? '#E6F7EF' : '#FCEAEA' },
                  ]}
                >
                  <Ionicons
                    name={item.type === 'RECEITA' ? 'arrow-up' : 'arrow-down'}
                    size={17}
                    color={item.type === 'RECEITA' ? '#12B76A' : '#D92D20'}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={s.row}>
                    <Text style={s.description}>{item.description || item.category}</Text>
                    <Text
                      style={[
                        s.amount,
                        { color: item.type === 'RECEITA' ? '#12B76A' : '#D92D20' },
                      ]}
                    >
                      {item.type === 'RECEITA' ? '+' : '-'}
                      {fmt(item.amount)}
                    </Text>
                  </View>
                  <View style={s.row}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={s.meta}>{fmtDate(item.dueDate)}</Text>
                      {item.category && <Text style={s.meta}>{item.category}</Text>}
                      {item.paidAt ? (
                        <View style={s.badgePago}>
                          <Text style={s.badgePagoText}>Pago</Text>
                        </View>
                      ) : (
                        <View style={s.badgePendente}>
                          <Text style={s.badgePendenteText}>Pendente</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  {!item.paidAt ? (
                    <TouchableOpacity
                      style={s.markPaidBtn}
                      onPress={() => confirmMarkPaid(item)}
                    >
                      <Ionicons name="checkmark-circle-outline" size={14} color="#2e7d32" />
                      <Text style={s.markPaidText}>Marcar como pago</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={s.markUnpaidBtn}
                      onPress={() => confirmMarkUnpaid(item)}
                    >
                      <Ionicons name="close-circle-outline" size={14} color="#F59E0B" />
                      <Text style={s.markUnpaidText}>Marcar como pendente</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          </Animated.View>
        )}
      />

      <Fab onPress={openCreate} />

      <Modal visible={showForm} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={s.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={s.modal}>
            <ScrollView>
              <View
                style={{
                  width: 40,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: theme.colors.border,
                  alignSelf: 'center',
                  marginBottom: 14,
                }}
              />
              <Text style={s.modalTitle}>
                {editing ? 'Editar Lançamento' : 'Novo Lançamento'}
              </Text>

              <Text style={s.label}>Tipo</Text>
              <View style={s.chipRow}>
                <TouchableOpacity
                  style={[s.chip, form.type === 'RECEITA' && s.chipActive]}
                  onPress={() => setForm({ ...form, type: 'RECEITA' })}
                >
                  <Text style={[s.chipText, form.type === 'RECEITA' && s.chipTextActive]}>
                    Receita
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.chip, form.type === 'DESPESA' && s.chipActive]}
                  onPress={() => setForm({ ...form, type: 'DESPESA' })}
                >
                  <Text style={[s.chipText, form.type === 'DESPESA' && s.chipTextActive]}>
                    Despesa
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={s.label}>Categoria</Text>
              <View style={s.chipRow}>
                {CATEGORIES.map((c: (typeof CATEGORIES)[number]) => (
                  <TouchableOpacity
                    key={c}
                    style={[s.chip, form.category === c && s.chipActive]}
                    onPress={() => setForm({ ...form, category: c })}
                  >
                    <Text style={[s.chipText, form.category === c && s.chipTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.label}>Descrição</Text>
              <TextInput
                style={s.input}
                value={form.description}
                onChangeText={(v: string) => setForm({ ...form, description: v })}
                placeholder="Opcional"
              />

              <Text style={s.label}>Valor (R$) *</Text>
              <TextInput
                style={s.input}
                value={form.amount}
                onChangeText={(v: string) => setForm({ ...form, amount: v })}
                keyboardType="numeric"
                placeholder="Ex: 150.00"
              />

              <DateInput label="Data de vencimento" value={form.dueDate} onChange={(v: string) => setForm({ ...form, dueDate: v })} />

              {!editing && (
                <View style={s.switchRow}>
                  <Text style={s.switchLabel}>Já pago?</Text>
                  <Switch
                    value={form.alreadyPaid}
                    onValueChange={(v: boolean) => setForm({ ...form, alreadyPaid: v })}
                    trackColor={{ false: '#ddd', true: '#12B76A' }}
                    thumbColor={form.alreadyPaid ? '#fff' : '#f4f3f4'}
                  />
                </View>
              )}

              <View style={s.modalActions}>
                <TouchableOpacity style={s.cancelBtn} onPress={closeForm}>
                  <Text style={s.cancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={isSaving}>
                  {isSaving ? (
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
  summary: {
    backgroundColor: '#fff',
    marginTop: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#101828',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  summaryLabel: { fontSize: 13, color: '#666' },
  summaryValue: { fontSize: 24, fontWeight: '700', marginTop: 4 },
  filters: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  filterBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#e0e0e0',
  },
  filterActive: { backgroundColor: theme.colors.primary },
  filterText: { fontSize: 13, color: '#666', fontWeight: '600' },
  filterTextActive: { color: '#fff' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#101828',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  txIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  description: { fontSize: 15, fontWeight: '600', color: '#333', flex: 1, marginRight: 8 },
  amount: { fontSize: 15, fontWeight: '700' },
  meta: { fontSize: 12, color: '#999' },
  badgePago: {
    backgroundColor: '#E6F7EF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgePagoText: { fontSize: 10, fontWeight: '700', color: '#12B76A' },
  badgePendente: {
    backgroundColor: '#FFF8E1',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgePendenteText: { fontSize: 10, fontWeight: '700', color: '#F59E0B' },
  markPaidBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#E6F7EF',
  },
  markPaidText: { fontSize: 12, fontWeight: '600', color: '#2e7d32' },
  markUnpaidBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#FFF8E1',
  },
  markUnpaidText: { fontSize: 12, fontWeight: '600', color: '#F59E0B' },
  chartContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#101828',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  chartTitle: { fontSize: 15, fontWeight: '700', color: '#333', marginBottom: 8 },
  legendRow: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11, color: '#666' },
  chipSmall: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  chipSmallActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipSmallText: { fontSize: 12, color: '#555' },
  chipSmallTextActive: { color: '#fff', fontWeight: '600' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(16,24,40,0.55)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
    color: theme.colors.primary,
    marginBottom: 16,
  },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 4, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    backgroundColor: '#fafafa',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipText: { fontSize: 13, color: '#555' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 4,
  },
  switchLabel: { fontSize: 15, fontWeight: '600', color: '#555' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20, marginBottom: 20 },
  cancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  cancelText: { fontSize: 15, fontWeight: '600', color: '#666' },
  saveBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
  },
  saveText: { fontSize: 15, fontWeight: '600', color: '#fff' },
});
