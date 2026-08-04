import { useMemo, useRef, useState } from 'react';
import { DateInput } from '../../../../../src/components/DateInput';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  ScrollView,
  Alert,
  Switch,
  PanResponder,
  Animated as RNAnimated,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
const haptic = (style?: string) => {
  try {
    const H = require('expo-haptics');
    if (style === 'warning') H.notificationAsync(H.NotificationFeedbackType.Warning);
    else if (style === 'light') H.impactAsync(H.ImpactFeedbackStyle.Light);
    else if (style === 'selection') H.selectionAsync();
    else H.impactAsync(H.ImpactFeedbackStyle.Medium);
  } catch {}
};
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../../../../src/lib/api';
import { toApiDate, todayInput } from '../../../../../src/lib/dates';
import { EmptyState } from '../../../../../src/components/EmptyState';
import { theme } from '../../../../../src/lib/theme';
import type { Deal, DealType, DealStatus, CropCycle } from '../../../../../src/lib/types';

const DEAL_TYPES: DealType[] = ['COMPRA', 'VENDA', 'ABATE', 'VENDA_GRAO'];
const DEAL_STATUSES: DealStatus[] = ['RASCUNHO', 'FINALIZADO', 'CANCELADO'];

const DEAL_TYPE_LABEL: Record<DealType, string> = {
  COMPRA: 'Compra',
  VENDA: 'Venda',
  ABATE: 'Abate',
  VENDA_GRAO: 'Venda grão',
};

const DEAL_STATUS_LABEL: Record<DealStatus, string> = {
  RASCUNHO: 'Rascunho',
  FINALIZADO: 'Finalizado',
  CANCELADO: 'Cancelado',
};

const DEAL_TYPE_COLOR: Record<DealType, string> = {
  COMPRA: theme.colors.info,
  VENDA: theme.colors.success,
  ABATE: theme.colors.warning,
  VENDA_GRAO: theme.colors.accent,
};

const DEAL_STATUS_BG: Record<DealStatus, string> = {
  RASCUNHO: theme.colors.textMuted,
  FINALIZADO: theme.colors.success,
  CANCELADO: theme.colors.danger,
};

const GRAIN_CROPS = ['Soja', 'Milho', 'Café', 'Trigo', 'Arroz', 'Sorgo', 'Algodão', 'Feijão'];
const GRAIN_UNITS = ['SACA60', 'KG', 'TONELADA'] as const;
const GRAIN_UNIT_LABEL: Record<string, string> = { SACA60: 'Saca 60kg', KG: 'kg', TONELADA: 'Tonelada' };
const GRAIN_MODALITIES = ['BALCAO', 'CONTRATO_FUTURO', 'COOPERATIVA', 'BARTER'] as const;
const GRAIN_MOD_LABEL: Record<string, string> = { BALCAO: 'Balcão', CONTRATO_FUTURO: 'Contrato futuro', COOPERATIVA: 'Cooperativa', BARTER: 'Barter' };
const SLAUGHTER_FREQ = ['TRIMESTRAL', 'SEMESTRAL'] as const;

const today = todayInput;

interface DealForm {
  type: DealType;
  dealDate: string;
  counterparty: string;
  // Venda
  pricePerUnit: string;
  priceUnit: string;
  // Compra
  quantity: string;
  totalValue: string;
  isInstallment: boolean;
  installmentCount: string;
  installmentValue: string;
  // Abate
  liveWeightPricePerKg: string;
  carcassYieldPercent: string;
  slaughterFrequency: string;
  // Abate + Grãos
  funruralPercent: string;
  senarPercent: string;
  // Grãos
  grainCrop: string;
  grainQuantity: string;
  grainUnit: string;
  grainMoisturePercent: string;
  grainMoistureBasePercent: string;
  grainImpurityPercent: string;
  grainGrossWeightKg: string;
  grainSaleModality: string;
  grainWarehouse: string;
  grainTicketRef: string;
  cropCycleId: string;
  // Comum
  freightCost: string;
  commissionPercent: string;
  notes: string;
}

const emptyForm: DealForm = {
  type: 'COMPRA',
  dealDate: today(),
  counterparty: '',
  pricePerUnit: '',
  priceUnit: 'ARROBA',
  quantity: '',
  totalValue: '',
  isInstallment: false,
  installmentCount: '',
  installmentValue: '',
  liveWeightPricePerKg: '',
  carcassYieldPercent: '52',
  slaughterFrequency: 'TRIMESTRAL',
  funruralPercent: '1.5',
  senarPercent: '0.2',
  grainCrop: 'Soja',
  grainQuantity: '',
  grainUnit: 'SACA60',
  grainMoisturePercent: '14',
  grainMoistureBasePercent: '14',
  grainImpurityPercent: '',
  grainGrossWeightKg: '',
  grainSaleModality: 'BALCAO',
  grainWarehouse: '',
  grainTicketRef: '',
  cropCycleId: '',
  freightCost: '',
  commissionPercent: '',
  notes: '',
};

