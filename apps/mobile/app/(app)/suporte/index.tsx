import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../../src/lib/api';
import { theme } from '../../../src/lib/theme';
import { Fab } from '../../../src/components/UI';
import { EmptyState } from '../../../src/components/EmptyState';
import type { Ticket, TicketStatus, TicketPriority, TicketMessage } from '../../../src/lib/types';

const STATUS_LABELS: Record<TicketStatus, string> = {
  ABERTO: 'Aberto',
  EM_ANDAMENTO: 'Em andamento',
  RESOLVIDO: 'Resolvido',
  FECHADO: 'Fechado',
};

const PRIORITY_LABELS: Record<TicketPriority, string> = {
  BAIXA: 'Baixa',
  MEDIA: 'Média',
  ALTA: 'Alta',
};

const STATUS_COLORS: Record<TicketStatus, string> = {
  ABERTO: theme.colors.info,
  EM_ANDAMENTO: theme.colors.warning,
  RESOLVIDO: theme.colors.success,
  FECHADO: theme.colors.textMuted,
};

const PRIORITY_COLORS: Record<TicketPriority, string> = {
  BAIXA: theme.colors.textMuted,
  MEDIA: theme.colors.warning,
  ALTA: theme.colors.danger,
};

const STATUS_FILTERS: { key: TicketStatus | 'TODOS'; label: string }[] = [
  { key: 'TODOS', label: 'Todos' },
  { key: 'ABERTO', label: 'Aberto' },
  { key: 'EM_ANDAMENTO', label: 'Em andamento' },
  { key: 'RESOLVIDO', label: 'Resolvido' },
  { key: 'FECHADO', label: 'Fechado' },
];

