import { useState } from 'react';
import { DateInput } from '../../../../../src/components/DateInput';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../../../../src/lib/api';
import { toApiDate, todayInput } from '../../../../../src/lib/dates';
import { theme } from '../../../../../src/lib/theme';
import type {
  CropCycle,
  CropCycleStatus,
  CropCostEntry,
  CropCostCategory,
  CropApplication,
  CropApplicationType,
  CropClosing,
  PlantingCalcResult,
} from '../../../../../src/lib/types';

const today = todayInput;

const STATUS_INFO: Record<CropCycleStatus, { label: string; color: string; bg: string }> = {
  PLANEJADA: { label: 'Planejada', color: theme.colors.info, bg: '#EAF4FF' },
  PLANTADA: { label: 'Plantada', color: theme.colors.warning, bg: '#FEF3E2' },
  COLHIDA: { label: 'Colhida', color: theme.colors.success, bg: '#E7F8EF' },
};

const COST_CATEGORIES: { value: CropCostCategory; label: string }[] = [
  { value: 'SEMENTE', label: 'Semente' },
  { value: 'FERTILIZANTE', label: 'Fertilizante' },
  { value: 'DEFENSIVO', label: 'Defensivo' },
  { value: 'CALCARIO', label: 'Calcário' },
  { value: 'OPERACAO', label: 'Operação' },
  { value: 'MAO_DE_OBRA', label: 'Mão de obra' },
  { value: 'ARRENDAMENTO', label: 'Arrendamento' },
  { value: 'OUTRO', label: 'Outro' },
];

const APPLICATION_TYPES: { value: CropApplicationType; label: string }[] = [
  { value: 'PLANTIO', label: 'Plantio' },
  { value: 'ADUBACAO', label: 'Adubação' },
  { value: 'CALAGEM', label: 'Calagem' },
  { value: 'HERBICIDA', label: 'Herbicida' },
  { value: 'FUNGICIDA', label: 'Fungicida' },
  { value: 'INSETICIDA', label: 'Inseticida' },
  { value: 'DEFENSIVO', label: 'Defensivo' },
  { value: 'IRRIGACAO', label: 'Irrigação' },
  { value: 'OUTRO', label: 'Outro' },
];

function fmtDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

function fmtMoney(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtNumber(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined) return '—';
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: digits });
}

