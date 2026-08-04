import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Alert, Modal, KeyboardAvoidingView, Platform, RefreshControl } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Trash2, Pencil, Leaf, Users, MapPin, Clock, X } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../../../../src/lib/api';
import { theme } from '../../../../../src/lib/theme';
import type { Pasture, PastureOccupation, Animal } from '../../../../../src/lib/types';

// Datas de calendário: formatar em UTC evita mostrar o dia anterior e
// corrige os registros gravados à meia-noite antes da varredura de fuso.
function formatDate(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

const CATEGORY_LABELS: Record<string, string> = {
  BEZERRO: 'Bezerro',
  BEZERRA: 'Bezerra',
  NOVILHO: 'Novilho',
  NOVILHA: 'Novilha',
  BOI: 'Boi',
  VACA: 'Vaca',
  TOURO: 'Touro',
};

export default function PastureDetailScreen() {
  const { farmId, pastureId } = useLocalSearchParams<{ farmId: string; pastureId: string }>();
  const qc = useQueryClient();

  const { data: pasture, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['pasture', farmId, pastureId],
    queryFn: () => apiFetch<Pasture>(`/fazendas/${farmId}/pastagens/${pastureId}`),
    enabled: !!farmId && !!pastureId,
  });

  const [showEdit, setShowEdit] = useState(false);
  const [form, setForm] = useState({ name: '', areaHectares: '', grassType: '', animalCapacity: '' });

  const openEdit = () => {
    if (!pasture) return;
    setForm({
      name: pasture.name ?? '',
      areaHectares: pasture.areaHectares != null ? String(pasture.areaHectares) : '',
      grassType: pasture.grassType ?? '',
      animalCapacity: pasture.animalCapacity != null ? String(pasture.animalCapacity) : '',
    });
    setShowEdit(true);
  };

  const updatePasture = useMutation({
    mutationFn: (body: any) =>
      apiFetch(`/fazendas/${farmId}/pastagens/${pastureId}`, { method: 'PATCH', body }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      refetch();
      qc.invalidateQueries({ queryKey: ['pastures', farmId] });
      setShowEdit(false);
    },
    onError: (e: any) => Alert.alert('Erro', e.message ?? 'Não foi possível salvar'),
  });

  const deletePasture = useMutation({
    mutationFn: () => apiFetch(`/fazendas/${farmId}/pastagens/${pastureId}`, { method: 'DELETE' }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ['pastures', farmId] });
      router.back();
    },
    onError: (e: any) => Alert.alert('Erro', e.message ?? 'Não foi possível excluir'),
  });

  const handleDelete = () => {
    Alert.alert('Excluir pasto', 'Tem certeza que deseja excluir este pasto? Esta ação não pode ser desfeita.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          deletePasture.mutate();
        },
      },
    ]);
  };

  const handleSaveEdit = () => {
    if (!form.name.trim()) {
      Alert.alert('Atenção', 'Informe o nome do pasto.');
      return;
    }
    const area = Number(form.areaHectares.replace(',', '.'));
    const capacity = Number(form.animalCapacity);
    if (!area || area <= 0) {
      Alert.alert('Atenção', 'Informe uma área válida.');
      return;
    }
    if (!capacity || capacity <= 0) {
      Alert.alert('Atenção', 'Informe uma capacidade válida.');
      return;
    }
    updatePasture.mutate({
      name: form.name.trim(),
      areaHectares: area,
      grassType: form.grassType.trim() || null,
      animalCapacity: Math.round(capacity),
    });
  };

  if (isLoading || !pasture) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const headCount = pasture.animalHeadCount ?? pasture.animals?.length ?? 0;
  const capacity = pasture.animalCapacity ?? 0;
  const occupancyPct = capacity > 0 ? Math.min(100, Math.round((headCount / capacity) * 100)) : 0;
  const isOverCapacity = capacity > 0 && headCount > capacity;

  const animals: Animal[] = pasture.animals ?? [];
  const occupations: PastureOccupation[] = pasture.occupations ?? [];
  const sortedOccupations = [...occupations].sort(
    (a: PastureOccupation, b: PastureOccupation) => new Date(b.enteredAt).getTime() - new Date(a.enteredAt).getTime()
  );

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.primary} />}
      >
        <Animated.View entering={FadeInDown.duration(400)} style={[styles.card, theme.shadow.card]}>
          <View style={styles.headerRow}>
            <View style={styles.headerIconWrap}>
              <Leaf size={24} color={theme.colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.pastureName}>{pasture.name}</Text>
              <Text style={styles.pastureSub}>
                {pasture.grassType ? pasture.grassType : 'Espécie não informada'} · {pasture.areaHectares} ha
              </Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.iconButton} onPress={openEdit}>
                <Pencil size={18} color={theme.colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconButton} onPress={handleDelete}>
                <Trash2 size={18} color={theme.colors.danger} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.occupancyBlock}>
            <View style={styles.occupancyLabelRow}>
              <View style={styles.occupancyLabelLeft}>
                <Users size={14} color={theme.colors.textMuted} />
                <Text style={styles.occupancyLabel}>Ocupação</Text>
              </View>
              <Text style={[styles.occupancyValue, isOverCapacity && { color: theme.colors.danger }]}>
                {headCount} / {capacity} animais
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${occupancyPct}%`,
                    backgroundColor: isOverCapacity ? theme.colors.danger : occupancyPct > 85 ? theme.colors.warning : theme.colors.success,
                  },
                ]}
              />
            </View>
            <Text style={styles.occupancyPct}>{occupancyPct}% da capacidade</Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(80)} style={[styles.card, theme.shadow.card]}>
          <Text style={styles.sectionTitle}>Animais no pasto ({animals.length})</Text>
          {animals.length === 0 ? (
            <Text style={styles.emptyText}>Nenhum animal neste pasto no momento.</Text>
          ) : (
            animals.map((animal: Animal, index: number) => (
              <TouchableOpacity
                key={animal.id}
                style={[styles.animalRow, index === animals.length - 1 && { borderBottomWidth: 0 }]}
                onPress={() => router.push(`/(app)/fazendas/${farmId}/animais/${animal.id}` as any)}
                activeOpacity={0.7}
              >
                <View style={styles.animalTagWrap}>
                  <Text style={styles.animalTagText}>{animal.earTag}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.animalName}>{animal.name || animal.earTag}</Text>
                  <Text style={styles.animalMeta}>
                    {CATEGORY_LABELS[animal.category] ?? animal.category}
                    {animal.currentWeightKg != null ? ` · ${animal.currentWeightKg} kg` : ''}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(160)} style={[styles.card, theme.shadow.card]}>
          <Text style={styles.sectionTitle}>Histórico de ocupação</Text>
          {sortedOccupations.length === 0 ? (
            <Text style={styles.emptyText}>Nenhum registro de ocupação.</Text>
          ) : (
            <View style={styles.timeline}>
              {sortedOccupations.map((occ: PastureOccupation, index: number) => (
                <View key={occ.id} style={styles.timelineItem}>
                  <View style={styles.timelineMarkerCol}>
                    <View
                      style={[
                        styles.timelineDot,
                        { backgroundColor: occ.exitedAt ? theme.colors.textFaint : theme.colors.primary },
                      ]}
                    />
                    {index !== sortedOccupations.length - 1 && <View style={styles.timelineLine} />}
                  </View>
                  <View style={styles.timelineContent}>
                    <View style={styles.timelineHeaderRow}>
                      <Text style={styles.timelineHeadCount}>{occ.headCount} animais</Text>
                      {!occ.exitedAt && (
                        <View style={styles.badgeOngoing}>
                          <Text style={styles.badgeOngoingText}>Em curso</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.timelineDateRow}>
                      <Clock size={12} color={theme.colors.textFaint} />
                      <Text style={styles.timelineDate}>
                        {formatDate(occ.enteredAt)} → {occ.exitedAt ? formatDate(occ.exitedAt) : 'Em curso'}
                      </Text>
                    </View>
                    {occ.notes ? <Text style={styles.timelineNotes}>{occ.notes}</Text> : null}
                  </View>
                </View>
              ))}
            </View>
          )}
        </Animated.View>
      </ScrollView>

      <Modal visible={showEdit} animationType="slide" transparent onRequestClose={() => setShowEdit(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Editar pasto</Text>
              <TouchableOpacity onPress={() => setShowEdit(false)}>
                <X size={22} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Nome</Text>
              <TextInput
                style={styles.input}
                value={form.name}
                onChangeText={(v: string) => setForm((f) => ({ ...f, name: v }))}
                placeholder="Nome do pasto"
                placeholderTextColor={theme.colors.textFaint}
              />

              <Text style={styles.inputLabel}>Área (hectares)</Text>
              <TextInput
                style={styles.input}
                value={form.areaHectares}
                onChangeText={(v: string) => setForm((f) => ({ ...f, areaHectares: v }))}
                placeholder="Ex: 12.5"
                placeholderTextColor={theme.colors.textFaint}
                keyboardType="decimal-pad"
              />

              <Text style={styles.inputLabel}>Tipo de capim</Text>
              <TextInput
                style={styles.input}
                value={form.grassType}
                onChangeText={(v: string) => setForm((f) => ({ ...f, grassType: v }))}
                placeholder="Ex: Brachiaria"
                placeholderTextColor={theme.colors.textFaint}
              />

              <Text style={styles.inputLabel}>Capacidade de animais</Text>
              <TextInput
                style={styles.input}
                value={form.animalCapacity}
                onChangeText={(v: string) => setForm((f) => ({ ...f, animalCapacity: v }))}
                placeholder="Ex: 40"
                placeholderTextColor={theme.colors.textFaint}
                keyboardType="number-pad"
              />

              <TouchableOpacity
                style={[styles.saveButton, updatePasture.isPending && { opacity: 0.7 }]}
                onPress={handleSaveEdit}
                disabled={updatePasture.isPending}
              >
                {updatePasture.isPending ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>Salvar alterações</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.bg },
  scrollContent: { padding: 16, paddingBottom: 40, gap: 16 },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: 16,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headerIconWrap: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.md,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pastureName: { fontSize: 18, fontWeight: '700', color: theme.colors.text },
  pastureSub: { fontSize: 13, color: theme.colors.textMuted, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 8 },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  occupancyBlock: { marginTop: 18 },
  occupancyLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  occupancyLabelLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  occupancyLabel: { fontSize: 13, color: theme.colors.textMuted, fontWeight: '600' },
  occupancyValue: { fontSize: 13, color: theme.colors.text, fontWeight: '700' },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: theme.colors.bg,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 999 },
  occupancyPct: { fontSize: 12, color: theme.colors.textFaint, marginTop: 6 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.text, marginBottom: 12 },
  emptyText: { fontSize: 13, color: theme.colors.textFaint, paddingVertical: 8 },
  animalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  animalTagWrap: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  animalTagText: { fontSize: 12, fontWeight: '700', color: theme.colors.primary },
  animalName: { fontSize: 14, fontWeight: '600', color: theme.colors.text },
  animalMeta: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  timeline: { marginTop: 4 },
  timelineItem: { flexDirection: 'row', gap: 12 },
  timelineMarkerCol: { alignItems: 'center', width: 16 },
  timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  timelineLine: { width: 2, flex: 1, backgroundColor: theme.colors.border, marginTop: 2, marginBottom: 2 },
  timelineContent: { flex: 1, paddingBottom: 18 },
  timelineHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timelineHeadCount: { fontSize: 14, fontWeight: '700', color: theme.colors.text },
  badgeOngoing: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#DCFCE7',
  },
  badgeOngoingText: { fontSize: 11, fontWeight: '700', color: theme.colors.primary },
  timelineDateRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  timelineDate: { fontSize: 12, color: theme.colors.textFaint },
  timelineNotes: { fontSize: 12, color: theme.colors.textMuted, marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(16,24,40,0.5)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: theme.colors.text },
  inputLabel: { fontSize: 13, fontWeight: '600', color: theme.colors.textMuted, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: theme.colors.bg,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 8,
  },
  saveButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
