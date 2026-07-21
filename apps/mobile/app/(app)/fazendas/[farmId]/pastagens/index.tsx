import { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Alert, Modal, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { theme } from '../../../../../src/lib/theme';
import { Fab } from '../../../../../src/components/UI';
import { usePastures, useCreatePasture, useUpdatePasture, useDeletePasture } from '../../../../../src/hooks/use-pastures';
import { EmptyState } from '../../../../../src/components/EmptyState';
import type { Pasture } from '../../../../../src/lib/types';

const emptyForm = { name: '', areaHectares: '', grassType: '', animalCapacity: '' };

export default function PasturesScreen() {
  const { farmId } = useLocalSearchParams<{ farmId: string }>();
  const { data: pastures, isLoading, refetch } = usePastures(farmId);
  const createPasture = useCreatePasture(farmId);
  const updatePasture = useUpdatePasture(farmId);
  const deletePasture = useDeletePasture(farmId);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (item: Pasture) => {
    setEditingId(item.id);
    setForm({
      name: item.name ?? '',
      areaHectares: item.areaHectares != null ? String(item.areaHectares) : '',
      grassType: item.grassType ?? '',
      animalCapacity: item.animalCapacity != null ? String(item.animalCapacity) : '',
    });
    setShowForm(true);
  };

  const confirmDelete = (item: Pasture) => {
    Alert.alert('Excluir pastagem', `Deseja excluir "${item.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () =>
          deletePasture.mutate(item.id, {
            onError: (err: any) => Alert.alert('Erro', err.message),
          }),
      },
    ]);
  };

  const handleSave = () => {
    if (!form.name || !form.areaHectares || !form.animalCapacity) {
      Alert.alert('Erro', 'Nome, área e capacidade são obrigatórios');
      return;
    }
    const payload = {
      name: form.name,
      areaHectares: Number(form.areaHectares),
      grassType: form.grassType || undefined,
      animalCapacity: Number(form.animalCapacity),
    };
    const opts = {
      onSuccess: () => {
        setShowForm(false);
        setForm(emptyForm);
        setEditingId(null);
      },
      onError: (err: any) => Alert.alert('Erro', err.message),
    };

    if (editingId) {
      updatePasture.mutate({ id: editingId, ...payload }, opts);
    } else {
      createPasture.mutate(payload, opts);
    }
  };

  const isSaving = createPasture.isPending || updatePasture.isPending;

  if (isLoading) return <View style={s.center}><ActivityIndicator size="large" color={theme.colors.primary} /></View>;

  return (
    <View style={s.container}>
      {!pastures?.length ? (
        <EmptyState icon="🌱" title="Nenhuma pastagem" subtitle="Toque no + para cadastrar" />
      ) : (
        <FlatList data={pastures} keyExtractor={(p) => p.id} contentContainerStyle={{ padding: 16 }} onRefresh={refetch} refreshing={false}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(Math.min(index, 10) * 60).springify().damping(16)}>
              <TouchableOpacity activeOpacity={0.7} onPress={() => router.push(`/(app)/fazendas/${farmId}/pastagens/${item.id}` as any)} onLongPress={() => confirmDelete(item)}>
                <View style={[s.card, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
                  <View style={s.avatar}><Ionicons name="leaf" size={19} color="#4D7C0F" /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.name}>{item.name}</Text>
                    <View style={s.row}>
                      <Text style={s.meta}>{item.areaHectares} ha</Text>
                      {item.grassType && <Text style={s.meta}>{item.grassType}</Text>}
                    </View>
                    {item.animalHeadCount !== undefined && item.animalHeadCount > 0 && (
                      <Text style={s.animals}>{item.animalHeadCount} animais</Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            </Animated.View>
          )}
        />
      )}
      <Fab onPress={openCreate} />
      <Modal visible={showForm} animationType="slide" transparent>
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.modal}>
            <ScrollView>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: theme.colors.border, alignSelf: 'center', marginBottom: 14 }} />
              <Text style={s.modalTitle}>{editingId ? 'Editar Pastagem' : 'Nova Pastagem'}</Text>
              <Text style={s.label}>Nome *</Text>
              <TextInput style={s.input} value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} placeholder="Ex: Piquete 1" />
              <Text style={s.label}>Área (ha) *</Text>
              <TextInput style={s.input} value={form.areaHectares} onChangeText={(v) => setForm({ ...form, areaHectares: v })} keyboardType="numeric" placeholder="Ex: 10" />
              <Text style={s.label}>Tipo de capim</Text>
              <TextInput style={s.input} value={form.grassType} onChangeText={(v) => setForm({ ...form, grassType: v })} placeholder="Ex: Brachiaria" />
              <Text style={s.label}>Capacidade (animais) *</Text>
              <TextInput style={s.input} value={form.animalCapacity} onChangeText={(v) => setForm({ ...form, animalCapacity: v })} keyboardType="numeric" placeholder="Ex: 50" />
              <View style={s.modalActions}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => { setShowForm(false); setEditingId(null); }}><Text style={s.cancelText}>Cancelar</Text></TouchableOpacity>
                <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={isSaving}>
                  {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>Salvar</Text>}
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
  avatar: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#F0F7E5', justifyContent: 'center', alignItems: 'center' },
  name: { fontSize: 16, fontWeight: '700', color: theme.colors.primary, marginBottom: 6 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  meta: { fontSize: 13, color: '#666' },
  animals: { fontSize: 13, color: '#666', marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(16,24,40,0.55)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '85%' },
  modalTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3, color: theme.colors.primary, marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 4, marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 15, backgroundColor: '#fafafa' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20, marginBottom: 20 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: '#f0f0f0', alignItems: 'center' },
  cancelText: { fontSize: 15, fontWeight: '600', color: '#666' },
  saveBtn: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: theme.colors.primary, alignItems: 'center' },
  saveText: { fontSize: 15, fontWeight: '600', color: '#fff' },
});