export default function CropCycleDetailScreen() {
  const { farmId, cropId } = useLocalSearchParams<{ farmId: string; cropId: string }>();
  const qc = useQueryClient();

  const { data: crop, isLoading: loadingCrop } = useQuery({
    queryKey: ['crop-cycle', farmId, cropId],
    queryFn: () => apiFetch<CropCycle>(`/fazendas/${farmId}/safras/${cropId}`),
    enabled: !!farmId && !!cropId,
  });

  const { data: closing, isLoading: loadingClosing } = useQuery({
    queryKey: ['crop-closing', farmId, cropId],
    queryFn: () => apiFetch<CropClosing>(`/fazendas/${farmId}/safras/${cropId}/fechamento`),
    enabled: !!farmId && !!cropId,
  });

  const { data: costs, isLoading: loadingCosts } = useQuery({
    queryKey: ['crop-costs', farmId, cropId],
    queryFn: () => apiFetch<CropCostEntry[]>(`/fazendas/${farmId}/safras/${cropId}/custos`),
    enabled: !!farmId && !!cropId,
  });

  const { data: applications, isLoading: loadingApplications } = useQuery({
    queryKey: ['crop-applications', farmId, cropId],
    queryFn: () => apiFetch<CropApplication[]>(`/fazendas/${farmId}/safras/${cropId}/aplicacoes`),
    enabled: !!farmId && !!cropId,
  });

  // ---- delete crop cycle ----
  const deleteCrop = useMutation({
    mutationFn: () => apiFetch(`/fazendas/${farmId}/safras/${cropId}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crops', farmId] });
      router.back();
    },
    onError: (e: any) => Alert.alert('Erro', e.message),
  });

  const handleDeleteCrop = () => {
    Alert.alert('Excluir safra', 'Tem certeza que deseja excluir esta safra? Esta ação não pode ser desfeita.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          deleteCrop.mutate();
        },
      },
    ]);
  };

  // ---- cost form ----
  const [showCostForm, setShowCostForm] = useState(false);
  const [costForm, setCostForm] = useState({
    category: 'SEMENTE' as CropCostCategory,
    description: '',
    amount: '',
    incurredAt: today(),
  });

  const createCost = useMutation({
    mutationFn: (body: any) => apiFetch(`/fazendas/${farmId}/safras/${cropId}/custos`, { method: 'POST', body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crop-costs', farmId, cropId] });
      qc.invalidateQueries({ queryKey: ['crop-closing', farmId, cropId] });
      setShowCostForm(false);
      setCostForm({ category: 'SEMENTE', description: '', amount: '', incurredAt: today() });
    },
    onError: (e: any) => Alert.alert('Erro', e.message),
  });

  const handleSubmitCost = () => {
    if (!costForm.description || !costForm.amount) {
      return Alert.alert('Erro', 'Descrição e valor são obrigatórios');
    }
    createCost.mutate({
      category: costForm.category,
      description: costForm.description,
      amount: Number(costForm.amount),
      incurredAt: toApiDate(costForm.incurredAt),
    });
  };

  const deleteCost = useMutation({
    mutationFn: (costId: string) =>
      apiFetch(`/fazendas/${farmId}/safras/${cropId}/custos/${costId}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crop-costs', farmId, cropId] });
      qc.invalidateQueries({ queryKey: ['crop-closing', farmId, cropId] });
    },
    onError: (e: any) => Alert.alert('Erro', e.message),
  });

  const handleDeleteCost = (id: string) => {
    Alert.alert('Excluir custo', 'Deseja excluir este lançamento de custo?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => deleteCost.mutate(id) },
    ]);
  };

  // ---- application form ----
  const [showAppForm, setShowAppForm] = useState(false);
  const [appForm, setAppForm] = useState({
    type: 'ADUBACAO' as CropApplicationType,
    product: '',
    dosePerHa: '',
    doseUnit: '',
    totalQuantity: '',
    appliedAt: today(),
    responsible: '',
    notes: '',
  });

  const createApplication = useMutation({
    mutationFn: (body: any) => apiFetch(`/fazendas/${farmId}/safras/${cropId}/aplicacoes`, { method: 'POST', body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crop-applications', farmId, cropId] });
      setShowAppForm(false);
      setAppForm({
        type: 'ADUBACAO',
        product: '',
        dosePerHa: '',
        doseUnit: '',
        totalQuantity: '',
        appliedAt: today(),
        responsible: '',
        notes: '',
      });
    },
    onError: (e: any) => Alert.alert('Erro', e.message),
  });

  const handleSubmitApp = () => {
    if (!appForm.product || !appForm.appliedAt) {
      return Alert.alert('Erro', 'Produto e data de aplicação são obrigatórios');
    }
    createApplication.mutate({
      type: appForm.type,
      product: appForm.product,
      dosePerHa: appForm.dosePerHa ? Number(appForm.dosePerHa) : undefined,
      doseUnit: appForm.doseUnit || undefined,
      totalQuantity: appForm.totalQuantity ? Number(appForm.totalQuantity) : undefined,
      appliedAt: toApiDate(appForm.appliedAt),
      responsible: appForm.responsible || undefined,
      notes: appForm.notes || undefined,
    });
  };

  const deleteApplication = useMutation({
    mutationFn: (appId: string) =>
      apiFetch(`/fazendas/${farmId}/safras/${cropId}/aplicacoes/${appId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crop-applications', farmId, cropId] }),
    onError: (e: any) => Alert.alert('Erro', e.message),
  });

  const handleDeleteApplication = (id: string) => {
    Alert.alert('Excluir aplicação', 'Deseja excluir este registro do caderno de campo?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => deleteApplication.mutate(id) },
    ]);
  };

  // ---- planting calculator ----
  const [calcSeedPrice, setCalcSeedPrice] = useState('');
  const [calcFertPrice, setCalcFertPrice] = useState('');
  const [calcResult, setCalcResult] = useState<PlantingCalcResult | null>(null);

  const calcMutation = useMutation({
    mutationFn: (body: any) =>
      apiFetch<PlantingCalcResult>(`/fazendas/${farmId}/safras/calculadora-plantio`, { method: 'POST', body }),
    onSuccess: (result: PlantingCalcResult) => setCalcResult(result),
    onError: (e: any) => Alert.alert('Erro', e.message),
  });

  const handleCalculate = () => {
    if (!crop) return;
    calcMutation.mutate({
      cropName: crop.cropName,
      areaHectares: crop.areaHectares ?? 0,
      seedPricePerKg: calcSeedPrice ? Number(calcSeedPrice) : undefined,
      fertilizerPricePerKg: calcFertPrice ? Number(calcFertPrice) : undefined,
    });
  };

  if (loadingCrop || !crop) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const statusInfo = STATUS_INFO[crop.status as CropCycleStatus];
  const profit = closing?.result?.profit ?? null;
  const profitColor = profit === null ? theme.colors.text : profit >= 0 ? theme.colors.success : theme.colors.danger;

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
      {/* Header */}
      <Animated.View entering={FadeInDown.duration(400)} style={s.card}>
        <View style={s.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>{crop.cropName}</Text>
            {crop.variety ? <Text style={s.subtitle}>{crop.variety}</Text> : null}
          </View>
          <TouchableOpacity style={s.deleteBtn} onPress={handleDeleteCrop} disabled={deleteCrop.isPending}>
            <Ionicons name="trash-outline" size={20} color={theme.colors.danger} />
          </TouchableOpacity>
        </View>

        <View style={[s.statusBadge, { backgroundColor: statusInfo.bg }]}>
          <Text style={[s.statusBadgeText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
        </View>

        <View style={s.infoGrid}>
          <View style={s.infoItem}>
            <Text style={s.infoLabel}>Área</Text>
            <Text style={s.infoValue}>{crop.areaHectares ? `${fmtNumber(crop.areaHectares)} ha` : '—'}</Text>
          </View>
          <View style={s.infoItem}>
            <Text style={s.infoLabel}>Plantio</Text>
            <Text style={s.infoValue}>{fmtDate(crop.plantedAt)}</Text>
          </View>
          <View style={s.infoItem}>
            <Text style={s.infoLabel}>Previsão colheita</Text>
            <Text style={s.infoValue}>{fmtDate(crop.expectedHarvestAt)}</Text>
          </View>
          <View style={s.infoItem}>
            <Text style={s.infoLabel}>Colheita real</Text>
            <Text style={s.infoValue}>{fmtDate(crop.harvestedAt)}</Text>
          </View>
        </View>
      </Animated.View>

      {/* Financial closing */}
      <Animated.View entering={FadeInDown.delay(60).duration(400)} style={s.card}>
        <Text style={s.sectionTitle}>Fechamento financeiro</Text>
        {loadingClosing ? (
          <ActivityIndicator color={theme.colors.primary} />
        ) : closing ? (
          <View>
            <View style={s.closingRow}>
              <Text style={s.closingLabel}>Produção</Text>
              <Text style={s.closingValue}>
                {closing.production.yieldKg !== null ? `${fmtNumber(closing.production.yieldKg)} kg` : '—'}
              </Text>
            </View>
            <View style={s.closingRow}>
              <Text style={s.closingLabel}>Produtividade / ha</Text>
              <Text style={s.closingValue}>
                {closing.production.productivityPerHa !== null
                  ? `${fmtNumber(closing.production.productivityPerHa, 2)} ${closing.unitLabel}/ha`
                  : '—'}
              </Text>
            </View>
            <View style={s.divider} />
            <View style={s.closingRow}>
              <Text style={s.closingLabel}>Custo total</Text>
              <Text style={s.closingValue}>{fmtMoney(closing.costs.total)}</Text>
            </View>
            <View style={s.closingRow}>
              <Text style={s.closingLabel}>Custo / ha</Text>
              <Text style={s.closingValue}>{fmtMoney(closing.costs.perHectare)}</Text>
            </View>
            <View style={s.closingRow}>
              <Text style={s.closingLabel}>Custo / {closing.unitLabel}</Text>
              <Text style={s.closingValue}>{fmtMoney(closing.costs.perUnit)}</Text>
            </View>
            <View style={s.divider} />
            <View style={s.closingRow}>
              <Text style={s.closingLabel}>Receita</Text>
              <Text style={s.closingValue}>{fmtMoney(closing.revenue.total)}</Text>
            </View>
            <View style={s.divider} />
            <View style={s.closingRow}>
              <Text style={s.closingLabelBold}>Lucro</Text>
              <Text style={[s.closingValueBold, { color: profitColor }]}>{fmtMoney(profit)}</Text>
            </View>
            <View style={s.closingRow}>
              <Text style={s.closingLabel}>Margem</Text>
              <Text style={[s.closingValue, { color: profitColor }]}>
                {closing.result.marginPercent !== null ? `${fmtNumber(closing.result.marginPercent, 1)}%` : '—'}
              </Text>
            </View>
          </View>
        ) : (
          <Text style={s.emptyText}>Sem dados de fechamento</Text>
        )}
      </Animated.View>

      {/* Costs */}
      <Animated.View entering={FadeInDown.delay(120).duration(400)} style={s.card}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Custos</Text>
          <TouchableOpacity
            style={s.addBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowCostForm(true);
            }}
          >
            <Ionicons name="add" size={18} color={theme.colors.primary} />
            <Text style={s.addBtnText}>Adicionar</Text>
          </TouchableOpacity>
        </View>

        {loadingCosts ? (
          <ActivityIndicator color={theme.colors.primary} />
        ) : !costs?.length ? (
          <Text style={s.emptyText}>Nenhum custo lançado</Text>
        ) : (
          costs.map((c: CropCostEntry) => (
            <View key={c.id} style={s.listRow}>
              <View style={{ flex: 1 }}>
                <View style={s.rowBetween}>
                  <Text style={s.categoryBadge}>
                    {COST_CATEGORIES.find((cat: { value: CropCostCategory; label: string }) => cat.value === c.category)?.label ?? c.category}
                  </Text>
                  <Text style={s.rowDate}>{fmtDate(c.incurredAt)}</Text>
                </View>
                <Text style={s.rowDescription}>{c.description}</Text>
              </View>
              <Text style={s.rowAmount}>{fmtMoney(c.amount)}</Text>
              <TouchableOpacity style={s.rowDelete} onPress={() => handleDeleteCost(c.id)}>
                <Ionicons name="close" size={16} color={theme.colors.textFaint} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </Animated.View>

      {/* Applications - Caderno de Campo */}
      <Animated.View entering={FadeInDown.delay(180).duration(400)} style={s.card}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Caderno de campo</Text>
          <TouchableOpacity
            style={s.addBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowAppForm(true);
            }}
          >
            <Ionicons name="add" size={18} color={theme.colors.primary} />
            <Text style={s.addBtnText}>Adicionar</Text>
          </TouchableOpacity>
        </View>

        {loadingApplications ? (
          <ActivityIndicator color={theme.colors.primary} />
        ) : !applications?.length ? (
          <Text style={s.emptyText}>Nenhuma aplicação registrada</Text>
        ) : (
          applications.map((a: CropApplication) => (
            <View key={a.id} style={s.listRow}>
              <View style={{ flex: 1 }}>
                <View style={s.rowBetween}>
                  <Text style={s.categoryBadge}>
                    {APPLICATION_TYPES.find((t: { value: CropApplicationType; label: string }) => t.value === a.type)?.label ?? a.type}
                  </Text>
                  <Text style={s.rowDate}>{fmtDate(a.appliedAt)}</Text>
                </View>
                <Text style={s.rowDescription}>{a.product}</Text>
                <Text style={s.rowMeta}>
                  {a.dosePerHa ? `${fmtNumber(a.dosePerHa, 2)} ${a.doseUnit ?? ''}/ha` : ''}
                  {a.responsible ? `  •  ${a.responsible}` : ''}
                </Text>
              </View>
              <TouchableOpacity style={s.rowDelete} onPress={() => handleDeleteApplication(a.id)}>
                <Ionicons name="close" size={16} color={theme.colors.textFaint} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </Animated.View>

      {/* Planting calculator */}
      <Animated.View entering={FadeInDown.delay(240).duration(400)} style={s.card}>
        <Text style={s.sectionTitle}>Calculadora de plantio</Text>

        <Text style={s.label}>Preço da semente (R$/kg)</Text>
        <TextInput
          style={s.input}
          value={calcSeedPrice}
          onChangeText={setCalcSeedPrice}
          placeholder="Opcional"
          keyboardType="numeric"
          placeholderTextColor={theme.colors.textFaint}
        />

        <Text style={s.label}>Preço do fertilizante (R$/kg)</Text>
        <TextInput
          style={s.input}
          value={calcFertPrice}
          onChangeText={setCalcFertPrice}
          placeholder="Opcional"
          keyboardType="numeric"
          placeholderTextColor={theme.colors.textFaint}
        />

        <TouchableOpacity style={s.calcBtn} onPress={handleCalculate} disabled={calcMutation.isPending}>
          {calcMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.calcBtnText}>Calcular</Text>
          )}
        </TouchableOpacity>

        {calcResult ? (
          <View style={s.calcResult}>
            <View style={s.closingRow}>
              <Text style={s.closingLabel}>Semente total</Text>
              <Text style={s.closingValue}>
                {calcResult.seedTotalKg !== null ? `${fmtNumber(calcResult.seedTotalKg, 2)} kg` : '—'}
              </Text>
            </View>
            <View style={s.closingRow}>
              <Text style={s.closingLabel}>Custo semente</Text>
              <Text style={s.closingValue}>{fmtMoney(calcResult.seedCost)}</Text>
            </View>
            <View style={s.closingRow}>
              <Text style={s.closingLabel}>Fertilizante total</Text>
              <Text style={s.closingValue}>
                {calcResult.fertilizerTotalKg !== null ? `${fmtNumber(calcResult.fertilizerTotalKg, 2)} kg` : '—'}
              </Text>
            </View>
            <View style={s.closingRow}>
              <Text style={s.closingLabel}>Custo fertilizante</Text>
              <Text style={s.closingValue}>{fmtMoney(calcResult.fertilizerCost)}</Text>
            </View>
            <View style={s.divider} />
            <View style={s.closingRow}>
              <Text style={s.closingLabelBold}>Custo total</Text>
              <Text style={s.closingValueBold}>{fmtMoney(calcResult.totalCost)}</Text>
            </View>
            <View style={s.closingRow}>
              <Text style={s.closingLabel}>Custo / ha</Text>
              <Text style={s.closingValue}>{fmtMoney(calcResult.costPerHa)}</Text>
            </View>
          </View>
        ) : null}
      </Animated.View>

      {/* Cost form modal */}
      <Modal visible={showCostForm} transparent animationType="slide" onRequestClose={() => setShowCostForm(false)}>
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowCostForm(false)} activeOpacity={1} />
          <View style={s.modalContent}>
            <View style={s.handleBar} />
            <Text style={s.modalTitle}>Novo custo</Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.label}>Categoria</Text>
              <View style={s.chipsRow}>
                {COST_CATEGORIES.map((cat: { value: CropCostCategory; label: string }) => (
                  <TouchableOpacity
                    key={cat.value}
                    style={[s.chip, costForm.category === cat.value && s.chipActive]}
                    onPress={() => setCostForm((f) => ({ ...f, category: cat.value }))}
                  >
                    <Text style={[s.chipText, costForm.category === cat.value && s.chipTextActive]}>{cat.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.label}>Descrição *</Text>
              <TextInput
                style={s.input}
                value={costForm.description}
                onChangeText={(v) => setCostForm((f) => ({ ...f, description: v }))}
                placeholder="Ex: Sacas de semente"
                placeholderTextColor={theme.colors.textFaint}
              />

              <Text style={s.label}>Valor (R$) *</Text>
              <TextInput
                style={s.input}
                value={costForm.amount}
                onChangeText={(v) => setCostForm((f) => ({ ...f, amount: v }))}
                placeholder="0,00"
                keyboardType="numeric"
                placeholderTextColor={theme.colors.textFaint}
              />

              <DateInput label="Data" value={costForm.incurredAt} onChange={(v) => setCostForm((f) => ({ ...f, incurredAt: v }))} />

              <TouchableOpacity style={s.submitBtn} onPress={handleSubmitCost} disabled={createCost.isPending}>
                {createCost.isPending ? <ActivityIndicator color="#fff" /> : <Text style={s.submitText}>Salvar</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Application form modal */}
      <Modal visible={showAppForm} transparent animationType="slide" onRequestClose={() => setShowAppForm(false)}>
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowAppForm(false)} activeOpacity={1} />
          <View style={s.modalContent}>
            <View style={s.handleBar} />
            <Text style={s.modalTitle}>Nova aplicação</Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.label}>Tipo</Text>
              <View style={s.chipsRow}>
                {APPLICATION_TYPES.map((t: { value: CropApplicationType; label: string }) => (
                  <TouchableOpacity
                    key={t.value}
                    style={[s.chip, appForm.type === t.value && s.chipActive]}
                    onPress={() => setAppForm((f) => ({ ...f, type: t.value }))}
                  >
                    <Text style={[s.chipText, appForm.type === t.value && s.chipTextActive]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.label}>Produto *</Text>
              <TextInput
                style={s.input}
                value={appForm.product}
                onChangeText={(v) => setAppForm((f) => ({ ...f, product: v }))}
                placeholder="Ex: Glifosato"
                placeholderTextColor={theme.colors.textFaint}
              />

              <Text style={s.label}>Dose / ha</Text>
              <TextInput
                style={s.input}
                value={appForm.dosePerHa}
                onChangeText={(v) => setAppForm((f) => ({ ...f, dosePerHa: v }))}
                placeholder="0"
                keyboardType="numeric"
                placeholderTextColor={theme.colors.textFaint}
              />

              <Text style={s.label}>Unidade da dose</Text>
              <TextInput
                style={s.input}
                value={appForm.doseUnit}
                onChangeText={(v) => setAppForm((f) => ({ ...f, doseUnit: v }))}
                placeholder="Ex: L, kg, mL"
                placeholderTextColor={theme.colors.textFaint}
              />

              <Text style={s.label}>Quantidade total</Text>
              <TextInput
                style={s.input}
                value={appForm.totalQuantity}
                onChangeText={(v) => setAppForm((f) => ({ ...f, totalQuantity: v }))}
                placeholder="0"
                keyboardType="numeric"
                placeholderTextColor={theme.colors.textFaint}
              />

              <DateInput label="Data da aplicação *" value={appForm.appliedAt} onChange={(v) => setAppForm((f) => ({ ...f, appliedAt: v }))} />

              <Text style={s.label}>Responsável</Text>
              <TextInput
                style={s.input}
                value={appForm.responsible}
                onChangeText={(v) => setAppForm((f) => ({ ...f, responsible: v }))}
                placeholder="Nome do responsável"
                placeholderTextColor={theme.colors.textFaint}
              />

              <Text style={s.label}>Observações</Text>
              <TextInput
                style={[s.input, { height: 72, textAlignVertical: 'top' }]}
                value={appForm.notes}
                onChangeText={(v) => setAppForm((f) => ({ ...f, notes: v }))}
                placeholder="Anotações"
                multiline
                placeholderTextColor={theme.colors.textFaint}
              />

              <TouchableOpacity style={s.submitBtn} onPress={handleSubmitApp} disabled={createApplication.isPending}>
                {createApplication.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={s.submitText}>Salvar</Text>
                )}
              </TouchableOpacity>
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
  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: 16, marginBottom: 12, ...theme.shadow.card },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  title: { fontSize: 20, fontWeight: '700', color: theme.colors.primary },
  subtitle: { fontSize: 14, color: theme.colors.textMuted, marginTop: 2 },
  deleteBtn: { padding: 6, borderRadius: theme.radius.sm },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginBottom: 12 },
  statusBadgeText: { fontSize: 12, fontWeight: '700' },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  infoItem: { width: '47%' },
  infoLabel: { fontSize: 12, color: theme.colors.textFaint, marginBottom: 2 },
  infoValue: { fontSize: 14, fontWeight: '600', color: theme.colors.text },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.text, marginBottom: 12 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: theme.radius.sm, backgroundColor: theme.colors.bg },
  addBtnText: { color: theme.colors.primary, fontSize: 13, fontWeight: '600' },
  emptyText: { fontSize: 13, color: theme.colors.textFaint, textAlign: 'center', paddingVertical: 12 },
  closingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  closingLabel: { fontSize: 13, color: theme.colors.textMuted },
  closingValue: { fontSize: 13, fontWeight: '600', color: theme.colors.text },
  closingLabelBold: { fontSize: 15, fontWeight: '700', color: theme.colors.text },
  closingValueBold: { fontSize: 16, fontWeight: '800', color: theme.colors.text },
  divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: 8 },
  listRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.border, gap: 8 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  categoryBadge: { fontSize: 11, fontWeight: '700', color: theme.colors.primary, backgroundColor: '#E7F8EF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' as const },
  rowDate: { fontSize: 12, color: theme.colors.textFaint },
  rowDescription: { fontSize: 14, color: theme.colors.text, marginTop: 4, fontWeight: '600' },
  rowMeta: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  rowAmount: { fontSize: 14, fontWeight: '700', color: theme.colors.text },
  rowDelete: { padding: 4 },
  label: { fontSize: 14, fontWeight: '600', color: theme.colors.text, marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.sm, padding: 12, fontSize: 15, color: theme.colors.text, backgroundColor: theme.colors.bg },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: theme.radius.sm, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.bg },
  chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipText: { fontSize: 13, color: theme.colors.textMuted, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  calcBtn: { backgroundColor: theme.colors.accent, borderRadius: theme.radius.sm, padding: 14, alignItems: 'center', marginTop: 16 },
  calcBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  calcResult: { marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.colors.border },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(16,24,40,0.55)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: theme.colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '85%' },
  handleBar: { width: 40, height: 4, borderRadius: 2, backgroundColor: theme.colors.border, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: theme.colors.text, marginBottom: 20 },
  submitBtn: { backgroundColor: theme.colors.primary, borderRadius: theme.radius.sm, padding: 16, alignItems: 'center', marginTop: 24, marginBottom: 16 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
