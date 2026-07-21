import { useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Switch,
  Alert,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { theme } from '../../../../../src/lib/theme';
import { apiFetch } from '../../../../../src/lib/api';
import { EmptyState } from '../../../../../src/components/EmptyState';
import type { AppNotification, NotificationSource } from '../../../../../src/lib/types';

type SourceFilter = 'TODOS' | NotificationSource;

const SOURCE_FILTERS: SourceFilter[] = ['TODOS', 'SANIDADE', 'AGENDA', 'INSUMOS', 'CLIMA', 'OUTRO'];

const SOURCE_LABELS: Record<NotificationSource, string> = {
  SANIDADE: 'Sanidade',
  AGENDA: 'Agenda',
  INSUMOS: 'Insumos',
  CLIMA: 'Clima',
  OUTRO: 'Outro',
};

function sourceColor(source: NotificationSource): string {
  switch (source) {
    case 'SANIDADE':
      return theme.colors.danger;
    case 'AGENDA':
      return theme.colors.info;
    case 'INSUMOS':
      return theme.colors.warning;
    case 'CLIMA':
      return theme.colors.accent;
    case 'OUTRO':
    default:
      return theme.colors.textMuted;
  }
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function NotificationsScreen() {
  const { farmId } = useLocalSearchParams<{ farmId: string }>();
  const qc = useQueryClient();

  const [onlyUnread, setOnlyUnread] = useState<boolean>(false);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('TODOS');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['notifications', farmId],
    queryFn: () => apiFetch<AppNotification[]>(`/fazendas/${farmId}/notificacoes`),
    enabled: !!farmId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['notifications', farmId] });

  const markRead = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/fazendas/${farmId}/notificacoes/${id}/lida`, { method: 'PATCH' }),
    onSuccess: invalidate,
  });

  const markAllRead = useMutation({
    mutationFn: () =>
      apiFetch(`/fazendas/${farmId}/notificacoes/ler-todas`, { method: 'PATCH' }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      invalidate();
    },
  });

  const deleteOne = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/fazendas/${farmId}/notificacoes/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });

  const deleteBatch = useMutation({
    mutationFn: (ids: string[]) =>
      apiFetch(`/fazendas/${farmId}/notificacoes/excluir-lote`, {
        method: 'POST',
        body: { ids },
      }),
    onSuccess: () => {
      setSelectedIds([]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      invalidate();
    },
  });

  const markBatchRead = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(
        ids.map((id: string) =>
          apiFetch(`/fazendas/${farmId}/notificacoes/${id}/lida`, { method: 'PATCH' }),
        ),
      );
    },
    onSuccess: () => {
      setSelectedIds([]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      invalidate();
    },
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    return data
      .filter((n: AppNotification) => (onlyUnread ? !n.read : true))
      .filter((n: AppNotification) => (sourceFilter === 'TODOS' ? true : n.source === sourceFilter));
  }, [data, onlyUnread, sourceFilter]);

  const unreadCount = useMemo(
    () => (data ?? []).filter((n: AppNotification) => !n.read).length,
    [data],
  );

  const isSelectionMode = selectedIds.length > 0;

  const toggleSelect = (id: string) => {
    Haptics.selectionAsync();
    setSelectedIds((prev: string[]) =>
      prev.includes(id) ? prev.filter((x: string) => x !== id) : [...prev, id],
    );
  };

  const toggleSelectAll = () => {
    Haptics.selectionAsync();
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map((n: AppNotification) => n.id));
    }
  };

  const handleLongPress = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    toggleSelect(id);
  };

  const handlePress = (item: AppNotification) => {
    if (isSelectionMode) {
      toggleSelect(item.id);
      return;
    }
    if (!item.read) {
      markRead.mutate(item.id);
    }
  };

  const confirmDeleteOne = (id: string) => {
    Alert.alert('Excluir notificação', 'Deseja excluir esta notificação?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          deleteOne.mutate(id);
        },
      },
    ]);
  };

  const confirmDeleteBatch = () => {
    Alert.alert(
      'Excluir notificações',
      `Deseja excluir ${selectedIds.length} notificação(ões) selecionada(s)?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => deleteBatch.mutate(selectedIds),
        },
      ],
    );
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
      <View style={s.header}>
        <View style={s.headerTop}>
          <View style={s.headerTitleRow}>
            <Text style={s.headerTitle}>Notificações</Text>
            {unreadCount > 0 && (
              <View style={s.unreadBadge}>
                <Text style={s.unreadBadgeText}>{unreadCount}</Text>
              </View>
            )}
          </View>
          {unreadCount > 0 && (
            <TouchableOpacity
              onPress={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              style={s.markAllButton}
            >
              <Text style={s.markAllText}>Marcar todas como lidas</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={s.unreadToggleRow}>
          <Text style={s.unreadToggleLabel}>Só não lidas</Text>
          <Switch
            value={onlyUnread}
            onValueChange={setOnlyUnread}
            trackColor={{ false: theme.colors.border, true: theme.colors.primaryLight }}
            thumbColor={theme.colors.surface}
          />
        </View>

        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={SOURCE_FILTERS}
          keyExtractor={(item: SourceFilter) => item}
          contentContainerStyle={s.chipsRow}
          renderItem={({ item }: { item: SourceFilter }) => {
            const active = sourceFilter === item;
            return (
              <TouchableOpacity
                style={[s.chip, active && s.chipActive]}
                onPress={() => setSourceFilter(item)}
              >
                <Text style={[s.chipText, active && s.chipTextActive]}>
                  {item === 'TODOS' ? 'TODOS' : SOURCE_LABELS[item].toUpperCase()}
                </Text>
              </TouchableOpacity>
            );
          }}
        />

        {isSelectionMode && (
          <View style={s.batchBar}>
            <TouchableOpacity style={s.batchSelectAll} onPress={toggleSelectAll}>
              <View style={[s.checkbox, selectedIds.length === filtered.length && s.checkboxChecked]}>
                {selectedIds.length === filtered.length && <Text style={s.checkboxMark}>✓</Text>}
              </View>
              <Text style={s.batchCountText}>{selectedIds.length} selecionada(s)</Text>
            </TouchableOpacity>
            <View style={s.batchActions}>
              <TouchableOpacity
                style={s.batchActionButton}
                onPress={() => markBatchRead.mutate(selectedIds)}
                disabled={markBatchRead.isPending}
              >
                <Text style={s.batchActionText}>Marcar como lida</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.batchActionButton, s.batchDeleteButton]}
                onPress={confirmDeleteBatch}
                disabled={deleteBatch.isPending}
              >
                <Text style={[s.batchActionText, s.batchDeleteText]}>Excluir</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {filtered.length === 0 ? (
        <EmptyState
          icon="🔔"
          title="Nenhuma notificação"
          subtitle={onlyUnread ? 'Você está em dia com suas notificações.' : undefined}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(n: AppNotification) => n.id}
          contentContainerStyle={s.listContent}
          onRefresh={refetch}
          refreshing={isRefetching}
          renderItem={({ item, index }: { item: AppNotification; index: number }) => {
            const selected = selectedIds.includes(item.id);
            return (
              <Animated.View entering={FadeInDown.delay(Math.min(index, 10) * 30)}>
                <TouchableOpacity
                  style={[s.card, !item.read && s.cardUnread, selected && s.cardSelected]}
                  onPress={() => handlePress(item)}
                  onLongPress={() => handleLongPress(item.id)}
                  delayLongPress={300}
                >
                  <View style={s.cardRow}>
                    {isSelectionMode && (
                      <TouchableOpacity
                        style={[s.checkbox, s.cardCheckbox, selected && s.checkboxChecked]}
                        onPress={() => toggleSelect(item.id)}
                      >
                        {selected && <Text style={s.checkboxMark}>✓</Text>}
                      </TouchableOpacity>
                    )}
                    <View style={s.cardBody}>
                      <View style={s.cardTopRow}>
                        <View style={s.cardTitleRow}>
                          {!item.read && <View style={s.unreadDot} />}
                          <Text style={[s.cardTitle, !item.read && s.cardTitleUnread]} numberOfLines={2}>
                            {item.title}
                          </Text>
                        </View>
                        <View style={[s.sourceBadge, { backgroundColor: `${sourceColor(item.source)}1A` }]}>
                          <Text style={[s.sourceBadgeText, { color: sourceColor(item.source) }]}>
                            {SOURCE_LABELS[item.source] ?? item.source}
                          </Text>
                        </View>
                      </View>
                      <Text style={s.cardMessage} numberOfLines={3}>
                        {item.message}
                      </Text>
                      <View style={s.cardFooter}>
                        <Text style={s.cardDate}>{fmtDate(item.createdAt)}</Text>
                        {!isSelectionMode && (
                          <TouchableOpacity onPress={() => confirmDeleteOne(item.id)} hitSlop={8}>
                            <Text style={s.deleteLink}>Excluir</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            );
          }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.bg },
  header: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: 10,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: theme.colors.text },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  markAllButton: { paddingVertical: 4, paddingHorizontal: 8 },
  markAllText: { color: theme.colors.primary, fontSize: 13, fontWeight: '600' },
  unreadToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  unreadToggleLabel: { fontSize: 14, color: theme.colors.text, fontWeight: '500' },
  chipsRow: { gap: 8, paddingVertical: 4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.bg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  chipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  chipText: { fontSize: 12, fontWeight: '600', color: theme.colors.textMuted },
  chipTextActive: { color: '#fff' },
  batchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.bg,
    borderRadius: theme.radius.md,
    padding: 10,
    marginTop: 4,
  },
  batchSelectAll: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  batchCountText: { fontSize: 13, fontWeight: '600', color: theme.colors.text },
  batchActions: { flexDirection: 'row', gap: 8 },
  batchActionButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  batchActionText: { fontSize: 12, fontWeight: '600', color: theme.colors.text },
  batchDeleteButton: { borderColor: theme.colors.danger },
  batchDeleteText: { color: theme.colors.danger },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  checkboxChecked: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  checkboxMark: { color: '#fff', fontSize: 12, fontWeight: '700' },
  cardCheckbox: { marginRight: 10, marginTop: 2 },
  listContent: { padding: 16, gap: 10 },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 14,
    marginBottom: 10,
    ...theme.shadow.card,
  },
  cardUnread: {
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
  },
  cardSelected: {
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
  },
  cardRow: { flexDirection: 'row' },
  cardBody: { flex: 1 },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 4,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: theme.colors.primary,
  },
  cardTitle: { fontSize: 14, fontWeight: '500', color: theme.colors.text, flexShrink: 1 },
  cardTitleUnread: { fontWeight: '700' },
  sourceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.sm,
  },
  sourceBadgeText: { fontSize: 10, fontWeight: '700' },
  cardMessage: { fontSize: 13, color: theme.colors.textMuted, lineHeight: 19 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  cardDate: { fontSize: 11, color: theme.colors.textFaint },
  deleteLink: { fontSize: 12, fontWeight: '600', color: theme.colors.danger },
});
