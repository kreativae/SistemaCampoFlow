import { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Alert, Modal, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../../src/lib/api';
import { useAuth } from '../../../src/lib/auth-context';
import { theme } from '../../../src/lib/theme';
import { Fab } from '../../../src/components/UI';
import type { Farm } from '../../../src/lib/types';

export default function FarmsScreen() {
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', totalAreaHectares: '', city: '', state: '' });

  const { data: farms, isLoading, refetch } = useQuery({
    queryKey: ['farms'],
    queryFn: () => apiFetch<Farm[]>('/fazendas'),
  });

  const createFarm = useMutation({
    mutationFn: (body: any) => apiFetch('/fazendas', { method: 'POST', body }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['farms'] }); setShowForm(false); setForm({ name: '', totalAreaHectares: '', city: '', state: '' }); },
    onError: (err: any) => Alert.alert('Erro', err.message),
  });

  const handleCreate = () => {
    if (!form.name) { Alert.alert('Erro', 'Nome é obrigatório'); return; }
    createFarm.mutate({ name: form.name, totalAreaHectares: form.totalAreaHectares ? Number(form.totalAreaHectares) : undefined, city: form.city || undefined, state: form.state || undefined });
  };

  if (isLoading) return <View style={s.center}><ActivityIndicator size="large" color={theme.colors.primary} /></View>;

  return (
    <View style={s.container}>
      <LinearGradient colors={[theme.colors.primaryDark, theme.colors.primary, theme.colors.primaryLight]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.hero, { paddingTop: insets.top + 10 }]}>
        <Animated.Text entering={FadeInUp.delay(50)} style={s.heroEyebrow}>CAMPOFLOW</Animated.Text>
        <Animated.Text entering={FadeInUp.delay(120)} style={s.heroTitle}>Suas fazendas</Animated.Text>
        <Animated.Text entering={FadeInUp.delay(180)} style={s.heroSub}>{farms?.length ?? 0} propriedade{(farms?.length ?? 0) === 1 ? '' : 's'} cadastrada{(farms?.length ?? 0) === 1 ? '' : 's'}</Animated.Text>
      </LinearGradient>

      {!farms?.length ? (
        <View style={s.center}>
          <View style={s.emptyIcon}><Ionicons name="home" size={34} color={theme.colors.primary} /></View>
          <Text style={s.empty}>Nenhuma fazenda cadastrada</Text>
          <Text style={s.emptyHint}>Toque no + para criar sua primeira fazenda</Text>
        </View>
      ) : (
        <FlatList data={farms} keyExtractor={(f) => f.id} contentContainerStyle={{ padding: 16, paddingTop: 20 }} onRefresh={refetch} refreshing={false}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(index * 70).springify().damping(16)}>
              <TouchableOpacity style={s.card} activeOpacity={0.85} onPress={() => { Haptics.selectionAsync(); router.push(`/(app)/fazendas/${item.id}`); }}>
                <View style={s.cardIcon}><Ionicons name="home" size={22} color={theme.colors.primary} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.name}>{item.name}</Text>
                  <View style={s.areaRow}>
                    <Ionicons name="resize" size={12} color={theme.colors.textFaint} />
                    <Text style={s.area}>{item.totalAreaHectares ? `${item.totalAreaHectares} ha` : 'Área não informada'}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.colors.textFaint} />
              </TouchableOpacity>
            </Animated.View>
          )}
        />
      )}

      <View style={s.footer}>
        <TouchableOpacity style={s.footerBtn} onPress={() => router.push('/(app)/conta/perfil')}>
          <Ionicons name="person-circle-outline" size={22} color={theme.colors.primary} />
          <Text style={s.footerText}>Perfil</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.footerBtn} onPress={() => router.push('/(app)/conta/assinatura')}>
          <Ionicons name="card-outline" size={22} color={theme.colors.primary} />
          <Text style={s.footerText}>Assinatura</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.footerBtn} onPress={() => router.push('/(app)/suporte')}>
          <Ionicons name="chatbubbles-outline" size={22} color={theme.colors.primary} />
          <Text style={s.footerText}>Suporte</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.footerBtn} onPress={logout}>
          <Ionicons name="log-out-outline" size={22} color={theme.colors.danger} />
          <Text style={[s.footerText, { color: theme.colors.danger }]}>Sair</Text>
        </TouchableOpacity>
      </View>

      <View style={{ position: 'absolute', bottom: 60, right: 0 }}>
        <Fab onPress={() => setShowForm(true)} />
      </View>

      <Modal visible={showForm} animationType="slide" transparent>
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.modal}>
            <ScrollView>
              <View style={s.modalHandle} />
              <Text style={s.modalTitle}>Nova Fazenda</Text>
              <Text style={s.label}>Nome *</Text>
              <TextInput style={s.input} value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} placeholder="Ex: Fazenda Boa Vista" placeholderTextColor={theme.colors.textFaint} />
              <Text style={s.label}>Área total (hectares)</Text>
              <TextInput style={s.input} value={form.totalAreaHectares} onChangeText={(v) => setForm({ ...form, totalAreaHectares: v })} keyboardType="numeric" placeholder="Ex: 500" placeholderTextColor={theme.colors.textFaint} />
              <Text style={s.label}>Cidade</Text>
              <TextInput style={s.input} value={form.city} onChangeText={(v) => setForm({ ...form, city: v })} placeholder="Ex: Uberaba" placeholderTextColor={theme.colors.textFaint} />
              <Text style={s.label}>Estado</Text>
              <TextInput style={s.input} value={form.state} onChangeText={(v) => setForm({ ...form, state: v })} placeholder="Ex: MG" placeholderTextColor={theme.colors.textFaint} />
              <View style={s.modalActions}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => setShowForm(false)}><Text style={s.cancelText}>Cancelar</Text></TouchableOpacity>
                <TouchableOpacity style={s.saveBtn} onPress={handleCreate} disabled={createFarm.isPending}>
                  {createFarm.isPending ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>Salvar</Text>}
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  hero: { paddingTop: 16, paddingHorizontal: 20, paddingBottom: 28, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  heroEyebrow: { color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  heroTitle: { color: '#fff', fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginTop: 4 },
  heroSub: { color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 4 },
  emptyIcon: { width: 72, height: 72, borderRadius: 24, backgroundColor: '#E7F3EB', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  empty: { fontSize: 18, fontWeight: '700', color: theme.colors.text },
  emptyHint: { fontSize: 14, color: theme.colors.textMuted, marginTop: 8, textAlign: 'center' },
  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: theme.colors.border, ...theme.shadow.card },
  cardIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: '#E7F3EB', justifyContent: 'center', alignItems: 'center' },
  name: { fontSize: 16, fontWeight: '800', color: theme.colors.text, letterSpacing: -0.2 },
  areaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  area: { fontSize: 12, color: theme.colors.textMuted },
  footer: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 10, borderTopWidth: 1, borderTopColor: theme.colors.border, backgroundColor: theme.colors.surface },
  footerBtn: { alignItems: 'center', paddingVertical: 4, paddingHorizontal: 12, gap: 2 },
  footerText: { fontSize: 11, fontWeight: '600', color: theme.colors.primary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(16,24,40,0.55)', justifyContent: 'flex-end' },
  modal: { backgroundColor: theme.colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '85%' },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: theme.colors.border, alignSelf: 'center', marginBottom: 14 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: theme.colors.text, marginBottom: 12, letterSpacing: -0.3 },
  label: { fontSize: 13, fontWeight: '600', color: theme.colors.textMuted, marginBottom: 4, marginTop: 12 },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.sm, padding: 12, fontSize: 15, backgroundColor: '#FAFBFA', color: theme.colors.text },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20, marginBottom: 20 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: theme.radius.sm, backgroundColor: '#F2F4F1', alignItems: 'center' },
  cancelText: { fontSize: 15, fontWeight: '700', color: theme.colors.textMuted },
  saveBtn: { flex: 1, padding: 14, borderRadius: theme.radius.sm, backgroundColor: theme.colors.primary, alignItems: 'center' },
  saveText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