const PRIORITY_OPTIONS: TicketPriority[] = ['BAIXA', 'MEDIA', 'ALTA'];

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtDateTime(d: string): string {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function SupportScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'TODOS'>('TODOS');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newPriority, setNewPriority] = useState<TicketPriority>('MEDIA');
  const [newMessage, setNewMessage] = useState('');

  const { data: tickets, isLoading, refetch } = useQuery({
    queryKey: ['suporte-tickets'],
    queryFn: () => apiFetch<Ticket[]>('/suporte/tickets'),
  });

  const { data: ticketDetail, isFetching: isFetchingDetail } = useQuery({
    queryKey: ['suporte-ticket', expandedId],
    queryFn: () => apiFetch<Ticket>(`/suporte/tickets/${expandedId}`),
    enabled: !!expandedId,
  });

  const createTicket = useMutation({
    mutationFn: (body: { subject: string; priority: TicketPriority; message: string }) =>
      apiFetch<Ticket>('/suporte/tickets', { method: 'POST', body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suporte-tickets'] });
      setShowForm(false);
      setNewSubject('');
      setNewPriority('MEDIA');
      setNewMessage('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (err: any) => Alert.alert('Erro', err.message ?? 'Não foi possível criar o ticket'),
  });

  const sendReply = useMutation({
    mutationFn: (vars: { id: string; message: string }) =>
      apiFetch<TicketMessage>(`/suporte/tickets/${vars.id}/mensagens`, { method: 'POST', body: { message: vars.message } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suporte-ticket', expandedId] });
      queryClient.invalidateQueries({ queryKey: ['suporte-tickets'] });
      setReplyText('');
    },
    onError: (err: any) => Alert.alert('Erro', err.message ?? 'Não foi possível enviar a mensagem'),
  });

  const handleCreate = () => {
    if (!newSubject.trim() || !newMessage.trim()) {
      Alert.alert('Erro', 'Preencha o assunto e a mensagem');
      return;
    }
    createTicket.mutate({ subject: newSubject.trim(), priority: newPriority, message: newMessage.trim() });
  };

  const handleToggleExpand = (id: string) => {
    Haptics.selectionAsync();
    setReplyText('');
    setExpandedId((current: string | null) => (current === id ? null : id));
  };

  const handleSendReply = () => {
    if (!expandedId || !replyText.trim()) return;
    sendReply.mutate({ id: expandedId, message: replyText.trim() });
  };

  const filteredTickets: Ticket[] = (tickets ?? []).filter(
    (t: Ticket) => statusFilter === 'TODOS' || t.status === statusFilter,
  );

  if (isLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <Stack.Screen options={{ title: 'Suporte' }} />

      <LinearGradient
        colors={[theme.colors.primaryDark, theme.colors.primary, theme.colors.primaryLight]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[s.hero, { paddingTop: insets.top + 10 }]}
      >
        <Animated.Text entering={FadeInUp.delay(50)} style={s.heroEyebrow}>SUPORTE</Animated.Text>
        <Animated.Text entering={FadeInUp.delay(120)} style={s.heroTitle}>Central de ajuda</Animated.Text>
        <Animated.Text entering={FadeInUp.delay(180)} style={s.heroSub}>
          {tickets?.length ?? 0} ticket{(tickets?.length ?? 0) === 1 ? '' : 's'} registrado{(tickets?.length ?? 0) === 1 ? '' : 's'}
        </Animated.Text>
      </LinearGradient>

      <View style={s.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterScroll}>
          {STATUS_FILTERS.map((f: { key: TicketStatus | 'TODOS'; label: string }) => (
            <TouchableOpacity
              key={f.key}
              style={[s.filterChip, statusFilter === f.key && s.filterChipActive]}
              onPress={() => { Haptics.selectionAsync(); setStatusFilter(f.key); }}
            >
              <Text style={[s.filterChipText, statusFilter === f.key && s.filterChipTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {!filteredTickets.length ? (
        <EmptyState icon="🎫" title="Nenhum ticket encontrado" subtitle="Toque no + para abrir um chamado com o suporte" />
      ) : (
        <FlatList
          data={filteredTickets}
          keyExtractor={(t: Ticket) => t.id}
          contentContainerStyle={{ padding: 16, paddingTop: 16, paddingBottom: 100 }}
          onRefresh={refetch}
          refreshing={false}
          renderItem={({ item, index }: { item: Ticket; index: number }) => {
            const isExpanded = expandedId === item.id;
            const detail = isExpanded ? ticketDetail : undefined;
            return (
              <Animated.View entering={FadeInDown.delay(Math.min(index, 10) * 60).springify().damping(16)}>
                <TouchableOpacity style={s.card} activeOpacity={0.85} onPress={() => handleToggleExpand(item.id)}>
                  <View style={s.cardTopRow}>
                    <Text style={s.subject} numberOfLines={isExpanded ? undefined : 1}>{item.subject}</Text>
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={theme.colors.textFaint}
                    />
                  </View>
                  <View style={s.badgeRow}>
                    <View style={[s.badge, { backgroundColor: `${STATUS_COLORS[item.status]}1A` }]}>
                      <Text style={[s.badgeText, { color: STATUS_COLORS[item.status] }]}>{STATUS_LABELS[item.status]}</Text>
                    </View>
                    <View style={[s.badge, { backgroundColor: `${PRIORITY_COLORS[item.priority]}1A` }]}>
                      <Text style={[s.badgeText, { color: PRIORITY_COLORS[item.priority] }]}>{PRIORITY_LABELS[item.priority]}</Text>
                    </View>
                    <Text style={s.cardDate}>{fmtDate(item.createdAt)}</Text>
                  </View>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={s.threadWrap}>
                    {isFetchingDetail && !detail ? (
                      <ActivityIndicator color={theme.colors.primary} style={{ marginVertical: 16 }} />
                    ) : (
                      <>
                        {(detail?.messages ?? []).map((m: TicketMessage) => (
                          <View
                            key={m.id}
                            style={[s.messageBubble, m.fromStaff ? s.messageBubbleStaff : s.messageBubbleUser]}
                          >
                            <View style={s.messageHeader}>
                              <Text style={[s.messageAuthor, m.fromStaff && s.messageAuthorStaff]}>
                                {m.fromStaff ? `${m.author.name} · Suporte` : m.author.name}
                              </Text>
                              <Text style={s.messageTime}>{fmtDateTime(m.createdAt)}</Text>
                            </View>
                            <Text style={s.messageText}>{m.message}</Text>
                          </View>
                        ))}

                        <View style={s.replyRow}>
                          <TextInput
                            style={s.replyInput}
                            placeholder="Responder..."
                            placeholderTextColor={theme.colors.textFaint}
                            value={replyText}
                            onChangeText={setReplyText}
                            multiline
                          />
                          <TouchableOpacity
                            style={[s.replyBtn, !replyText.trim() && s.replyBtnDisabled]}
                            onPress={handleSendReply}
                            disabled={!replyText.trim() || sendReply.isPending}
                          >
                            {sendReply.isPending ? (
                              <ActivityIndicator color="#fff" size="small" />
                            ) : (
                              <Ionicons name="send" size={18} color="#fff" />
                            )}
                          </TouchableOpacity>
                        </View>
                      </>
                    )}
                  </View>
                )}
              </Animated.View>
            );
          }}
        />
      )}

      <Fab onPress={() => setShowForm(true)} />

      <Modal visible={showForm} animationType="slide" transparent>
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.modal}>
            <ScrollView>
              <View style={s.modalHandle} />
              <Text style={s.modalTitle}>Novo ticket</Text>

              <Text style={s.label}>Assunto *</Text>
              <TextInput
                style={s.input}
                value={newSubject}
                onChangeText={setNewSubject}
                placeholder="Ex: Dúvida sobre cobrança"
                placeholderTextColor={theme.colors.textFaint}
              />

              <Text style={s.label}>Prioridade</Text>
              <View style={s.priorityRow}>
                {PRIORITY_OPTIONS.map((p: TicketPriority) => (
                  <TouchableOpacity
                    key={p}
                    style={[s.priorityChip, newPriority === p && { backgroundColor: PRIORITY_COLORS[p], borderColor: PRIORITY_COLORS[p] }]}
                    onPress={() => { Haptics.selectionAsync(); setNewPriority(p); }}
                  >
                    <Text style={[s.priorityChipText, newPriority === p && s.priorityChipTextActive]}>{PRIORITY_LABELS[p]}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.label}>Mensagem *</Text>
              <TextInput
                style={[s.input, s.textArea]}
                value={newMessage}
                onChangeText={setNewMessage}
                placeholder="Descreva o que está acontecendo..."
                placeholderTextColor={theme.colors.textFaint}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
              />

              <View style={s.modalActions}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => setShowForm(false)}>
                  <Text style={s.cancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.saveBtn} onPress={handleCreate} disabled={createTicket.isPending}>
                  {createTicket.isPending ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>Enviar</Text>}
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
  hero: { paddingTop: 16, paddingHorizontal: 20, paddingBottom: 24, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  heroEyebrow: { color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  heroTitle: { color: '#fff', fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginTop: 4 },
  heroSub: { color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 4 },

  filterBar: { backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  filterScroll: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.radius.sm,
    backgroundColor: '#F2F4F1',
    marginRight: 8,
  },
  filterChipActive: { backgroundColor: theme.colors.primary },
  filterChipText: { fontSize: 13, fontWeight: '600', color: theme.colors.textMuted },
  filterChipTextActive: { color: '#fff' },

  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
  },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  subject: { fontSize: 15, fontWeight: '700', color: theme.colors.text, flex: 1, letterSpacing: -0.2 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: theme.radius.sm },
  badgeText: { fontSize: 11, fontWeight: '700' },
  cardDate: { fontSize: 12, color: theme.colors.textFaint, marginLeft: 'auto' },

  threadWrap: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: theme.colors.border,
    borderBottomLeftRadius: theme.radius.md,
    borderBottomRightRadius: theme.radius.md,
    marginTop: -12,
    marginBottom: 12,
    padding: 14,
    paddingTop: 4,
  },
  messageBubble: {
    borderRadius: theme.radius.sm,
    padding: 12,
    marginTop: 10,
    maxWidth: '92%',
  },
  messageBubbleUser: { backgroundColor: '#F2F4F1', alignSelf: 'flex-start' },
  messageBubbleStaff: { backgroundColor: '#E7F3EB', alignSelf: 'flex-end' },
  messageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4 },
  messageAuthor: { fontSize: 12, fontWeight: '700', color: theme.colors.textMuted },
  messageAuthorStaff: { color: theme.colors.primaryDark },
  messageTime: { fontSize: 10, color: theme.colors.textFaint },
  messageText: { fontSize: 14, color: theme.colors.text, lineHeight: 20 },

  replyRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 14 },
  replyInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: theme.colors.text,
    backgroundColor: '#FAFBFA',
    maxHeight: 100,
  },
  replyBtn: {
    width: 42,
    height: 42,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  replyBtnDisabled: { backgroundColor: theme.colors.textFaint },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(16,24,40,0.55)', justifyContent: 'flex-end' },
  modal: { backgroundColor: theme.colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '85%' },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: theme.colors.border, alignSelf: 'center', marginBottom: 14 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: theme.colors.text, marginBottom: 12, letterSpacing: -0.3 },
  label: { fontSize: 13, fontWeight: '600', color: theme.colors.textMuted, marginBottom: 4, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    padding: 12,
    fontSize: 15,
    backgroundColor: '#FAFBFA',
    color: theme.colors.text,
  },
  textArea: { height: 120 },
  priorityRow: { flexDirection: 'row', gap: 8 },
  priorityChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    backgroundColor: '#FAFBFA',
  },
  priorityChipText: { fontSize: 13, fontWeight: '700', color: theme.colors.textMuted },
  priorityChipTextActive: { color: '#fff' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20, marginBottom: 20 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: theme.radius.sm, backgroundColor: '#F2F4F1', alignItems: 'center' },
  cancelText: { fontSize: 15, fontWeight: '700', color: theme.colors.textMuted },
  saveBtn: { flex: 1, padding: 14, borderRadius: theme.radius.sm, backgroundColor: theme.colors.primary, alignItems: 'center' },
  saveText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
