import { useState, useMemo } from 'react';
import { DateInput } from '../../../../../src/components/DateInput';
import { View, Text, SectionList, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Alert, Modal, ScrollView, KeyboardAvoidingView, Platform, FlatList } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pencil, CheckCircle, AlertTriangle } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { theme } from '../../../../../src/lib/theme';
import { Fab } from '../../../../../src/components/UI';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../../../../src/lib/api';
import { EmptyState } from '../../../../../src/components/EmptyState';

interface AgendaEvent {
  id: string;
  title: string;
  type: 'VACINACAO' | 'PESAGEM' | 'MANEJO' | 'COMPRA' | 'VENDA' | 'OUTRO';
  scheduledDate: string;
  completedAt: string | null;
  notes: string | null;
}

interface AgendaAlert extends AgendaEvent {
  overdue: boolean;
}

const EVENT_TYPES = ['VACINACAO', 'PESAGEM', 'MANEJO', 'COMPRA', 'VENDA', 'OUTRO'] as const;

const TYPE_LABELS: Record<string, string> = {
  VACINACAO: 'Vacinação',
  PESAGEM: 'Pesagem',
  MANEJO: 'Manejo',
  COMPRA: 'Compra',
  VENDA: 'Venda',
  OUTRO: 'Outro',
};

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function formatDateInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function AgendaScreen() {
  const { farmId } = useLocalSearchParams<{ farmId: string }>();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<AgendaEvent | null>(null);
  const [form, setForm] = useState({ title: '', type: 'MANEJO' as string, notes: '', scheduledDate: formatDateInput(new Date()) });
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['events', farmId],
    queryFn: () => apiFetch<AgendaEvent[]>(`/fazendas/${farmId}/agenda`),
    enabled: !!farmId,
  });

  const { data: alertsData } = useQuery({
    queryKey: ['events-alerts', farmId],
    queryFn: () => apiFetch<AgendaAlert[]>(`/fazendas/${farmId}/agenda/alertas`),
    enabled: !!farmId,
  });

  const createEvent = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiFetch(`/fazendas/${farmId}/agenda`, { method: 'POST', body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', farmId] });
      queryClient.invalidateQueries({ queryKey: ['events-alerts', farmId] });
      closeForm();
    },
    onError: (err: Error) => Alert.alert('Erro', err.message),
  });

  const updateEvent = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      apiFetch(`/fazendas/${farmId}/agenda/${id}`, { method: 'PATCH', body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', farmId] });
      queryClient.invalidateQueries({ queryKey: ['events-alerts', farmId] });
      closeForm();
    },
    onError: (err: Error) => Alert.alert('Erro', err.message),
  });

  const completeEvent = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/fazendas/${farmId}/agenda/${id}/concluir`, { method: 'PATCH' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', farmId] });
      queryClient.invalidateQueries({ queryKey: ['events-alerts', farmId] });
    },
    onError: (err: Error) => Alert.alert('Erro', err.message),
  });

  const deleteEvent = useMutation({
    mutationFn: (id: string) => apiFetch(`/fazendas/${farmId}/agenda/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', farmId] });
      queryClient.invalidateQueries({ queryKey: ['events-alerts', farmId] });
    },
    onError: (err: Error) => Alert.alert('Erro', err.message),
  });

  function closeForm() {
    setShowForm(false);
    setEditingEvent(null);
    setForm({ title: '', type: 'MANEJO', notes: '', scheduledDate: formatDateInput(new Date()) });
  }

  function openCreate() {
    setEditingEvent(null);
    setForm({ title: '', type: 'MANEJO', notes: '', scheduledDate: formatDateInput(new Date()) });
    setShowForm(true);
  }

  function openEdit(event: AgendaEvent) {
    setEditingEvent(event);
    setForm({
      title: event.title,
      type: event.type,
      notes: event.notes || '',
      scheduledDate: event.scheduledDate ? event.scheduledDate.slice(0, 10) : formatDateInput(new Date()),
    });
    setShowForm(true);
  }

  function handleSave() {
    if (!form.title) { Alert.alert('Erro', 'Título é obrigatório'); return; }
    const body = {
      title: form.title,
      type: form.type,
      scheduledDate: new Date(form.scheduledDate + 'T12:00:00').toISOString(),
      notes: form.notes || undefined,
    };
    if (editingEvent) {
      updateEvent.mutate({ id: editingEvent.id, body });
    } else {
      createEvent.mutate(body);
    }
  }

  const isSaving = createEvent.isPending || updateEvent.isPending;

  // Alerts banner
  const overdueCount = alertsData?.filter((a: AgendaAlert) => a.overdue).length ?? 0;
  const pendingAlertCount = alertsData?.length ?? 0;

  // Calendar helpers
  const calendarDays = useMemo(() => {
    const { year, month } = calendarMonth;
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }, [calendarMonth]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, AgendaEvent[]> = {};
    (data ?? []).forEach((e: AgendaEvent) => {
      const key = e.scheduledDate.slice(0, 10);
      (map[key] ??= []).push(e);
    });
    return map;
  }, [data]);

  function dayKey(day: number): string {
    const { year, month } = calendarMonth;
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const todayStr = formatDateInput(new Date());

  const monthLabel = new Date(calendarMonth.year, calendarMonth.month).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  function prevMonth() {
    setCalendarMonth((prev) => {
      if (prev.month === 0) return { year: prev.year - 1, month: 11 };
      return { ...prev, month: prev.month - 1 };
    });
    setSelectedDay(null);
  }

  function nextMonth() {
    setCalendarMonth((prev) => {
      if (prev.month === 11) return { year: prev.year + 1, month: 0 };
      return { ...prev, month: prev.month + 1 };
    });
    setSelectedDay(null);
  }

  // Selected day events for calendar view
  const selectedDayEvents = selectedDay ? (eventsByDate[selectedDay] ?? []) : [];

  // Grouped sections for list view
  const sections = useMemo(() => {
    if (!data?.length) return [];
    const grouped: Record<string, AgendaEvent[]> = {};
    data.forEach((e: AgendaEvent) => {
      const key = new Date(e.scheduledDate).toLocaleDateString('pt-BR');
      (grouped[key] ??= []).push(e);
    });
    return Object.entries(grouped)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map((entry) => ({ title: entry[0], data: entry[1] as AgendaEvent[] }));
  }, [data]);

  function renderEventCard(item: AgendaEvent, index: number) {
    const isCompleted = !!item.completedAt;
    return (
      <Animated.View entering={FadeInDown.delay(Math.min(index, 10) * 60).springify().damping(16)}>
        <TouchableOpacity
          activeOpacity={0.7}
          onLongPress={() =>
            Alert.alert('Excluir evento?', `Deseja excluir "${item.title}"?`, [
              { text: 'Não' },
              { text: 'Sim', style: 'destructive', onPress: () => deleteEvent.mutate(item.id) },
            ])
          }
        >
          <View style={[s.card, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
            <View style={s.eventIcon}>
              <Ionicons name="calendar" size={18} color={theme.colors.info} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={s.title}>{item.title}</Text>
                {isCompleted && (
                  <View style={s.completedBadge}>
                    <Text style={s.completedBadgeText}>Concluído</Text>
                  </View>
                )}
              </View>
              <Text style={s.type}>{TYPE_LABELS[item.type] ?? item.type}</Text>
              {item.notes ? <Text style={s.desc}>{item.notes}</Text> : null}
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {!isCompleted && (
                <TouchableOpacity
                  onPress={() => completeEvent.mutate(item.id)}
                  hitSlop={8}
                  style={s.iconBtn}
                >
                  <CheckCircle size={20} color={theme.colors.success} />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => openEdit(item)} hitSlop={8} style={s.iconBtn}>
                <Pencil size={18} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  function renderAlertsBanner() {
    if (!pendingAlertCount) return null;
    return (
      <View style={s.alertsBanner}>
        <AlertTriangle size={18} color={theme.colors.warning} />
        <Text style={s.alertsText}>
          {pendingAlertCount} evento{pendingAlertCount !== 1 ? 's' : ''} pendente{pendingAlertCount !== 1 ? 's' : ''}
          {overdueCount > 0 ? ` (${overdueCount} atrasado${overdueCount !== 1 ? 's' : ''})` : ''}
        </Text>
      </View>
    );
  }

  function renderViewToggle() {
    return (
      <View style={s.toggleRow}>
        <TouchableOpacity
          style={[s.toggleBtn, viewMode === 'list' && s.toggleBtnActive]}
          onPress={() => setViewMode('list')}
        >
          <Text style={[s.toggleText, viewMode === 'list' && s.toggleTextActive]}>Lista</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.toggleBtn, viewMode === 'calendar' && s.toggleBtnActive]}
          onPress={() => setViewMode('calendar')}
        >
          <Text style={[s.toggleText, viewMode === 'calendar' && s.toggleTextActive]}>Calendário</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderCalendar() {
    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
        {/* Month header */}
        <View style={s.calendarHeader}>
          <TouchableOpacity onPress={prevMonth} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={s.calendarMonthLabel}>{monthLabel}</Text>
          <TouchableOpacity onPress={nextMonth} hitSlop={12}>
            <Ionicons name="chevron-forward" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        {/* Weekday labels */}
        <View style={s.weekdayRow}>
          {WEEKDAY_LABELS.map((label: string) => (
            <View key={label} style={s.weekdayCell}>
              <Text style={s.weekdayText}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Day grid */}
        <View style={s.calendarGrid}>
          {calendarDays.map((day: number | null, idx: number) => {
            if (day === null) {
              return <View key={`empty-${idx}`} style={s.dayCell} />;
            }
            const key = dayKey(day);
            const dayEvents = eventsByDate[key] ?? [];
            const isToday = key === todayStr;
            const isSelected = key === selectedDay;
            const hasPending = dayEvents.some((e: AgendaEvent) => !e.completedAt);
            const hasCompleted = dayEvents.some((e: AgendaEvent) => !!e.completedAt);

            return (
              <TouchableOpacity
                key={key}
                style={[s.dayCell, isToday && s.dayCellToday, isSelected && s.dayCellSelected]}
                onPress={() => setSelectedDay(key)}
                activeOpacity={0.6}
              >
                <Text style={[s.dayText, isToday && s.dayTextToday, isSelected && s.dayTextSelected]}>
                  {day}
                </Text>
                {dayEvents.length > 0 && (
                  <View style={s.dotRow}>
                    {hasPending && <View style={[s.dot, { backgroundColor: theme.colors.success }]} />}
                    {hasCompleted && <View style={[s.dot, { backgroundColor: theme.colors.textFaint }]} />}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Selected day events */}
        {selectedDay && (
          <View style={{ marginTop: 16 }}>
            <Text style={s.sectionHeader}>
              {new Date(selectedDay + 'T12:00:00').toLocaleDateString('pt-BR')}
            </Text>
            {selectedDayEvents.length === 0 ? (
              <Text style={s.noEventsText}>Nenhum evento neste dia</Text>
            ) : (
              selectedDayEvents.map((item: AgendaEvent, idx: number) => (
                <View key={item.id}>{renderEventCard(item, idx)}</View>
              ))
            )}
          </View>
        )}
      </ScrollView>
    );
  }

  function renderModal() {
    return (
      <Modal visible={showForm} animationType="slide" transparent>
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.modal}>
            <ScrollView>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: theme.colors.border, alignSelf: 'center', marginBottom: 14 }} />
              <Text style={s.modalTitle}>{editingEvent ? 'Editar Evento' : 'Novo Evento'}</Text>

              <Text style={s.label}>Título *</Text>
              <TextInput
                style={s.input}
                value={form.title}
                onChangeText={(v: string) => setForm({ ...form, title: v })}
                placeholder="Ex: Vacinação do lote 3"
              />

              <DateInput label="Data" value={form.scheduledDate} onChange={(v: string) => setForm({ ...form, scheduledDate: v })} />

              <Text style={s.label}>Tipo</Text>
              <View style={s.chipRow}>
                {EVENT_TYPES.map((t: typeof EVENT_TYPES[number]) => (
                  <TouchableOpacity
                    key={t}
                    style={[s.chip, form.type === t && s.chipActive]}
                    onPress={() => setForm({ ...form, type: t })}
                  >
                    <Text style={[s.chipText, form.type === t && s.chipTextActive]}>
                      {TYPE_LABELS[t]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.label}>Observações</Text>
              <TextInput
                style={[s.input, { height: 80 }]}
                value={form.notes}
                onChangeText={(v: string) => setForm({ ...form, notes: v })}
                multiline
                placeholder="Opcional"
              />

              <View style={s.modalActions}>
                <TouchableOpacity style={s.cancelBtn} onPress={closeForm}>
                  <Text style={s.cancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={isSaving}>
                  {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>Salvar</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  }

  if (isLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={s.container}>
      {renderAlertsBanner()}
      {renderViewToggle()}

      {viewMode === 'calendar' ? (
        renderCalendar()
      ) : !data?.length ? (
        <View style={{ flex: 1 }}>
          <EmptyState icon="📅" title="Nenhum evento" subtitle="Toque no + para cadastrar" />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(e: AgendaEvent) => e.id}
          contentContainerStyle={{ padding: 16 }}
          onRefresh={refetch}
          refreshing={false}
          renderSectionHeader={({ section }: { section: { title: string } }) => (
            <Text style={s.sectionHeader}>{section.title}</Text>
          )}
          renderItem={({ item, index }: { item: AgendaEvent; index: number }) =>
            renderEventCard(item, index)
          }
        />
      )}

      <Fab onPress={openCreate} />
      {renderModal()}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  sectionHeader: { fontSize: 14, fontWeight: '700', color: theme.colors.primary, marginTop: 12, marginBottom: 6 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: theme.colors.border, shadowColor: '#101828', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  eventIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#E8EEFC', justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 15, fontWeight: '600', color: '#333' },
  type: { fontSize: 12, color: '#666', marginTop: 2 },
  desc: { fontSize: 13, color: '#999', marginTop: 4 },
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
  iconBtn: { padding: 4 },
  completedBadge: { backgroundColor: theme.colors.success, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  completedBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  // Alerts banner
  alertsBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF8E1', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#FFE082' },
  alertsText: { fontSize: 13, fontWeight: '600', color: '#795548' },
  // View toggle
  toggleRow: { flexDirection: 'row', marginHorizontal: 16, marginTop: 12, marginBottom: 4, backgroundColor: '#f0f0f0', borderRadius: 10, padding: 3 },
  toggleBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  toggleText: { fontSize: 14, fontWeight: '600', color: theme.colors.textMuted },
  toggleTextActive: { color: theme.colors.primary },
  // Calendar
  calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  calendarMonthLabel: { fontSize: 17, fontWeight: '700', color: theme.colors.text, textTransform: 'capitalize' },
  weekdayRow: { flexDirection: 'row', marginBottom: 4 },
  weekdayCell: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  weekdayText: { fontSize: 12, fontWeight: '600', color: theme.colors.textMuted },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', padding: 2 },
  dayCellToday: { borderWidth: 2, borderColor: theme.colors.primary, borderRadius: 20 },
  dayCellSelected: { backgroundColor: theme.colors.primary, borderRadius: 20 },
  dayText: { fontSize: 14, fontWeight: '500', color: theme.colors.text },
  dayTextToday: { fontWeight: '700', color: theme.colors.primary },
  dayTextSelected: { color: '#fff', fontWeight: '700' },
  dotRow: { flexDirection: 'row', gap: 3, marginTop: 2 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  noEventsText: { fontSize: 13, color: theme.colors.textMuted, fontStyle: 'italic', marginTop: 4 },
});
