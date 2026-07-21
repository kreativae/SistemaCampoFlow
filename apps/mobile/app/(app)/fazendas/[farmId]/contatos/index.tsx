import { useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { theme } from '../../../../../src/lib/theme';
import { apiFetch } from '../../../../../src/lib/api';
import { EmptyState } from '../../../../../src/components/EmptyState';
import { Fab } from '../../../../../src/components/UI';
import type { Contact, ContactCategory, ContactType } from '../../../../../src/lib/types';

const CATEGORY_OPTIONS: ContactCategory[] = [
  'FORNECEDOR',
  'CLIENTE',
  'VETERINARIO',
  'TRANSPORTADOR',
  'COMPRADOR',
  'PRESTADOR_SERVICO',
  'OUTRO',
];

const TYPE_OPTIONS: ContactType[] = ['PESSOA_FISICA', 'PESSOA_JURIDICA'];

const CATEGORY_LABELS: Record<ContactCategory, string> = {
  FORNECEDOR: 'Fornecedor',
  CLIENTE: 'Cliente',
  VETERINARIO: 'Veterinário',
  TRANSPORTADOR: 'Transportador',
  COMPRADOR: 'Comprador',
  PRESTADOR_SERVICO: 'Prestador de Serviço',
  OUTRO: 'Outro',
};

const CATEGORY_COLORS: Record<ContactCategory, { bg: string; fg: string }> = {
  FORNECEDOR: { bg: '#E7F3EB', fg: theme.colors.primary },
  CLIENTE: { bg: '#E6F4FF', fg: theme.colors.info },
  VETERINARIO: { bg: '#FDE9EC', fg: theme.colors.danger },
  TRANSPORTADOR: { bg: '#FFF3DC', fg: theme.colors.warning },
  COMPRADOR: { bg: '#EAF9F0', fg: theme.colors.success },
  PRESTADOR_SERVICO: { bg: '#F0EAFB', fg: '#6D28D9' },
  OUTRO: { bg: '#F2F4F7', fg: theme.colors.textMuted },
};

const TYPE_LABELS: Record<ContactType, string> = {
  PESSOA_FISICA: 'Pessoa Física',
  PESSOA_JURIDICA: 'Pessoa Jurídica',
};

interface ContactForm {
  type: ContactType;
  category: ContactCategory;
  name: string;
  tradeName: string;
  document: string;
  email: string;
  phone: string;
  whatsapp: string;
  addressStreet: string;
  addressCity: string;
  addressState: string;
  addressZip: string;
  notes: string;
}

const EMPTY_FORM: ContactForm = {
  type: 'PESSOA_FISICA',
  category: 'FORNECEDOR',
  name: '',
  tradeName: '',
  document: '',
  email: '',
  phone: '',
  whatsapp: '',
  addressStreet: '',
  addressCity: '',
  addressState: '',
  addressZip: '',
  notes: '',
};

function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

export default function ContactsScreen() {
  const { farmId } = useLocalSearchParams<{ farmId: string }>();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ContactCategory | 'TODOS'>('TODOS');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form, setForm] = useState<ContactForm>(EMPTY_FORM);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['contacts', farmId],
    queryFn: () => apiFetch<Contact[]>(`/fazendas/${farmId}/contatos`),
    enabled: !!farmId,
  });

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditing(null);
  };

  const createContact = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch(`/fazendas/${farmId}/contatos`, { method: 'POST', body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts', farmId] });
      setShowForm(false);
      resetForm();
    },
    onError: (err: any) => Alert.alert('Erro', err.message ?? 'Não foi possível salvar o contato'),
  });

  const updateContact = useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
      apiFetch(`/fazendas/${farmId}/contatos/${id}`, { method: 'PATCH', body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts', farmId] });
      setShowForm(false);
      resetForm();
    },
    onError: (err: any) => Alert.alert('Erro', err.message ?? 'Não foi possível salvar o contato'),
  });

  const deleteContact = useMutation({
    mutationFn: (id: string) => apiFetch(`/fazendas/${farmId}/contatos/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contacts', farmId] }),
    onError: (err: any) => Alert.alert('Erro', err.message ?? 'Não foi possível excluir o contato'),
  });

  const filtered = useMemo(() => {
    const list = data ?? [];
    const term = search.trim().toLowerCase();
    return list.filter((c: Contact) => {
      const matchesCategory = categoryFilter === 'TODOS' || c.category === categoryFilter;
      const matchesSearch =
        term.length === 0 ||
        c.name.toLowerCase().includes(term) ||
        (c.tradeName ?? '').toLowerCase().includes(term);
      return matchesCategory && matchesSearch;
    });
  }, [data, search, categoryFilter]);

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (contact: Contact) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditing(contact);
    setForm({
      type: contact.type,
      category: contact.category,
      name: contact.name,
      tradeName: contact.tradeName ?? '',
      document: contact.document ?? '',
      email: contact.email ?? '',
      phone: contact.phone ?? '',
      whatsapp: contact.whatsapp ?? '',
      addressStreet: contact.addressStreet ?? '',
      addressCity: contact.addressCity ?? '',
      addressState: contact.addressState ?? '',
      addressZip: contact.addressZip ?? '',
      notes: contact.notes ?? '',
    });
    setShowForm(true);
  };

  const confirmDelete = (contact: Contact) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert('Excluir contato?', `Deseja excluir "${contact.name}"? Esta ação não pode ser desfeita.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => deleteContact.mutate(contact.id) },
    ]);
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      Alert.alert('Erro', 'Nome é obrigatório');
      return;
    }
    const body: Record<string, unknown> = {
      type: form.type,
      category: form.category,
      name: form.name.trim(),
      tradeName: form.tradeName.trim() || null,
      document: form.document.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      whatsapp: form.whatsapp.trim() || null,
      addressStreet: form.addressStreet.trim() || null,
      addressCity: form.addressCity.trim() || null,
      addressState: form.addressState.trim() || null,
      addressZip: form.addressZip.trim() || null,
      notes: form.notes.trim() || null,
    };
    if (editing) updateContact.mutate({ id: editing.id, ...body });
    else createContact.mutate(body);
  };

  const call = (phone: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(`tel:${onlyDigits(phone)}`).catch(() => Alert.alert('Erro', 'Não foi possível abrir o discador'));
  };

  const whatsapp = (number: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(`https://wa.me/${onlyDigits(number)}`).catch(() =>
      Alert.alert('Erro', 'Não foi possível abrir o WhatsApp'),
    );
  };

  const sendEmail = (email: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(`mailto:${email}`).catch(() => Alert.alert('Erro', 'Não foi possível abrir o e-mail'));
  };

  if (isLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={s.searchWrap}>
        <Ionicons name="search" size={18} color={theme.colors.textFaint} />
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por nome..."
          placeholderTextColor={theme.colors.textFaint}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={theme.colors.textFaint} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.filterRow}
        style={s.filterScroll}
      >
        <TouchableOpacity
          style={[s.filterChip, categoryFilter === 'TODOS' && s.filterChipActive]}
          onPress={() => setCategoryFilter('TODOS')}
        >
          <Text style={[s.filterChipText, categoryFilter === 'TODOS' && s.filterChipTextActive]}>TODOS</Text>
        </TouchableOpacity>
        {CATEGORY_OPTIONS.map((cat: ContactCategory) => (
          <TouchableOpacity
            key={cat}
            style={[s.filterChip, categoryFilter === cat && s.filterChipActive]}
            onPress={() => setCategoryFilter(cat)}
          >
            <Text style={[s.filterChipText, categoryFilter === cat && s.filterChipTextActive]}>
              {CATEGORY_LABELS[cat]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {filtered.length === 0 ? (
        <EmptyState
          icon="👥"
          title="Nenhum contato"
          subtitle={search || categoryFilter !== 'TODOS' ? 'Nenhum resultado para o filtro atual' : 'Toque no + para cadastrar'}
        />
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={filtered}
          keyExtractor={(item: Contact) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          onRefresh={refetch}
          refreshing={isRefetching}
          renderItem={({ item, index }: { item: Contact; index: number }) => {
            const expanded = expandedId === item.id;
            const colors = CATEGORY_COLORS[item.category];
            const hasAddress = item.addressStreet || item.addressCity || item.addressState || item.addressZip;
            return (
              <Animated.View entering={FadeInDown.delay(Math.min(index, 10) * 60).springify().damping(16)}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setExpandedId(expanded ? null : item.id)}
                  onLongPress={() => confirmDelete(item)}
                  style={s.card}
                >
                  <View style={s.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <View style={s.nameRow}>
                        <Text style={s.name}>{item.name}</Text>
                      </View>
                      {!!item.tradeName && <Text style={s.tradeName}>{item.tradeName}</Text>}
                      <View style={s.badgeRow}>
                        <View style={s.typeBadge}>
                          <Text style={s.typeBadgeText}>{TYPE_LABELS[item.type]}</Text>
                        </View>
                        <View style={[s.categoryBadge, { backgroundColor: colors.bg }]}>
                          <Text style={[s.categoryBadgeText, { color: colors.fg }]}>
                            {CATEGORY_LABELS[item.category]}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => openEdit(item)} style={s.editBtn}>
                      <Ionicons name="pencil" size={16} color={theme.colors.textMuted} />
                    </TouchableOpacity>
                  </View>

                  <View style={s.infoRows}>
                    {!!item.phone && (
                      <TouchableOpacity style={s.infoRow} onPress={() => call(item.phone!)}>
                        <Ionicons name="call" size={15} color={theme.colors.info} />
                        <Text style={s.infoText}>{item.phone}</Text>
                      </TouchableOpacity>
                    )}
                    {!!item.whatsapp && (
                      <TouchableOpacity style={s.infoRow} onPress={() => whatsapp(item.whatsapp!)}>
                        <Ionicons name="logo-whatsapp" size={15} color={theme.colors.success} />
                        <Text style={s.infoText}>{item.whatsapp}</Text>
                      </TouchableOpacity>
                    )}
                    {!!item.email && (
                      <TouchableOpacity style={s.infoRow} onPress={() => sendEmail(item.email!)}>
                        <Ionicons name="mail" size={15} color={theme.colors.warning} />
                        <Text style={s.infoText}>{item.email}</Text>
                      </TouchableOpacity>
                    )}
                    {(item.addressCity || item.addressState) && (
                      <View style={s.infoRow}>
                        <Ionicons name="location" size={15} color={theme.colors.textFaint} />
                        <Text style={s.infoText}>
                          {[item.addressCity, item.addressState].filter(Boolean).join(' - ')}
                        </Text>
                      </View>
                    )}
                  </View>

                  {expanded && (
                    <View style={s.expandedWrap}>
                      {!!item.document && (
                        <View style={s.detailRow}>
                          <Text style={s.detailLabel}>Documento</Text>
                          <Text style={s.detailValue}>{item.document}</Text>
                        </View>
                      )}
                      {hasAddress && (
                        <View style={s.detailRow}>
                          <Text style={s.detailLabel}>Endereço</Text>
                          <Text style={s.detailValue}>
                            {[item.addressStreet, item.addressCity, item.addressState, item.addressZip]
                              .filter(Boolean)
                              .join(', ')}
                          </Text>
                        </View>
                      )}
                      {!!item.notes && (
                        <View style={s.detailRow}>
                          <Text style={s.detailLabel}>Observações</Text>
                          <Text style={s.detailValue}>{item.notes}</Text>
                        </View>
                      )}
                      <TouchableOpacity style={s.deleteBtn} onPress={() => confirmDelete(item)}>
                        <Ionicons name="trash" size={14} color={theme.colors.danger} />
                        <Text style={s.deleteBtnText}>Excluir contato</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </TouchableOpacity>
              </Animated.View>
            );
          }}
        />
      )}

      <Fab onPress={openCreate} />

      <Modal visible={showForm} animationType="slide" transparent>
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.modal}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <View style={s.handle} />
              <Text style={s.modalTitle}>{editing ? 'Editar Contato' : 'Novo Contato'}</Text>

              <Text style={s.label}>Tipo</Text>
              <View style={s.chipRow}>
                {TYPE_OPTIONS.map((t: ContactType) => (
                  <TouchableOpacity
                    key={t}
                    style={[s.chip, form.type === t && s.chipActive]}
                    onPress={() => setForm({ ...form, type: t })}
                  >
                    <Text style={[s.chipText, form.type === t && s.chipTextActive]}>{TYPE_LABELS[t]}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.label}>Categoria</Text>
              <View style={s.chipRow}>
                {CATEGORY_OPTIONS.map((c: ContactCategory) => (
                  <TouchableOpacity
                    key={c}
                    style={[s.chip, form.category === c && s.chipActive]}
                    onPress={() => setForm({ ...form, category: c })}
                  >
                    <Text style={[s.chipText, form.category === c && s.chipTextActive]}>
                      {CATEGORY_LABELS[c]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.label}>Nome *</Text>
              <TextInput
                style={s.input}
                value={form.name}
                onChangeText={(v: string) => setForm({ ...form, name: v })}
                placeholder="Nome completo ou razão social"
              />

              <Text style={s.label}>Nome fantasia</Text>
              <TextInput
                style={s.input}
                value={form.tradeName}
                onChangeText={(v: string) => setForm({ ...form, tradeName: v })}
                placeholder="Nome fantasia (opcional)"
              />

              <Text style={s.label}>CPF/CNPJ</Text>
              <TextInput
                style={s.input}
                value={form.document}
                onChangeText={(v: string) => setForm({ ...form, document: v })}
                placeholder="Documento"
                keyboardType="numeric"
              />

              <Text style={s.label}>E-mail</Text>
              <TextInput
                style={s.input}
                value={form.email}
                onChangeText={(v: string) => setForm({ ...form, email: v })}
                placeholder="email@exemplo.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={s.label}>Telefone</Text>
              <TextInput
                style={s.input}
                value={form.phone}
                onChangeText={(v: string) => setForm({ ...form, phone: v })}
                placeholder="(00) 00000-0000"
                keyboardType="phone-pad"
              />

              <Text style={s.label}>WhatsApp</Text>
              <TextInput
                style={s.input}
                value={form.whatsapp}
                onChangeText={(v: string) => setForm({ ...form, whatsapp: v })}
                placeholder="(00) 00000-0000"
                keyboardType="phone-pad"
              />

              <Text style={s.label}>Endereço</Text>
              <TextInput
                style={s.input}
                value={form.addressStreet}
                onChangeText={(v: string) => setForm({ ...form, addressStreet: v })}
                placeholder="Rua, número"
              />

              <View style={s.formRow}>
                <View style={{ flex: 2 }}>
                  <Text style={s.label}>Cidade</Text>
                  <TextInput
                    style={s.input}
                    value={form.addressCity}
                    onChangeText={(v: string) => setForm({ ...form, addressCity: v })}
                    placeholder="Cidade"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>UF</Text>
                  <TextInput
                    style={s.input}
                    value={form.addressState}
                    onChangeText={(v: string) => setForm({ ...form, addressState: v.toUpperCase() })}
                    placeholder="UF"
                    maxLength={2}
                    autoCapitalize="characters"
                  />
                </View>
              </View>

              <Text style={s.label}>CEP</Text>
              <TextInput
                style={s.input}
                value={form.addressZip}
                onChangeText={(v: string) => setForm({ ...form, addressZip: v })}
                placeholder="00000-000"
                keyboardType="numeric"
              />

              <Text style={s.label}>Observações</Text>
              <TextInput
                style={[s.input, s.textArea]}
                value={form.notes}
                onChangeText={(v: string) => setForm({ ...form, notes: v })}
                placeholder="Observações adicionais"
                multiline
                numberOfLines={4}
              />

              <View style={s.modalActions}>
                <TouchableOpacity
                  style={s.cancelBtn}
                  onPress={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                >
                  <Text style={s.cancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.saveBtn}
                  onPress={handleSave}
                  disabled={createContact.isPending || updateContact.isPending}
                >
                  {createContact.isPending || updateContact.isPending ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={s.saveText}>Salvar</Text>
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
  container: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 15, color: theme.colors.text },
  filterScroll: { flexGrow: 0, marginBottom: 6 },
  filterRow: { paddingHorizontal: 16, gap: 8, paddingVertical: 4 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterChipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  filterChipText: { fontSize: 12, fontWeight: '600', color: theme.colors.textMuted },
  filterChipTextActive: { color: '#fff' },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 16, fontWeight: '700', color: theme.colors.text },
  tradeName: { fontSize: 13, color: theme.colors.textMuted, marginTop: 1 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: theme.colors.bg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  typeBadgeText: { fontSize: 11, fontWeight: '600', color: theme.colors.textMuted },
  categoryBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  categoryBadgeText: { fontSize: 11, fontWeight: '700' },
  editBtn: { padding: 6 },
  infoRows: { marginTop: 12, gap: 8 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { fontSize: 13, color: theme.colors.text, flexShrink: 1 },
  expandedWrap: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.colors.border, gap: 10 },
  detailRow: { gap: 2 },
  detailLabel: { fontSize: 11, fontWeight: '700', color: theme.colors.textFaint, textTransform: 'uppercase' },
  detailValue: { fontSize: 13, color: theme.colors.text },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, alignSelf: 'flex-start' },
  deleteBtnText: { fontSize: 13, fontWeight: '600', color: theme.colors.danger },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(16,24,40,0.55)', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '90%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    alignSelf: 'center',
    marginBottom: 14,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3, color: theme.colors.primary, marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: theme.colors.textMuted, marginBottom: 4, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    padding: 12,
    fontSize: 15,
    backgroundColor: theme.colors.bg,
    color: theme.colors.text,
  },
  textArea: { minHeight: 90, textAlignVertical: 'top' },
  formRow: { flexDirection: 'row', gap: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.bg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipText: { fontSize: 13, color: theme.colors.textMuted },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20, marginBottom: 20 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: theme.radius.sm, backgroundColor: theme.colors.bg, alignItems: 'center' },
  cancelText: { fontSize: 15, fontWeight: '600', color: theme.colors.textMuted },
  saveBtn: { flex: 1, padding: 14, borderRadius: theme.radius.sm, backgroundColor: theme.colors.primary, alignItems: 'center' },
  saveText: { fontSize: 15, fontWeight: '600', color: '#fff' },
});
