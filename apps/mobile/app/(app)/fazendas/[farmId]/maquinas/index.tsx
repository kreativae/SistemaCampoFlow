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

interface Machine { id: string; name: string; type?: string; brand?: string; model?: string; year?: number }

const TYPES = ['TRATOR', 'CAMINHAO', 'IMPLEMENTO', 'OUTRO'] as const;

export default function MachinesScreen() {
  const { farmId } = useLocalSearchParams<{ farmId: string }>();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Machine | null>(null);
  const [form, setForm] = useState({ name: '', type: 'TRATOR' as string, brand: '', model: '', year: '' });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['machines', farmId],
    queryFn: () => apiFetch<Machine[]>(`/fazendas/${farmId}/maquinas`),
    enabled: !!farmId,
  });

  const resetForm = () => { setForm({ name: '', type: 'TRATOR', brand: '', model: '', year: '' }); setEditing(null); };

  const createMachine = useMutation({
    mutationFn: (body: any) => apiFetch(`/fazendas/${farmId}/maquinas`, { method: 'POST', body }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['machines', farmId] }); setShowForm(false); resetForm(); },
    onError: (err: any) => Alert.alert('Erro', err.message),
  });

  const updateMachine = useMutation({
    mutationFn: ({ id, ...body }: any) => apiFetch(`/fazendas/${farmId}/maquinas/${id}`, { method: 'PATCH', body }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['machines', farmId] }); setShowForm(false); resetForm(); },
    onError: (err: any) => Alert.alert('Erro', err.message),
  });

  const deleteMachine = useMutation({
    mutationFn: (id: string) => apiFetch(`/fazendas/${farmId}/maquinas/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['machines', farmId] }),
    onError: (err: any) => Alert.alert('Erro', err.message),
  });

  const handleSave = () => {
    if (!form.name) { Alert.alert('Erro', 'Nome é obrigatório'); return; }
    const body = { name: form.name, type: form.type, brand: form.brand || undefined, model: form.model || undefined, year: form.year ? Number(form.year) : undefined };
    if (editing) updateMachine.mutate({ id: editing.id, ...body }); else createMachine.mutate(body);
  };

  if (isLoading) return <View style={s.center}><ActivityIndicator size="large" color={theme.colors.primary} /></View>;

  return (
    <View style={s.container}>
      {!data?.length ? (
        <EmptyState icon="🚜" title="Nenhuma máquina" subtitle="Toque no + para cadastrar" />
      ) : (
        <FlatList style={{ flex: 1 }} data={data} keyExtractor={(m) => m.id} contentContainerStyle={{ padding: 16 }} onRefresh={refetch} refreshing={false}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(Math.min(index, 10) * 60).springify().damping(16)}>
              <TouchableOpacity activeOpacity={0.7} onPress={() => router.push(`/(app)/fazendas/${farmId}/maquinas/${item.id}` as any)} onLongPress={() => Alert.alert('Excluir máquina?', `Deseja excluir "${item.name}"?`, [{ text: 'Não' }, { text: 'Sim', style: 'destructive', onPress: () => deleteMachine.mutate(item.id) }])}>
                <View style={[s.card, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
                  <View style={s.avatar}><Ionicons name="construct" size={19} color="#B91C1C" /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.name}>{item.name}</Text>
                    <View style={s.row}>
                      {item.type && <Text style={s.meta}>{item.type}</Text>}
                      {item.brand && <Text style={s.meta}>{item.brand}</Text>}
                      {item.model && <Text style={s.meta}>{item.model}</Text>}
                      {item.year && <Text style={s.meta}>{item.year}</Text>}
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            </Animated.View>
          )}
        />
      )}
      <Fab onPress={() => { resetForm(); setShowForm(true); }} />
      <Modal visible={showForm} animationType="slide" transparent>
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.modal}>
            <ScrollView>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: theme.colors.border, alignSelf: 'center', marginBottom: 14 }} />
              <Text style={s.modalTitle}>{editing ? 'Editar Máquina' : 'Nova Máquina'}</Text>
              <Text style={s.label}>Nome *</Text>
              <TextInput style={s.input} value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} placeholder="Ex: Trator John Deere" />
              <Text style={s.label}>Tipo</Text>
              <View style={s.chipRow}>
                {TYPES.map((t) => (
                  <TouchableOpacity key={t} style={[s.chip, form.type === t && s.chipActive]} onPress={() => setForm({ ...form, type: t })}>
                    <Text style={[s.chipText, form.type === t && s.chipTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={s.label}>Marca</Text>
              <TextInput style={s.input} value={form.brand} onChangeText={(v) => setForm({ ...form, brand: v })} placeholder="Ex: John Deere" />
              <Text style={s.label}>Modelo</Text>
              <TextInput style={s.input} value={form.model} onChangeText={(v) => setForm({ ...form, model: v })} placeholder="Ex: 5075E" />
              <Text style={s.label}>Ano</Text>
              <TextInput style={s.input} value={form.year} onChangeText={(v) => setForm({ ...form, year: v })} keyboardType="numeric" placeholder="Ex: 2022" />
              <View style={s.modalActions}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => { setShowForm(false); resetForm(); }}><Text style={s.cancelText}>Cancelar</Text></TouchableOpacity>
                <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={createMachine.isPending || updateMachine.isPending}>
                  {(createMachine.isPending || updateMachine.isPending) ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>Salvar</Text>}
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
  avatar: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#FCEAEA', justifyContent: 'center', alignItems: 'center' },
  name: { fontSize: 16, fontWeight: '700', color: '#333', marginBottom: 4 },
  row: { flexDirection: 'row', gap: 8 },
  meta: { fontSize: 13, color: '#666' },
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