function formFromDeal(deal: Deal): DealForm {
  return {
    type: deal.type,
    dealDate: deal.dealDate.slice(0, 10),
    counterparty: deal.counterparty ?? '',
    pricePerUnit: deal.pricePerUnit ? String(deal.pricePerUnit) : '',
    priceUnit: deal.priceUnit ?? 'ARROBA',
    quantity: deal.quantity ? String(deal.quantity) : '',
    totalValue: deal.totalValue ? String(deal.totalValue) : '',
    isInstallment: !!(deal.installmentCount && deal.installmentCount > 0),
    installmentCount: deal.installmentCount ? String(deal.installmentCount) : '',
    installmentValue: deal.installmentValue ? String(deal.installmentValue) : '',
    liveWeightPricePerKg: deal.liveWeightPricePerKg ? String(deal.liveWeightPricePerKg) : '',
    carcassYieldPercent: deal.carcassYieldPercent ? String(deal.carcassYieldPercent) : '52',
    slaughterFrequency: deal.slaughterFrequency ?? 'TRIMESTRAL',
    funruralPercent: deal.funruralPercent != null ? String(deal.funruralPercent) : '1.5',
    senarPercent: deal.senarPercent != null ? String(deal.senarPercent) : '0.2',
    grainCrop: deal.grainCrop ?? 'Soja',
    grainQuantity: deal.grainQuantity ? String(deal.grainQuantity) : '',
    grainUnit: deal.grainUnit ?? 'SACA60',
    grainMoisturePercent: deal.grainMoisturePercent != null ? String(deal.grainMoisturePercent) : '14',
    grainMoistureBasePercent: deal.grainMoistureBasePercent != null ? String(deal.grainMoistureBasePercent) : '14',
    grainImpurityPercent: deal.grainImpurityPercent != null ? String(deal.grainImpurityPercent) : '',
    grainGrossWeightKg: deal.grainGrossWeightKg ? String(deal.grainGrossWeightKg) : '',
    grainSaleModality: deal.grainSaleModality ?? 'BALCAO',
    grainWarehouse: deal.grainWarehouse ?? '',
    grainTicketRef: deal.grainTicketRef ?? '',
    cropCycleId: deal.cropCycleId ?? '',
    freightCost: deal.freightCost ? String(deal.freightCost) : '',
    commissionPercent: deal.commissionPercent ? String(deal.commissionPercent) : '',
    notes: deal.notes ?? '',
  };
}

