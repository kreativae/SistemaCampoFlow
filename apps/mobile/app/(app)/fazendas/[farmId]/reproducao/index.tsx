import { useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, Modal, KeyboardAvoidingView, Platform, TextInput, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../../../../src/lib/api';
import { EmptyState } from '../../../../../src/components/EmptyState';
import { theme } from '../../../../../src/lib/theme';
import { DateInput } from '../../../../../src/components/DateInput';

interface ReproEvent { id: string; type: string; date: string; animalName?: string; notes?: string; result?: string }

const REPRO_TYPES = ['IATF', 'MONTA_NATURAL', 'INSEMINACAO', 'DIAGNOSTICO_PRENHEZ', 'PARTO', 'ABORTO'] as const;
const REPRO_LABELS: Record<string, string> = { IATF: 'IATF', MONTA_NATURAL: 'Monta natural', INSEMINACAO: 'Inseminação', DIAGNOSTICO_PRENHEZ: 'Diagnóstico', PARTO: 'Parto', ABORTO: 'Aborto' };
const RESULT_OPTIONS = ['PRENHE', 'VAZIA'] as const;

const today = () => new Date().toISOString().slice(0, 10);

export default function ReproductionScreen() {
  const { farmId } = useLocalSearchParams<{ farmId: string }>();
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['reproduction', farmId],
    queryFn: () => apiFetch<ReproEvent[]>(`/fazendas/${farmId}/reproducao/eventos`),
    enabled: !!farmId,
  });

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: 'IATF' as string, eventDate: today(), result: '' as string, notes: '' });

  const createEvent = useMutation({
    mutationFn: (body: any) => apiFetch(`/fazendas/${farmId}/reproducao/eventos`, { method: 'POST', body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reproduction', farmId] });
      setShowForm(false);
      setForm({ type: 'IATF', eventDate: today(), result: '', notes: '' });
    },
    onError: (e: any) => Alert.alert('Erro', e.message),
  });

  const handleSubmit = () => {
    if (!form.type || !form.eventDate) return Alert.alert('Erro', 'Tipo e data são obrigatórios');
    createEvent.mutate({
      type: form.type,
      eventDate: form.eventDate,
      result: form.type === 'DIAGNOSTICO_PRENHEZ' && form.result ? form.result : undefined,
      notes: form.notes || undefined,
    });
  };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');

  if (isLoading) return <View style={s.center}><ActivityIndicator size="large" color={theme.colors.primary} /></View>;

  return (
    <View style={s.container}>
      {!data?.length ? (
        <EmptyState icon="🧬" title="Nenhum evento reprodutivo" subtitle="Toque no + para registrar" />
      ) : (
        <FlatList data={data} keyExtractor={(e) => e.id} contentContainerStyle={{ padding: 16 }} onRefresh={refetch} refreshing={false}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(index * 60).duration(400)} style={s.card}>
              <View style={s.row}>
                <Text style={s.type}>{REPRO_LABELS[item.type] || item.type}</Text>
                <Text style={s.date}>{fmtDate(item.date)}</Text>
              </View>
              {item.animalName && <Text style={s.animal}>{item.animalName}</Text>}
              {item.result && <Text style={s.result}>{item.result}</Text>}
              {item.notes && <Text style={s.notes}>{item.notes}</Text>}
            </Animated.View>
          )}
        />
      )}

      {/* FAB */}
      <TouchableOpacity style={s.fab} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowForm(true); }} activeOpacity={0.8}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Modal Form */}
      <Modal visible={showForm} transparent animationType="slide" onRequestClose={() => setShowForm(false)}>
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowForm(false)} activeOpacity={1} />
          <View style={s.modalContent}>
            <View style={s.handleBar} />
            <Text style={s.modalTitle}>Novo evento reprodutivo</Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.label}>Tipo *</Text>
              <View style={s.chipRow}>
                {REPRO_TYPES.map((t) => (
                  <TouchableOpacity key={t} style={[s.chip, form.type === t && s.chipActive]} onPress={() => setForm(f => ({ ...f, type: t, result: '' }))}>
                    <Text style={[s.chipText, form.type === t && s.chipTextActive]}>{REPRO_LABELS[t]}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <DateInput label="Data *" value={form.eventDate} onChange={(v) => setForm(f => ({ ...f, eventDate: v }))} />

              {form.type === 'DIAGNOSTICO_PRENHEZ' && (
                <>
                  <Text style={s.label}>Resultado</Text>
                  <View style={s.chipRow}>
                    {RESULT_OPTIONS.map((r) => (
                      <TouchableOpacity key={r} style={[s.chip, form.result === r && s.chipActive]} onPress={() => setForm(f => ({ ...f, result: r }))}>
                        <Text style={[s.chipText, form.result === r && s.chipTextActive]}>{r === 'PRENHE' ? 'Prenhe' : 'Vazia'}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              <Text style={s.label}>Observações</Text>
              <TextInput style={[s.input, { height: 72, textAlignVertical: 'top' }]} value={form.notes} onChangeText={(v) => setForm(f => ({ ...f, notes: v }))} placeholder="Anotações" multiline placeholderTextColor={theme.colors.textFaint} />

              <TouchableOpacity style={s.submitBtn} onPress={handleSubmit} disabled={createEvent.isPending}>
                {createEvent.isPending ? <ActivityIndicator color="#fff" /> : <Text style={s.submitText}>Salvar</Text>}
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: 14, marginBottom: 10, ...theme.shadow.card },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  type: { fontSize: 15, fontWeight: '700', color: theme.colors.primary },
  date: { fontSize: 13, color: theme.colors.textMuted },
  animal: { fontSize: 14, color: theme.colors.text, marginTop: 2 },
  result: { fontSize: 13, color: theme.colors.success, marginTop: 2 },
  notes: { fontSize: 13, color: theme.colors.textFaint, marginTop: 4 },
  fab: { position: 'absolute', bottom: 24, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.primary, elevation: 6, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(16,24,40,0.55)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: theme.colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '85%' },
  handleBar: { width: 40, height: 4, borderRadius: 2, backgroundColor: theme.colors.border, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: theme.colors.text, marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: theme.colors.text, marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.sm, padding: 12, fontSize: 15, color: theme.colors.text, backgroundColor: theme.colors.bg },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.bg },
  chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: theme.colors.textMuted },
  chipTextActive: { color: '#fff' },
  submitBtn: { backgroundColor: theme.colors.primary, borderRadius: theme.radius.sm, padding: 16, alignItems: 'center', marginTop: 24, marginBottom: 16 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
