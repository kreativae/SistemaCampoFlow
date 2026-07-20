import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet,
  ActivityIndicator, Alert, Modal, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { apiFetch } from '../../../../../src/lib/api';
import { theme } from '../../../../../src/lib/theme';
import { EmptyState } from '../../../../../src/components/EmptyState';

type Role = 'OWNER' | 'MANAGER' | 'VETERINARIAN' | 'EMPLOYEE' | 'CONSULTANT';

interface Member {
  userId: string;
  email: string;
  name: string;
  role: Role;
  moduleAccess: string[];
}

interface FarmInvite {
  id: string;
  email: string;
  role: Role;
  expiresAt: string;
}

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'MANAGER', label: 'Gerente' },
  { value: 'VETERINARIAN', label: 'Veterinário' },
  { value: 'EMPLOYEE', label: 'Funcionário' },
  { value: 'CONSULTANT', label: 'Consultor' },
];

const ROLE_LABEL: Record<Role, string> = {
  OWNER: 'Proprietário',
  MANAGER: 'Gerente',
  VETERINARIAN: 'Veterinário',
  EMPLOYEE: 'Funcionário',
  CONSULTANT: 'Consultor',
};

const ROLE_COLOR: Record<Role, string> = {
  OWNER: '#059669',
  MANAGER: '#0E7490',
  VETERINARIAN: '#7C3AED',
  EMPLOYEE: '#374151',
  CONSULTANT: '#92400E',
};