export default function DealsScreen() {
  const { farmId } = useLocalSearchParams<{ farmId: string }>();
  const qc = useQueryClient();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['deals', farmId],
    queryFn: () => apiFetch<Deal[]>(`/fazendas/${farmId}/negocios`),
    enabled: !!farmId,
  });

  const { data: cropCycles } = useQuery({
    queryKey: ['cropCycles', farmId],
    queryFn: () => apiFetch<CropCycle[]>(`/fazendas/${farmId}/safras`),
    enabled: !!farmId,
  });

  const [typeFilter, setTypeFilter] = useState<DealType | 'TODOS'>('TODOS');
  const [statusFilter, setStatusFilter] = useState<DealStatus | 'TODOS'>('TODOS');
  const [showForm, setShowForm] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [form, setForm] = useState<DealForm>(emptyForm);

  const filteredDeals = useMemo(() => {
    if (!data) return [];
    return data.filter((d: Deal) => {
      if (typeFilter !== 'TODOS' && d.type !== typeFilter) return false;
      if (statusFilter !== 'TODOS' && d.status !== statusFilter) return false;
      return true;
    });
  }, [data, typeFilter, statusFilter]);

  const summary = useMemo(() => {
    const total = filteredDeals.length;
    const totalValue = filteredDeals.reduce((acc: number, d: Deal) => acc + (d.totalValue ?? 0), 0);
    return { total, totalValue };
  }, [filteredDeals]);

  const activeFilterCount = (typeFilter !== 'TODOS' ? 1 : 0) + (statusFilter !== 'TODOS' ? 1 : 0);

  const createDeal = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch(`/fazendas/${farmId}/negocios`, { method: 'POST', body }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['deals', farmId] }); closeForm(); },
    onError: (e: any) => Alert.alert('Erro', e.message ?? 'Não foi possível salvar'),
  });

  const updateDeal = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      apiFetch(`/fazendas/${farmId}/negocios/${id}`, { method: 'PATCH', body }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['deals', farmId] }); closeForm(); },
    onError: (e: any) => Alert.alert('Erro', e.message ?? 'Não foi possível atualizar'),
  });

  const changeStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: DealStatus }) =>
      apiFetch(`/fazendas/${farmId}/negocios/${id}`, { method: 'PATCH', body: { status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deals', farmId] }),
    onError: (e: any) => Alert.alert('Erro', e.message),
  });

  const deleteDeal = useMutation({
    mutationFn: (id: string) => apiFetch(`/fazendas/${farmId}/negocios/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deals', farmId] }),
    onError: (e: any) => Alert.alert('Erro', e.message),
  });

  const closeForm = () => { setShowForm(false); setEditingDeal(null); setForm(emptyForm); };

  const panY = useRef(new RNAnimated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 10,
      onPanResponderMove: (_, g) => { if (g.dy > 0) panY.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 80 || g.vy > 0.5) {
          RNAnimated.timing(panY, { toValue: 600, duration: 200, useNativeDriver: true }).start(() => {
            closeForm();
            panY.setValue(0);
          });
        } else {
          RNAnimated.spring(panY, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    }),
  ).current;

  const openCreateForm = () => {
    haptic();
    panY.setValue(0);
    setEditingDeal(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEditForm = (deal: Deal) => {
    haptic('selection');
    panY.setValue(0);
    setEditingDeal(deal);
    setForm(formFromDeal(deal));
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (!form.type || !form.dealDate) {
      Alert.alert('Erro', 'Tipo e data são obrigatórios');
      return;
    }

    const n = (v: string) => v ? Number(v) : undefined;

    const base: Record<string, unknown> = {
      type: form.type,
      dealDate: toApiDate(form.dealDate),
      counterparty: form.counterparty || undefined,
      freightCost: n(form.freightCost),
      commissionPercent: n(form.commissionPercent),
      notes: form.notes || undefined,
    };

    if (form.type === 'VENDA') {
      Object.assign(base, {
        pricePerUnit: n(form.pricePerUnit),
        priceUnit: form.priceUnit,
      });
    } else if (form.type === 'COMPRA') {
      const installTotal = form.isInstallment && Number(form.installmentCount) > 0 && Number(form.installmentValue) > 0
        ? Number(form.installmentCount) * Number(form.installmentValue)
        : undefined;
      Object.assign(base, {
        quantity: n(form.quantity),
        totalValue: installTotal ?? n(form.totalValue),
        installmentCount: form.isInstallment ? n(form.installmentCount) : undefined,
        installmentValue: form.isInstallment ? n(form.installmentValue) : undefined,
      });
    } else if (form.type === 'ABATE') {
      Object.assign(base, {
        liveWeightPricePerKg: n(form.liveWeightPricePerKg),
        carcassYieldPercent: n(form.carcassYieldPercent),
        slaughterFrequency: form.slaughterFrequency,
        funruralPercent: n(form.funruralPercent),
        senarPercent: n(form.senarPercent),
      });
    } else if (form.type === 'VENDA_GRAO') {
      const moisture = Number(form.grainMoisturePercent) || 0;
      const moistureBase = Number(form.grainMoistureBasePercent) || 14;
      const impurity = Number(form.grainImpurityPercent) || 0;
      const grossWt = Number(form.grainGrossWeightKg) || 0;
      const moistureDiscount = moisture > moistureBase ? (moisture - moistureBase) / 100 : 0;
      const netWeight = grossWt > 0 ? grossWt * (1 - moistureDiscount) * (1 - impurity / 100) : 0;

      Object.assign(base, {
        grainCrop: form.grainCrop,
        grainQuantity: n(form.grainQuantity),
        grainUnit: form.grainUnit,
        pricePerUnit: n(form.pricePerUnit),
        priceUnit: form.grainUnit,
        grainMoisturePercent: n(form.grainMoisturePercent),
        grainMoistureBasePercent: n(form.grainMoistureBasePercent),
        grainImpurityPercent: n(form.grainImpurityPercent),
        grainMoistureDiscount: moistureDiscount > 0 ? Number((moistureDiscount * 100).toFixed(2)) : undefined,
        grainGrossWeightKg: n(form.grainGrossWeightKg),
        grainNetWeightKg: netWeight > 0 ? Number(netWeight.toFixed(1)) : undefined,
        grainSaleModality: form.grainSaleModality || undefined,
        grainWarehouse: form.grainWarehouse || undefined,
        grainTicketRef: form.grainTicketRef || undefined,
        cropCycleId: form.cropCycleId || undefined,
        funruralPercent: n(form.funruralPercent),
        senarPercent: n(form.senarPercent),
        totalValue: n(form.totalValue),
        installmentCount: form.isInstallment ? n(form.installmentCount) : undefined,
        installmentValue: form.isInstallment ? n(form.installmentValue) : undefined,
      });
    }

    if (editingDeal) {
      updateDeal.mutate({ id: editingDeal.id, body: base });
    } else {
      createDeal.mutate(base);
    }
  };

  const handleLongPress = (deal: Deal) => {
    haptic('warning');
    Alert.alert('Excluir negócio', 'Essa ação não pode ser desfeita.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => deleteDeal.mutate(deal.id) },
    ]);
  };

  const handleFinalize = (deal: Deal) => {
    haptic('light');
    changeStatus.mutate({ id: deal.id, status: 'FINALIZADO' });
  };

  const handleCancel = (deal: Deal) => {
    haptic('light');
    Alert.alert('Cancelar negócio', 'Deseja marcar como cancelado?', [
      { text: 'Voltar', style: 'cancel' },
      { text: 'Cancelar negócio', style: 'destructive', onPress: () => changeStatus.mutate({ id: deal.id, status: 'CANCELADO' }) },
    ]);
  };

  const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  const isSaving = createDeal.isPending || updateDeal.isPending;
  const setF = (patch: Partial<DealForm>) => setForm((f) => ({ ...f, ...patch }));

  if (isLoading) {
    return <View style={s.center}><ActivityIndicator size="large" color={theme.colors.primary} /></View>;
  }

  return (
    <View style={s.container}>
      {/* Filters */}
      <View style={s.filterSection}>
        <View style={s.filterHeaderRow}>
          <Text style={s.filterHeaderText}>Filtros</Text>
          {activeFilterCount > 0 && (
            <View style={s.filterBadge}><Text style={s.filterBadgeText}>{activeFilterCount}</Text></View>
          )}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
          <TouchableOpacity style={[s.filterChip, typeFilter === 'TODOS' && s.filterChipActive]} onPress={() => setTypeFilter('TODOS')}>
            <Text style={[s.filterChipText, typeFilter === 'TODOS' && s.filterChipTextActive]}>Todos</Text>
          </TouchableOpacity>
          {DEAL_TYPES.map((t: DealType) => (
            <TouchableOpacity key={t} style={[s.filterChip, typeFilter === t && s.filterChipActive]} onPress={() => setTypeFilter(t)}>
              <Text style={[s.filterChipText, typeFilter === t && s.filterChipTextActive]}>{DEAL_TYPE_LABEL[t]}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
          <TouchableOpacity style={[s.filterChip, statusFilter === 'TODOS' && s.filterChipActive]} onPress={() => setStatusFilter('TODOS')}>
            <Text style={[s.filterChipText, statusFilter === 'TODOS' && s.filterChipTextActive]}>Todos status</Text>
          </TouchableOpacity>
          {DEAL_STATUSES.map((st: DealStatus) => (
            <TouchableOpacity key={st} style={[s.filterChip, statusFilter === st && s.filterChipActive]} onPress={() => setStatusFilter(st)}>
              <Text style={[s.filterChipText, statusFilter === st && s.filterChipTextActive]}>{DEAL_STATUS_LABEL[st]}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Summary */}
      <View style={s.summaryBanner}>
        <View>
          <Text style={s.summaryLabel}>Negócios</Text>
          <Text style={s.summaryValue}>{summary.total}</Text>
        </View>
        <View style={s.summaryDivider} />
        <View>
          <Text style={s.summaryLabel}>Valor total</Text>
          <Text style={s.summaryValue}>{fmt(summary.totalValue)}</Text>
        </View>
      </View>

      {!filteredDeals.length ? (
        <EmptyState icon="🤝" title="Nenhum negócio" subtitle="Toque no + para registrar" />
      ) : (
        <FlatList
          data={filteredDeals}
          keyExtractor={(d: Deal) => d.id}
          contentContainerStyle={{ padding: 16, paddingTop: 8 }}
          onRefresh={refetch}
          refreshing={isRefetching}
          renderItem={({ item, index }: { item: Deal; index: number }) => (
            <Animated.View entering={FadeInDown.delay(index * 60).duration(400)}>
              <TouchableOpacity style={s.card} activeOpacity={0.85}
                onPress={() => router.push(`/(app)/fazendas/${farmId}/negocios/${item.id}` as any)}
                onLongPress={() => handleLongPress(item)}
              >
                <View style={s.row}>
                  <View style={[s.typeBadge, { backgroundColor: DEAL_TYPE_COLOR[item.type] + '22' }]}>
                    <Text style={[s.typeBadgeText, { color: DEAL_TYPE_COLOR[item.type] }]}>{DEAL_TYPE_LABEL[item.type]}</Text>
                  </View>
                  <View style={[s.statusBadge, { backgroundColor: DEAL_STATUS_BG[item.status] + '22' }]}>
                    <Text style={[s.statusBadgeText, { color: DEAL_STATUS_BG[item.status] }]}>{DEAL_STATUS_LABEL[item.status]}</Text>
                  </View>
                </View>
                <Text style={s.date}>{fmtDate(item.dealDate)}</Text>
                {item.counterparty && <Text style={s.counterpart}>{item.counterparty}</Text>}
                <View style={s.row}>
                  <Text style={s.value}>{item.totalValue != null ? fmt(item.totalValue) : '—'}</Text>
                  {item.items?.length ? <Text style={s.itemsCount}>{item.items.length} item(ns)</Text> : null}
                </View>
                {item.status === 'RASCUNHO' && (
                  <View style={s.actionsRow}>
                    <TouchableOpacity style={s.actionBtn} onPress={() => handleFinalize(item)}>
                      <Ionicons name="checkmark-circle-outline" size={16} color={theme.colors.success} />
                      <Text style={[s.actionText, { color: theme.colors.success }]}>Finalizar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.actionBtn} onPress={() => handleCancel(item)}>
                      <Ionicons name="close-circle-outline" size={16} color={theme.colors.danger} />
                      <Text style={[s.actionText, { color: theme.colors.danger }]}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.actionBtn} onPress={() => openEditForm(item)}>
                      <Ionicons name="create-outline" size={16} color={theme.colors.info} />
                      <Text style={[s.actionText, { color: theme.colors.info }]}>Editar</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
            </Animated.View>
          )}
        />
      )}

      {/* FAB */}
      <TouchableOpacity style={s.fab} onPress={openCreateForm} activeOpacity={0.8}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Modal Form */}
      <Modal visible={showForm} transparent animationType="slide" onRequestClose={closeForm}>
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={{ flex: 1 }} onPress={closeForm} activeOpacity={1} />
          <RNAnimated.View style={[s.modalContent, { transform: [{ translateY: panY }] }]}>
            <View {...panResponder.panHandlers} style={s.handleArea}>
              <View style={s.handleBar} />
            </View>
            <Text style={s.modalTitle}>{editingDeal ? 'Editar negócio' : 'Novo negócio'}</Text>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Tipo */}
              <Text style={s.label}>Tipo *</Text>
              <View style={s.chipRow}>
                {DEAL_TYPES.map((t: DealType) => (
                  <TouchableOpacity key={t} style={[s.chip, form.type === t && s.chipActive]} onPress={() => setF({ type: t })}>
                    <Text style={[s.chipText, form.type === t && s.chipTextActive]}>{DEAL_TYPE_LABEL[t]}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Data + Contraparte (comum) */}
              <DateInput label="Data *" value={form.dealDate} onChange={(v) => setF({ dealDate: v })} />

              <Text style={s.label}>{form.type === 'ABATE' ? 'Frigorífico' : 'Contraparte'}</Text>
              <TextInput style={s.input} value={form.counterparty}
                onChangeText={(v) => setF({ counterparty: v })}
                placeholder={form.type === 'ABATE' ? 'Nome do frigorífico' : 'Comprador/vendedor'}
                placeholderTextColor={theme.colors.textFaint}
              />

              {/* ========== VENDA ========== */}
              {form.type === 'VENDA' && (
                <>
                  <Text style={s.sectionHeader}>Precificação</Text>
                  <Text style={s.label}>Preço por</Text>
                  <View style={s.chipRow}>
                    {(['ARROBA', 'ANIMAL'] as const).map((u: string) => (
                      <TouchableOpacity key={u} style={[s.chip, form.priceUnit === u && s.chipActive]} onPress={() => setF({ priceUnit: u })}>
                        <Text style={[s.chipText, form.priceUnit === u && s.chipTextActive]}>{u === 'ARROBA' ? 'Arroba (@)' : 'Animal'}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={s.label}>Valor (R$/{form.priceUnit === 'ARROBA' ? '@' : 'cab.'})</Text>
                  <TextInput style={s.input} value={form.pricePerUnit} onChangeText={(v) => setF({ pricePerUnit: v })}
                    placeholder="0,00" keyboardType="numeric" placeholderTextColor={theme.colors.textFaint} />
                </>
              )}

              {/* ========== COMPRA ========== */}
              {form.type === 'COMPRA' && (
                <>
                  <Text style={s.sectionHeader}>Dados da compra</Text>
                  <Text style={s.label}>Quantidade de animais</Text>
                  <TextInput style={s.input} value={form.quantity} onChangeText={(v) => setF({ quantity: v })}
                    placeholder="0" keyboardType="numeric" placeholderTextColor={theme.colors.textFaint} />

                  <View style={s.switchRow}>
                    <Text style={s.switchLabel}>Pagamento parcelado</Text>
                    <Switch value={form.isInstallment} onValueChange={(v) => setF({ isInstallment: v })}
                      trackColor={{ false: '#ddd', true: theme.colors.success }} thumbColor={form.isInstallment ? '#fff' : '#f4f3f4'} />
                  </View>

                  {form.isInstallment ? (
                    <>
                      <Text style={s.label}>Nº de parcelas</Text>
                      <TextInput style={s.input} value={form.installmentCount} onChangeText={(v) => setF({ installmentCount: v })}
                        placeholder="1" keyboardType="numeric" placeholderTextColor={theme.colors.textFaint} />
                      <Text style={s.label}>Valor da parcela (R$)</Text>
                      <TextInput style={s.input} value={form.installmentValue} onChangeText={(v) => setF({ installmentValue: v })}
                        placeholder="0,00" keyboardType="numeric" placeholderTextColor={theme.colors.textFaint} />
                      {Number(form.installmentCount) > 0 && Number(form.installmentValue) > 0 && (
                        <View style={s.calcCard}>
                          <Text style={s.calcLabel}>Valor total calculado</Text>
                          <Text style={s.calcValue}>{fmt(Number(form.installmentCount) * Number(form.installmentValue))}</Text>
                        </View>
                      )}
                    </>
                  ) : (
                    <>
                      <Text style={s.label}>Valor total (R$)</Text>
                      <TextInput style={s.input} value={form.totalValue} onChangeText={(v) => setF({ totalValue: v })}
                        placeholder="0,00" keyboardType="numeric" placeholderTextColor={theme.colors.textFaint} />
                    </>
                  )}
                </>
              )}

              {/* ========== ABATE ========== */}
              {form.type === 'ABATE' && (
                <>
                  <Text style={s.sectionHeader}>Dados do abate</Text>
                  <Text style={s.label}>Valor do kg vivo (R$)</Text>
                  <TextInput style={s.input} value={form.liveWeightPricePerKg} onChangeText={(v) => setF({ liveWeightPricePerKg: v })}
                    placeholder="0,00" keyboardType="numeric" placeholderTextColor={theme.colors.textFaint} />
                  <Text style={s.label}>Rendimento de carcaça (%)</Text>
                  <TextInput style={s.input} value={form.carcassYieldPercent} onChangeText={(v) => setF({ carcassYieldPercent: v })}
                    placeholder="52" keyboardType="numeric" placeholderTextColor={theme.colors.textFaint} />
                  <Text style={s.label}>Frequência</Text>
                  <View style={s.chipRow}>
                    {SLAUGHTER_FREQ.map((f: string) => (
                      <TouchableOpacity key={f} style={[s.chip, form.slaughterFrequency === f && s.chipActive]} onPress={() => setF({ slaughterFrequency: f })}>
                        <Text style={[s.chipText, form.slaughterFrequency === f && s.chipTextActive]}>{f === 'TRIMESTRAL' ? 'Trimestral' : 'Semestral'}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={s.sectionHeader}>Deduções</Text>
                  <Text style={s.label}>Funrural (%)</Text>
                  <TextInput style={s.input} value={form.funruralPercent} onChangeText={(v) => setF({ funruralPercent: v })}
                    placeholder="1.5" keyboardType="numeric" placeholderTextColor={theme.colors.textFaint} />
                  <Text style={s.label}>SENAR (%)</Text>
                  <TextInput style={s.input} value={form.senarPercent} onChangeText={(v) => setF({ senarPercent: v })}
                    placeholder="0.2" keyboardType="numeric" placeholderTextColor={theme.colors.textFaint} />
                </>
              )}

              {/* ========== VENDA_GRAO ========== */}
              {form.type === 'VENDA_GRAO' && (
                <>
                  <Text style={s.sectionHeader}>Dados do grão</Text>
                  <Text style={s.label}>Cultura</Text>
                  <View style={s.chipRow}>
                    {GRAIN_CROPS.map((c: string) => (
                      <TouchableOpacity key={c} style={[s.chip, form.grainCrop === c && s.chipActive]}
                        onPress={() => {
                          const base = c === 'Milho' ? '13' : '14';
                          setF({ grainCrop: c, grainMoistureBasePercent: base });
                        }}>
                        <Text style={[s.chipText, form.grainCrop === c && s.chipTextActive]}>{c}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={s.label}>Quantidade *</Text>
                  <TextInput style={s.input} value={form.grainQuantity} onChangeText={(v) => setF({ grainQuantity: v })}
                    placeholder="0" keyboardType="numeric" placeholderTextColor={theme.colors.textFaint} />
                  <Text style={s.label}>Unidade</Text>
                  <View style={s.chipRow}>
                    {GRAIN_UNITS.map((u: string) => (
                      <TouchableOpacity key={u} style={[s.chip, form.grainUnit === u && s.chipActive]} onPress={() => setF({ grainUnit: u })}>
                        <Text style={[s.chipText, form.grainUnit === u && s.chipTextActive]}>{GRAIN_UNIT_LABEL[u]}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={s.label}>Preço por unidade (R$)</Text>
                  <TextInput style={s.input} value={form.pricePerUnit} onChangeText={(v) => setF({ pricePerUnit: v })}
                    placeholder="0,00" keyboardType="numeric" placeholderTextColor={theme.colors.textFaint} />

                  <Text style={s.sectionHeader}>Classificação</Text>
                  <View style={s.rowFields}>
                    <View style={s.halfField}>
                      <Text style={s.label}>Umidade aferida (%)</Text>
                      <TextInput style={s.input} value={form.grainMoisturePercent} onChangeText={(v) => setF({ grainMoisturePercent: v })}
                        placeholder="14" keyboardType="numeric" placeholderTextColor={theme.colors.textFaint} />
                    </View>
                    <View style={s.halfField}>
                      <Text style={s.label}>Umidade base (%)</Text>
                      <TextInput style={s.input} value={form.grainMoistureBasePercent} onChangeText={(v) => setF({ grainMoistureBasePercent: v })}
                        placeholder="14" keyboardType="numeric" placeholderTextColor={theme.colors.textFaint} />
                    </View>
                  </View>
                  <View style={s.rowFields}>
                    <View style={s.halfField}>
                      <Text style={s.label}>Impureza (%)</Text>
                      <TextInput style={s.input} value={form.grainImpurityPercent} onChangeText={(v) => setF({ grainImpurityPercent: v })}
                        placeholder="0" keyboardType="numeric" placeholderTextColor={theme.colors.textFaint} />
                    </View>
                    <View style={s.halfField}>
                      <Text style={s.label}>Peso bruto (kg)</Text>
                      <TextInput style={s.input} value={form.grainGrossWeightKg} onChangeText={(v) => setF({ grainGrossWeightKg: v })}
                        placeholder="0" keyboardType="numeric" placeholderTextColor={theme.colors.textFaint} />
                    </View>
                  </View>

                  <Text style={s.sectionHeader}>Logística</Text>
                  <Text style={s.label}>Modalidade</Text>
                  <View style={s.chipRow}>
                    {GRAIN_MODALITIES.map((m: string) => (
                      <TouchableOpacity key={m} style={[s.chip, form.grainSaleModality === m && s.chipActive]} onPress={() => setF({ grainSaleModality: m })}>
                        <Text style={[s.chipText, form.grainSaleModality === m && s.chipTextActive]}>{GRAIN_MOD_LABEL[m]}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={s.label}>Armazém/Silo</Text>
                  <TextInput style={s.input} value={form.grainWarehouse} onChangeText={(v) => setF({ grainWarehouse: v })}
                    placeholder="Nome do armazém" placeholderTextColor={theme.colors.textFaint} />
                  <Text style={s.label}>Placa/Ticket</Text>
                  <TextInput style={s.input} value={form.grainTicketRef} onChangeText={(v) => setF({ grainTicketRef: v })}
                    placeholder="Placa ou ticket" placeholderTextColor={theme.colors.textFaint} />

                  {cropCycles && cropCycles.length > 0 && (
                    <>
                      <Text style={s.label}>Safra vinculada</Text>
                      <View style={s.chipRow}>
                        <TouchableOpacity style={[s.chip, !form.cropCycleId && s.chipActive]} onPress={() => setF({ cropCycleId: '' })}>
                          <Text style={[s.chipText, !form.cropCycleId && s.chipTextActive]}>Nenhuma</Text>
                        </TouchableOpacity>
                        {cropCycles.map((cc: CropCycle) => (
                          <TouchableOpacity key={cc.id} style={[s.chip, form.cropCycleId === cc.id && s.chipActive]} onPress={() => setF({ cropCycleId: cc.id })}>
                            <Text style={[s.chipText, form.cropCycleId === cc.id && s.chipTextActive]}>
                              {cc.cropName}{cc.variety ? ` (${cc.variety})` : ''}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  )}

                  <Text style={s.label}>Valor total (R$)</Text>
                  <TextInput style={s.input} value={form.totalValue} onChangeText={(v) => setF({ totalValue: v })}
                    placeholder="Calculado automaticamente" keyboardType="numeric" placeholderTextColor={theme.colors.textFaint} />

                  <View style={s.switchRow}>
                    <Text style={s.switchLabel}>Pagamento parcelado</Text>
                    <Switch value={form.isInstallment} onValueChange={(v) => setF({ isInstallment: v })}
                      trackColor={{ false: '#ddd', true: theme.colors.success }} thumbColor={form.isInstallment ? '#fff' : '#f4f3f4'} />
                  </View>
                  {form.isInstallment && (
                    <View style={s.rowFields}>
                      <View style={s.halfField}>
                        <Text style={s.label}>Nº parcelas</Text>
                        <TextInput style={s.input} value={form.installmentCount} onChangeText={(v) => setF({ installmentCount: v })}
                          placeholder="1" keyboardType="numeric" placeholderTextColor={theme.colors.textFaint} />
                      </View>
                      <View style={s.halfField}>
                        <Text style={s.label}>Valor parcela (R$)</Text>
                        <TextInput style={s.input} value={form.installmentValue} onChangeText={(v) => setF({ installmentValue: v })}
                          placeholder="0,00" keyboardType="numeric" placeholderTextColor={theme.colors.textFaint} />
                      </View>
                    </View>
                  )}

                  <Text style={s.sectionHeader}>Deduções</Text>
                  <View style={s.rowFields}>
                    <View style={s.halfField}>
                      <Text style={s.label}>Funrural (%)</Text>
                      <TextInput style={s.input} value={form.funruralPercent} onChangeText={(v) => setF({ funruralPercent: v })}
                        placeholder="1.5" keyboardType="numeric" placeholderTextColor={theme.colors.textFaint} />
                    </View>
                    <View style={s.halfField}>
                      <Text style={s.label}>SENAR (%)</Text>
                      <TextInput style={s.input} value={form.senarPercent} onChangeText={(v) => setF({ senarPercent: v })}
                        placeholder="0.2" keyboardType="numeric" placeholderTextColor={theme.colors.textFaint} />
                    </View>
                  </View>
                </>
              )}

              {/* Frete + Comissão (comum) */}
              <Text style={s.sectionHeader}>Custos adicionais</Text>
              <View style={s.rowFields}>
                <View style={s.halfField}>
                  <Text style={s.label}>Frete total (R$)</Text>
                  <TextInput style={s.input} value={form.freightCost} onChangeText={(v) => setF({ freightCost: v })}
                    placeholder="0,00" keyboardType="numeric" placeholderTextColor={theme.colors.textFaint} />
                </View>
                <View style={s.halfField}>
                  <Text style={s.label}>Comissão (%)</Text>
                  <TextInput style={s.input} value={form.commissionPercent} onChangeText={(v) => setF({ commissionPercent: v })}
                    placeholder="0" keyboardType="numeric" placeholderTextColor={theme.colors.textFaint} />
                </View>
              </View>

              {/* Observações */}
              <Text style={s.label}>Observações</Text>
              <TextInput style={[s.input, { height: 72, textAlignVertical: 'top' }]} value={form.notes}
                onChangeText={(v) => setF({ notes: v })} placeholder="Anotações" multiline placeholderTextColor={theme.colors.textFaint} />

              <TouchableOpacity style={s.submitBtn} onPress={handleSubmit} disabled={isSaving}>
                {isSaving ? <ActivityIndicator color="#fff" /> : (
                  <Text style={s.submitText}>{editingDeal ? 'Salvar alterações' : 'Salvar'}</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </RNAnimated.View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  filterSection: { paddingTop: 12, paddingHorizontal: 16 },
  filterHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  filterHeaderText: { fontSize: 13, fontWeight: '700', color: theme.colors.textMuted },
  filterBadge: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: theme.colors.primary, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  filterBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  filterRow: { gap: 8, paddingBottom: 8 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  filterChipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  filterChipText: { fontSize: 12, fontWeight: '600', color: theme.colors.textMuted },
  filterChipTextActive: { color: '#fff' },

  summaryBanner: { flexDirection: 'row', backgroundColor: theme.colors.surface, marginHorizontal: 16, marginTop: 4, marginBottom: 4, borderRadius: theme.radius.md, padding: 14, ...theme.shadow.card },
  summaryLabel: { fontSize: 12, color: theme.colors.textMuted, marginBottom: 2 },
  summaryValue: { fontSize: 18, fontWeight: '700', color: theme.colors.text },
  summaryDivider: { width: 1, backgroundColor: theme.colors.border, marginHorizontal: 20 },

  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: 14, marginBottom: 10, ...theme.shadow.card },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  typeBadgeText: { fontSize: 12, fontWeight: '700' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
  date: { fontSize: 13, color: theme.colors.textMuted, marginBottom: 2 },
  counterpart: { fontSize: 14, fontWeight: '600', color: theme.colors.text, marginBottom: 4 },
  value: { fontSize: 16, fontWeight: '700', color: theme.colors.primary },
  itemsCount: { fontSize: 12, color: theme.colors.textMuted },

  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 10, borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: 10 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: theme.colors.bg },
  actionText: { fontSize: 12, fontWeight: '700' },

  fab: { position: 'absolute', bottom: 24, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.primary, justifyContent: 'center', alignItems: 'center', ...theme.shadow.fab },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(16,24,40,0.55)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: theme.colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '90%' },
  handleArea: { paddingVertical: 12, alignItems: 'center' },
  handleBar: { width: 40, height: 4, borderRadius: 2, backgroundColor: theme.colors.border },
  modalTitle: { fontSize: 20, fontWeight: '700', color: theme.colors.text, marginBottom: 20 },

  sectionHeader: { fontSize: 14, fontWeight: '700', color: theme.colors.primary, marginTop: 20, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: theme.colors.border, paddingBottom: 6 },

  label: { fontSize: 14, fontWeight: '600', color: theme.colors.text, marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.sm, padding: 12, fontSize: 15, color: theme.colors.text, backgroundColor: theme.colors.bg },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.bg },
  chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: theme.colors.textMuted },
  chipTextActive: { color: '#fff' },

  rowFields: { flexDirection: 'row', gap: 12 },
  halfField: { flex: 1 },

  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingVertical: 4 },
  switchLabel: { fontSize: 14, fontWeight: '600', color: theme.colors.text },

  calcCard: { backgroundColor: theme.colors.bg, borderRadius: theme.radius.sm, padding: 12, marginTop: 8, borderWidth: 1, borderColor: theme.colors.border },
  calcLabel: { fontSize: 12, color: theme.colors.textMuted, marginBottom: 2 },
  calcValue: { fontSize: 16, fontWeight: '700', color: theme.colors.primary },

  submitBtn: { backgroundColor: theme.colors.primary, borderRadius: theme.radius.sm, padding: 16, alignItems: 'center', marginTop: 24, marginBottom: 16 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
