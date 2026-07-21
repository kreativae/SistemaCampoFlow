import { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Alert, Modal, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { theme } from '../../../../../src/lib/theme';
import { Fab } from '../../../../../src/components/UI';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../../../../src/lib/api';
import { EmptyState } from '../../../../../src/components/EmptyState';

interface Supply { id: string; name: string; category?: string; unit?: string; currentStock?: number; minimumStock?: number }

const CATEGORIES = ['SAL_MINERAL', 'RACAO', 'FERTILIZANTE', 'HERBICIDA', 'DEFENSIVO', 'OUTROS'] as const;

export default function SuppliesScreen() {
  const { farmId } = useLocalSearchParams<{ farmId: string }>();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Supply | null>(null);
  const [form, setForm] = useState({ name: '', category: 'OUTROS' as string, unit: 'kg', initialQuantity: '' });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['supplies', farmId],
    queryFn: () => apiFetch<Supply[]>(`/fazendas/${farmId}/insumos`),
    enabled: !!farmId,
  });

  const resetForm = () => { setForm({ name: '', category: 'OUTROS', unit: 'kg', initialQuantity: '' }); setEditing(null); };

  const createSupply = useMutation({
    mutationFn: (body: any) => apiFetch(`/fazendas/${farmId}/insumos`, { method: 'POST', body }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['supplies', farmId] }); setShowForm(false); resetForm(); },
    onError: (err: any) => Alert.alert('Erro', err.message),
  });

  const updateSupply = useMutation({
    mutationFn: ({ id, ...body }: any) => apiFetch(`/fazendas/${farmId}/insumos/${id}`, { method: 'PATCH', body }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['supplies', farmId] }); setShowForm(false); resetForm(); },
    onError: (err: any) => Alert.alert('Erro', err.message),
  });

  const deleteSupply = useMutation({
    mutationFn: (id: string) => apiFetch(`/fazendas/${farmId}/insumos/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['supplies', farmId] }),
    onError: (err: any) => Alert.alert('Erro', err.message),
  });

  const handleSave = () => {
    if (!form.name) { Alert.alert('Erro', 'Nome é obrigatório'); return; }
    const body = { name: form.name, category: form.category, unit: form.unit, initialQuantity: form.initialQuantity ? Number(form.initialQuantity) : undefined };
    if (editing) updateSupply.mutate({ id: editing.id, ...body }); else createSupply.mutate(body);
  };

  if (isLoading) return <View style={s.center}><ActivityIndicator size="large" color={theme.colors.primary} /></View>;

  return (
    <View style={s.container}>
      {!data?.length ? (
        <EmptyState icon="📦" title="Nenhum insumo" subtitle="Toque no + para cadastrar" />
      ) : (
        <FlatList style={{ flex: 1 }} data={data} keyExtractor={(i) => i.id} contentContainerStyle={{ padding: 16 }} onRefresh={refetch} refreshing={false}
          renderItem={({ item, index }) => {
            const low = !!(item.minimumStock && item.currentStock !== undefined && item.currentStock <= item.minimumStock);
            return (
              <Animated.View entering={FadeInDown.delay(Math.min(index, 10) * 60).springify().damping(16)}>
                <TouchableOpacity activeOpacity={0.7} onPress={() => router.push(`/(app)/fazendas/${farmId}/insumos/${item.id}` as any)} onLongPress={() => Alert.alert('Excluir insumo?', `Deseja excluir "${item.name}"?`, [{ text: 'Não' }, { text: 'Sim', style: 'destructive', onPress: () => deleteSupply.mutate(item.id) }])}>
                  <View style={[s.card, { flexDirection: 'row', alignItems: 'center', gap: 12 }, low ? s.cardLow : undefined]}>
                    <View style={[s.avatar, low && { backgroundColor: '#FDF3E1' }]}>
                      <Ionicons name={low ? 'alert-circle' : 'cube'} size={19} color={low ? '#F79009' : '#6D28D9'} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={s.row}>
                        <Text style={s.name}>{item.name}</Text>
                        {item.category && <Text style={s.badge}>{item.category}</Text>}
                      </View>
                      <Text style={s.stock}>Estoque: {item.currentStock ?? 0} {item.unit ?? 'un'}{low ? ' • Baixo' : ''}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            );
          }}
        />
      )}
      <Fab onPress={() => { resetForm(); setShowForm(true); }} />
      <Modal visible={showForm} animationType="slide" transparent>
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.modal}>
            <ScrollView>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: theme.colors.border, alignSelf: 'center', marginBottom: 14 }} />
              <Text style={s.modalTitle}>{editing ? 'Editar Insumo' : 'Novo Insumo'}</Text>
              <Text style={s.label}>Nome *</Text>
              <TextInput style={s.input} value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} placeholder="Ex: Sal mineral" />
              <Text style={s.label}>Categoria</Text>
              <View style={s.chipRow}>
                {CATEGORIES.map((c) => (
                  <TouchableOpacity key={c} style={[s.chip, form.category === c && s.chipActive]} onPress={() => setForm({ ...form, category: c })}>
                    <Text style={[s.chipText, form.category === c && s.chipTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={s.label}>Unidade</Text>
              <TextInput style={s.input} value={form.unit} onChangeText={(v) => setForm({ ...form, unit: v })} placeholder="Ex: kg, L, un" />
              <Text style={s.label}>Quantidade inicial</Text>
              <TextInput style={s.input} value={form.initialQuantity} onChangeText={(v) => setForm({ ...form, initialQuantity: v })} keyboardType="numeric" placeholder="Ex: 100" />
              <View style={s.modalActions}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => { setShowForm(false); resetForm(); }}><Text style={s.cancelText}>Cancelar</Text></TouchableOpacity>
                <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={createSupply.isPending || updateSupply.isPending}>
                  {(createSupply.isPending || updateSupply.isPending) ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>Salvar</Text>}
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
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: theme.colors.border, shadowColor: '#101828', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  cardLow: { borderLeftWidth: 4, borderLeftColor: '#F79009' },
  avatar: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#F0EAFB', justifyContent: 'center', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  name: { fontSize: 16, fontWeight: '700', color: '#333', flex: 1 },
  badge: { backgroundColor: '#e3f2fd', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, fontSize: 12, color: '#1565c0' },
  stock: { fontSize: 13, color: '#666' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(16,24,40,0.55)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '85%' },
  modalTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3, color: theme.colors.primary, marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 4, marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 15, backgroundColor: '#fafafa' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f0f0f0', borderWidth: 1, borderColor: '#e0e0e0' },
  chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipText: { fontSize: 13, color: '#555' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20, marginBottom: 20 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: '#f0f0f0', alignItems: 'center' },
  cancelText: { fontSize: 15, fontWeight: '600', color: '#666' },
  saveBtn: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: theme.colors.primary, alignItems: 'center' },
  saveText: { fontSize: 15, fontWeight: '600', color: '#fff' },
});