export default function MembersScreen() {
  const { farmId } = useLocalSearchParams<{ farmId: string }>();
  const qc = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('EMPLOYEE');

  const { data: members, isLoading: loadingMembers, refetch: refetchMembers } = useQuery({
    queryKey: ['members', farmId],
    queryFn: () => apiFetch<Member[]>(`/fazendas/${farmId}/membros`),
    enabled: !!farmId,
  });

  const { data: invites, isLoading: loadingInvites, refetch: refetchInvites } = useQuery({
    queryKey: ['invites', farmId],
    queryFn: () => apiFetch<FarmInvite[]>(`/fazendas/${farmId}/convites`),
    enabled: !!farmId,
  });

  const refetchAll = useCallback(() => {
    refetchMembers();
    refetchInvites();
  }, [refetchMembers, refetchInvites]);

  const addMut = useMutation({
    mutationFn: (body: { email: string; role: Role }) =>
      apiFetch(`/fazendas/${farmId}/membros`, { method: 'POST', body }),
    onSuccess: (_data: any) => {
      qc.invalidateQueries({ queryKey: ['members', farmId] });
      qc.invalidateQueries({ queryKey: ['invites', farmId] });
      setShowForm(false);
      setEmail('');
      setRole('EMPLOYEE');
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      Alert.alert('Sucesso', 'Membro adicionado ou convite enviado.');
    },
    onError: (err: Error) => Alert.alert('Erro', err.message),
  });

  const removeMut = useMutation({
    mutationFn: (userId: string) =>
      apiFetch(`/fazendas/${farmId}/membros/${userId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['members', farmId] }),
    onError: (err: Error) => Alert.alert('Erro', err.message),
  });

  const revokeInviteMut = useMutation({
    mutationFn: (inviteId: string) =>
      apiFetch(`/fazendas/${farmId}/convites/${inviteId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invites', farmId] }),
    onError: (err: Error) => Alert.alert('Erro', err.message),
  });

  const confirmRemove = (m: Member) => {
    Alert.alert('Remover membro', `Remover ${m.name} (${m.email}) desta propriedade?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: () => removeMut.mutate(m.userId) },
    ]);
  };

  const confirmRevoke = (inv: FarmInvite) => {
    Alert.alert('Revogar convite', `Revogar o convite de ${inv.email}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Revogar', style: 'destructive', onPress: () => revokeInviteMut.mutate(inv.id) },
    ]);
  };

  const handleAdd = () => {
    if (!email.trim()) {
      Alert.alert('Erro', 'Informe o e-mail');
      return;
    }
    addMut.mutate({ email: email.trim(), role });
  };

  const isLoading = loadingMembers || loadingInvites;

  if (isLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const pendingInvites = invites ?? [];
  const memberList = members ?? [];

  return (
    <View style={s.container}>
      <FlatList
        data={memberList}
        keyExtractor={(item: Member) => item.userId}
        contentContainerStyle={s.list}
        refreshing={isLoading}
        onRefresh={refetchAll}
        ListHeaderComponent={
          <>
            {pendingInvites.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Convites pendentes ({pendingInvites.length})</Text>
                {pendingInvites.map((inv: FarmInvite, i: number) => (
                  <Animated.View key={inv.id} entering={FadeInDown.delay(i * 60).springify().damping(16)} style={s.inviteCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.inviteEmail}>{inv.email}</Text>
                      <Text style={s.inviteMeta}>
                        {ROLE_LABEL[inv.role]} · expira em{' '}
                        {new Date(inv.expiresAt).toLocaleDateString('pt-BR')}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => confirmRevoke(inv)} hitSlop={8}>
                      <Ionicons name="close-circle" size={22} color="#DC2626" />
                    </TouchableOpacity>
                  </Animated.View>
                ))}
              </View>
            )}
            <Text style={s.sectionTitle}>Membros ativos ({memberList.length})</Text>
          </>
        }
        renderItem={({ item, index }: { item: Member; index: number }) => (
          <Animated.View entering={FadeInDown.delay(index * 60).springify().damping(16)} style={s.card}>
            <View style={s.cardHeader}>
              <View style={[s.avatar, { backgroundColor: ROLE_COLOR[item.role] + '18' }]}>
                <Ionicons name="person" size={20} color={ROLE_COLOR[item.role]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{item.name}</Text>
                <Text style={s.email}>{item.email}</Text>
              </View>
              <View style={[s.badge, { backgroundColor: ROLE_COLOR[item.role] + '18' }]}>
                <Text style={[s.badgeText, { color: ROLE_COLOR[item.role] }]}>
                  {ROLE_LABEL[item.role]}
                </Text>
              </View>
            </View>
            {item.role !== 'OWNER' && (
              <View style={s.cardFooter}>
                <Text style={s.accessHint}>
                  {item.moduleAccess.length === 0
                    ? 'Acesso a todos os módulos'
                    : `Acesso limitado (${item.moduleAccess.length} módulos)`}
                </Text>
                <TouchableOpacity onPress={() => confirmRemove(item)} hitSlop={8}>
                  <Text style={s.removeText}>Remover</Text>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="people-outline"
            title="Nenhum membro"
            description="Adicione pessoas para colaborar na gestão da propriedade."
          />
        }
      />

      {/* FAB */}
      <TouchableOpacity
        style={s.fab}
        activeOpacity={0.85}
        onPress={() => setShowForm(true)}
      >
        <Ionicons name="person-add" size={26} color="#fff" />
      </TouchableOpacity>

      {/* Modal de convite */}
      <Modal visible={showForm} animationType="slide" transparent>
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.modal}>
            <ScrollView>
              <View style={s.modalHandle} />
              <Text style={s.modalTitle}>Convidar membro</Text>
              <Text style={s.hint}>
                Se a pessoa já tem conta no CampoFlow, o acesso é imediato. Caso contrário, ela recebe um convite por e-mail.
              </Text>

              <Text style={s.label}>E-mail *</Text>
              <TextInput
                style={s.input}
                value={email}
                onChangeText={setEmail}
                placeholder="pessoa@exemplo.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={s.label}>Papel</Text>
              <View style={s.chipRow}>
                {ROLE_OPTIONS.map((opt: { value: Role; label: string }) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      s.chip,
                      role === opt.value && { backgroundColor: theme.colors.primary + '15', borderColor: theme.colors.primary },
                    ]}
                    onPress={() => setRole(opt.value)}
                  >
                    <Text style={[s.chipText, role === opt.value && { color: theme.colors.primary }]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={s.modalActions}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => { setShowForm(false); setEmail(''); }}>
                  <Text style={s.cancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.saveBtn} onPress={handleAdd} disabled={addMut.isPending}>
                  {addMut.isPending ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={s.saveText}>Convidar</Text>
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
  container: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, paddingBottom: 100 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: theme.colors.text, marginBottom: 10, letterSpacing: -0.2 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    ...theme.shadow.card,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  name: { fontSize: 15, fontWeight: '700', color: theme.colors.text },
  email: { fontSize: 13, color: theme.colors.textMuted, marginTop: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.colors.border },
  accessHint: { fontSize: 12, color: theme.colors.textMuted },
  removeText: { fontSize: 13, fontWeight: '600', color: '#DC2626' },
  inviteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 12,
    marginBottom: 8,
  },
  inviteEmail: { fontSize: 14, fontWeight: '600', color: theme.colors.text },
  inviteMeta: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  fab: {
    position: 'absolute',
    bottom: 28,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadow.fab,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(16,24,40,0.55)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '80%' },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: theme.colors.border, alignSelf: 'center', marginBottom: 14 },
  modalTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3, color: theme.colors.primary, marginBottom: 8 },
  hint: { fontSize: 13, color: theme.colors.textMuted, marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 4, marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 15, backgroundColor: '#fafafa' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fafafa' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#999' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 24, marginBottom: 20 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: '#f0f0f0', alignItems: 'center' },
  cancelText: { fontSize: 15, fontWeight: '600', color: '#666' },
  saveBtn: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: theme.colors.primary, alignItems: 'center' },
  saveText: { fontSize: 15, fontWeight: '600', color: '#fff' },
});
