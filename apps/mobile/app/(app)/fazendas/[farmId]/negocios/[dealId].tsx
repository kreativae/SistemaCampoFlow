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
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, apiDownload } from '../../../../../src/lib/api';
import { theme } from '../../../../../src/lib/theme';
import type { Deal, DealType, DealStatus, DealItem } from '../../../../../src/lib/types';

const ARROBA_KG = 15;

const DEAL_LABELS: Record<DealType, string> = {
  COMPRA: 'Compra',
  VENDA: 'Venda',
  ABATE: 'Abate',
  VENDA_GRAO: 'Venda de grão',
};

const DEAL_COLORS: Record<DealType, string> = {
  COMPRA: theme.colors.info,
  VENDA: theme.colors.success,
  ABATE: theme.colors.danger,
  VENDA_GRAO: theme.colors.warning,
};

const STATUS_LABELS: Record<DealStatus, string> = {
  RASCUNHO: 'Rascunho',
  FINALIZADO: 'Finalizado',
  CANCELADO: 'Cancelado',
};

const STATUS_COLORS: Record<DealStatus, string> = {
  RASCUNHO: theme.colors.textMuted,
  FINALIZADO: theme.colors.success,
  CANCELADO: theme.colors.danger,
};

function fmtBRL(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

function fmtNumber(n: number | null | undefined, digits = 1): string {
  return (n ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function isArrobaUnit(priceUnit: string): boolean {
  return priceUnit === 'ARROBA' || priceUnit === '@';
}

function itemSubtotal(item: DealItem, priceUnit: string): number {
  const price = item.unitPrice ?? 0;
  const weight = item.weightKg ?? 0;
  if (isArrobaUnit(priceUnit)) {
    return (weight / ARROBA_KG) * price;
  }
  return weight * price;
}

export default function DealDetailScreen() {
  const { farmId, dealId } = useLocalSearchParams<{ farmId: string; dealId: string }>();
  const qc = useQueryClient();

  const { data: deal, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['deal', farmId, dealId],
    queryFn: () => apiFetch<Deal>(`/fazendas/${farmId}/negocios/${dealId}`),
    enabled: !!farmId && !!dealId,
  });

  const [showAddItem, setShowAddItem] = useState(false);
  const [itemForm, setItemForm] = useState({ earTag: '', weightKg: '', unitPrice: '' });
  const [downloading, setDownloading] = useState(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['deal', farmId, dealId] });
    qc.invalidateQueries({ queryKey: ['deals', farmId] });
  };

  const addItem = useMutation({
    mutationFn: (body: { earTag: string; weightKg: number; unitPrice: number }) =>
      apiFetch(`/fazendas/${farmId}/negocios/${dealId}/itens`, { method: 'POST', body }),
    onSuccess: () => {
      invalidate();
      setShowAddItem(false);
      setItemForm({ earTag: '', weightKg: '', unitPrice: '' });
    },
    onError: (e: any) => Alert.alert('Erro', e.message ?? 'Não foi possível adicionar o item'),
  });

  const removeItem = useMutation({
    mutationFn: (itemId: string) =>
      apiFetch(`/fazendas/${farmId}/negocios/${dealId}/itens/${itemId}`, { method: 'DELETE' }),
    onSuccess: () => invalidate(),
    onError: (e: any) => Alert.alert('Erro', e.message ?? 'Não foi possível remover o item'),
  });

  const updateStatus = useMutation({
    mutationFn: (status: DealStatus) =>
      apiFetch(`/fazendas/${farmId}/negocios/${dealId}`, { method: 'PATCH', body: { status } }),
    onSuccess: () => invalidate(),
    onError: (e: any) => Alert.alert('Erro', e.message ?? 'Não foi possível atualizar o negócio'),
  });

  const deleteDeal = useMutation({
    mutationFn: () => apiFetch(`/fazendas/${farmId}/negocios/${dealId}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals', farmId] });
      router.back();
    },
    onError: (e: any) => Alert.alert('Erro', e.message ?? 'Não foi possível excluir o negócio'),
  });

  const handleAddItem = () => {
    if (!itemForm.earTag.trim()) return Alert.alert('Erro', 'Brinco é obrigatório');
    if (!itemForm.weightKg || Number(itemForm.weightKg) <= 0) return Alert.alert('Erro', 'Informe um peso válido');
    if (!itemForm.unitPrice || Number(itemForm.unitPrice) <= 0) return Alert.alert('Erro', 'Informe um preço válido');
    addItem.mutate({
      earTag: itemForm.earTag.trim(),
      weightKg: Number(itemForm.weightKg),
      unitPrice: Number(itemForm.unitPrice),
    });
  };

  const handleRemoveItem = (item: DealItem) => {
    Alert.alert('Remover item', `Remover o animal ${item.earTag} deste negócio?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          removeItem.mutate(item.id);
        },
      },
    ]);
  };

  const handleDeleteDeal = () => {
    Alert.alert('Excluir negócio', 'Esta ação não pode ser desfeita. Deseja excluir este negócio?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () => {
          Haptics.impactAsync(Haptics.NotificationFeedbackType.Warning as any);
          deleteDeal.mutate();
        },
      },
    ]);
  };

  const handleFinalize = () => {
    Alert.alert('Finalizar negócio', 'Confirma a finalização deste negócio?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Finalizar',
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          updateStatus.mutate('FINALIZADO');
        },
      },
    ]);
  };

  const handleCancelDeal = () => {
    Alert.alert('Cancelar negócio', 'Confirma o cancelamento deste negócio?', [
      { text: 'Voltar', style: 'cancel' },
      {
        text: 'Cancelar negócio',
        style: 'destructive',
        onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          updateStatus.mutate('CANCELADO');
        },
      },
    ]);
  };

  const handleDownloadPdf = async () => {
    if (!farmId || !dealId) return;
    setDownloading(true);
    try {
      await apiDownload(`/fazendas/${farmId}/relatorios/negocio?format=pdf&dealId=${dealId}`, 'negocio.pdf');
    } catch (e: any) {
      Alert.alert('Erro', e.message ?? 'Não foi possível gerar o PDF');
    } finally {
      setDownloading(false);
    }
  };

  if (isLoading || !deal) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const dealType: DealType = deal.type;
  const dealStatus: DealStatus = deal.status;
  const arrobaMode = isArrobaUnit(deal.priceUnit);
  const items: DealItem[] = deal.items ?? [];
  const totalAnimals = items.length;
  const totalWeightKg = items.reduce((acc: number, it: DealItem) => acc + (it.weightKg ?? 0), 0);
  const totalArrobas = totalWeightKg / ARROBA_KG;
  const subtotal = items.reduce((acc: number, it: DealItem) => acc + itemSubtotal(it, deal.priceUnit), 0);
  const freightCost = deal.freightCost ?? 0;
  const commissionPercent = deal.commissionPercent ?? 0;
  const commissionValue = (subtotal * commissionPercent) / 100;
  const grandTotal = deal.totalValue ?? subtotal + freightCost + commissionValue;

  return (
    <View style={s.container}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(400)} style={s.headerCard}>
          <View style={s.badgeRow}>
            <View style={[s.badge, { backgroundColor: `${DEAL_COLORS[dealType]}20` }]}>
              <Text style={[s.badgeText, { color: DEAL_COLORS[dealType] }]}>{DEAL_LABELS[dealType]}</Text>
            </View>
            <View style={[s.badge, { backgroundColor: `${STATUS_COLORS[dealStatus]}20` }]}>
              <Text style={[s.badgeText, { color: STATUS_COLORS[dealStatus] }]}>{STATUS_LABELS[dealStatus]}</Text>
            </View>
            <View style={{ flex: 1 }} />
            <TouchableOpacity style={s.iconBtn} onPress={handleDeleteDeal}>
              <Ionicons name="trash" size={18} color={theme.colors.danger} />
            </TouchableOpacity>
          </View>

          <Text style={s.counterparty}>{deal.counterparty ?? 'Sem contraparte'}</Text>
          <View style={s.dateRow}>
            <Ionicons name="calendar-outline" size={14} color={theme.colors.textMuted} />
            <Text style={s.dateText}>{fmtDate(deal.dealDate)}</Text>
          </View>

          <TouchableOpacity style={s.pdfBtn} onPress={handleDownloadPdf} disabled={downloading}>
            {downloading ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <Ionicons name="download-outline" size={16} color={theme.colors.primary} />
            )}
            <Text style={s.pdfBtnText}>{downloading ? 'Gerando PDF...' : 'Baixar relatório PDF'}</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Summary cards */}
        <Animated.View entering={FadeInDown.delay(60).duration(400)} style={s.summaryRow}>
          <View style={s.summaryCard}>
            <Text style={s.summaryValue}>{totalAnimals}</Text>
            <Text style={s.summaryLabel}>Animais</Text>
          </View>
          <View style={s.summaryCard}>
            <Text style={s.summaryValue}>{fmtNumber(totalWeightKg, 0)}</Text>
            <Text style={s.summaryLabel}>Peso (kg)</Text>
          </View>
          <View style={s.summaryCard}>
            <Text style={s.summaryValue}>{fmtNumber(totalArrobas, 1)}</Text>
            <Text style={s.summaryLabel}>Arrobas</Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(90).duration(400)} style={s.grandTotalCard}>
          <Text style={s.grandTotalLabel}>Valor total do negócio</Text>
          <Text style={s.grandTotalValue}>{fmtBRL(grandTotal)}</Text>
        </Animated.View>

        {/* Financial details */}
        <Animated.View entering={FadeInDown.delay(120).duration(400)} style={s.card}>
          <Text style={s.sectionTitle}>Detalhes financeiros</Text>
          <View style={s.detailRow}>
            <Text style={s.detailLabel}>Preço por {arrobaMode ? 'arroba' : 'kg'}</Text>
            <Text style={s.detailValue}>{fmtBRL(deal.pricePerUnit)}</Text>
          </View>
          <View style={s.detailRow}>
            <Text style={s.detailLabel}>Subtotal dos itens</Text>
            <Text style={s.detailValue}>{fmtBRL(subtotal)}</Text>
          </View>
          <View style={s.detailRow}>
            <Text style={s.detailLabel}>Frete</Text>
            <Text style={s.detailValue}>{fmtBRL(freightCost)}</Text>
          </View>
          <View style={s.detailRow}>
            <Text style={s.detailLabel}>Comissão ({fmtNumber(commissionPercent, 1)}%)</Text>
            <Text style={s.detailValue}>{fmtBRL(commissionValue)}</Text>
          </View>
          <View style={[s.detailRow, s.detailRowTotal]}>
            <Text style={s.detailLabelTotal}>Total geral</Text>
            <Text style={s.detailValueTotal}>{fmtBRL(grandTotal)}</Text>
          </View>
        </Animated.View>

        {/* Items list */}
        <Animated.View entering={FadeInDown.delay(150).duration(400)} style={s.card}>
          <View style={s.itemsHeader}>
            <Text style={s.sectionTitle}>Animais ({items.length})</Text>
            <TouchableOpacity
              style={s.addItemBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowAddItem(true);
              }}
            >
              <Ionicons name="add" size={16} color={theme.colors.primary} />
              <Text style={s.addItemBtnText}>Adicionar</Text>
            </TouchableOpacity>
          </View>

          {items.length === 0 ? (
            <Text style={s.emptyItems}>Nenhum animal adicionado a este negócio</Text>
          ) : (
            items.map((item: DealItem, index: number) => (
              <Animated.View key={item.id} entering={FadeInDown.delay(160 + index * 40).duration(300)} style={s.itemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.itemTag}>{item.earTag}</Text>
                  <Text style={s.itemSub}>
                    {fmtNumber(item.weightKg ?? 0, 0)} kg · {fmtBRL(item.unitPrice)}/{arrobaMode ? '@' : 'kg'}
                  </Text>
                </View>
                <Text style={s.itemSubtotal}>{fmtBRL(itemSubtotal(item, deal.priceUnit))}</Text>
                <TouchableOpacity style={s.removeItemBtn} onPress={() => handleRemoveItem(item)}>
                  <Ionicons name="close" size={16} color={theme.colors.danger} />
                </TouchableOpacity>
              </Animated.View>
            ))
          )}
        </Animated.View>

        {/* Notes */}
        {deal.notes ? (
          <Animated.View entering={FadeInDown.delay(180).duration(400)} style={s.card}>
            <Text style={s.sectionTitle}>Observações</Text>
            <Text style={s.notesText}>{deal.notes}</Text>
          </Animated.View>
        ) : null}

        {/* Status transitions */}
        {deal.status === 'RASCUNHO' && (
          <Animated.View entering={FadeInDown.delay(210).duration(400)} style={s.statusActions}>
            <TouchableOpacity style={s.finalizeBtn} onPress={handleFinalize} disabled={updateStatus.isPending}>
              {updateStatus.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={18} color="#fff" />
                  <Text style={s.finalizeBtnText}>Finalizar negócio</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={handleCancelDeal} disabled={updateStatus.isPending}>
              <Ionicons name="close-circle" size={18} color={theme.colors.danger} />
              <Text style={s.cancelBtnText}>Cancelar negócio</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </ScrollView>

      {/* Add item modal */}
      <Modal visible={showAddItem} transparent animationType="slide" onRequestClose={() => setShowAddItem(false)}>
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowAddItem(false)} activeOpacity={1} />
          <View style={s.modalContent}>
            <View style={s.handleBar} />
            <Text style={s.modalTitle}>Adicionar animal</Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.label}>Brinco *</Text>
              <TextInput
                style={s.input}
                value={itemForm.earTag}
                onChangeText={(v) => setItemForm((f) => ({ ...f, earTag: v }))}
                placeholder="Ex: 1023"
                placeholderTextColor={theme.colors.textFaint}
              />

              <Text style={s.label}>Peso (kg) *</Text>
              <TextInput
                style={s.input}
                value={itemForm.weightKg}
                onChangeText={(v) => setItemForm((f) => ({ ...f, weightKg: v }))}
                placeholder="0"
                keyboardType="numeric"
                placeholderTextColor={theme.colors.textFaint}
              />

              <Text style={s.label}>Preço unitário (R$) *</Text>
              <TextInput
                style={s.input}
                value={itemForm.unitPrice}
                onChangeText={(v) => setItemForm((f) => ({ ...f, unitPrice: v }))}
                placeholder="0.00"
                keyboardType="numeric"
                placeholderTextColor={theme.colors.textFaint}
              />

              <TouchableOpacity style={s.submitBtn} onPress={handleAddItem} disabled={addItem.isPending}>
                {addItem.isPending ? <ActivityIndicator color="#fff" /> : <Text style={s.submitText}>Adicionar</Text>}
              </TouchableOpacity>
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

  headerCard: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: 16, marginBottom: 12, ...theme.shadow.card },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  iconBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: theme.colors.bg, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  counterparty: { fontSize: 20, fontWeight: '700', color: theme.colors.text, marginBottom: 6 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  dateText: { fontSize: 13, color: theme.colors.textMuted },
  pdfBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.sm, paddingVertical: 12 },
  pdfBtnText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },

  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  summaryCard: { flex: 1, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, paddingVertical: 14, alignItems: 'center', ...theme.shadow.card },
  summaryValue: { fontSize: 18, fontWeight: '700', color: theme.colors.text },
  summaryLabel: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },

  grandTotalCard: { backgroundColor: theme.colors.primary, borderRadius: theme.radius.lg, padding: 18, marginBottom: 12, alignItems: 'center' },
  grandTotalLabel: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 4 },
  grandTotalValue: { fontSize: 28, fontWeight: '800', color: '#fff' },

  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: 16, marginBottom: 12, ...theme.shadow.card },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.text, marginBottom: 12 },

  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  detailLabel: { fontSize: 14, color: theme.colors.textMuted },
  detailValue: { fontSize: 14, fontWeight: '600', color: theme.colors.text },
  detailRowTotal: { borderTopWidth: 1, borderTopColor: theme.colors.border, marginTop: 6, paddingTop: 10 },
  detailLabelTotal: { fontSize: 15, fontWeight: '700', color: theme.colors.text },
  detailValueTotal: { fontSize: 16, fontWeight: '800', color: theme.colors.success },

  itemsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  addItemBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: `${theme.colors.primary}15`, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  addItemBtnText: { fontSize: 13, fontWeight: '700', color: theme.colors.primary },
  emptyItems: { fontSize: 13, color: theme.colors.textFaint, textAlign: 'center', paddingVertical: 20 },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  itemTag: { fontSize: 14, fontWeight: '700', color: theme.colors.text },
  itemSub: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  itemSubtotal: { fontSize: 14, fontWeight: '700', color: theme.colors.success, marginRight: 10 },
  removeItemBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: `${theme.colors.danger}15`, justifyContent: 'center', alignItems: 'center' },

  notesText: { fontSize: 14, color: theme.colors.text, lineHeight: 20 },

  statusActions: { gap: 10, marginTop: 4 },
  finalizeBtn: { flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.success, borderRadius: theme.radius.sm, paddingVertical: 14 },
  finalizeBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  cancelBtn: { flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: theme.colors.danger, borderRadius: theme.radius.sm, paddingVertical: 14 },
  cancelBtnText: { color: theme.colors.danger, fontSize: 15, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(16,24,40,0.55)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: theme.colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '85%' },
  handleBar: { width: 40, height: 4, borderRadius: 2, backgroundColor: theme.colors.border, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: theme.colors.text, marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: theme.colors.text, marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.sm, padding: 12, fontSize: 15, color: theme.colors.text, backgroundColor: theme.colors.bg },
  submitBtn: { backgroundColor: theme.colors.primary, borderRadius: theme.radius.sm, padding: 16, alignItems: 'center', marginTop: 24, marginBottom: 16 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
