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
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { theme } from '../../../../../src/lib/theme';
import { apiFetch, apiUpload, apiDownload } from '../../../../../src/lib/api';
import { EmptyState } from '../../../../../src/components/EmptyState';
import { Fab } from '../../../../../src/components/UI';
import type { FarmDocument, DocumentCategory } from '../../../../../src/lib/types';

type CategoryFilter = 'TODOS' | DocumentCategory;
type PeriodFilter = 'TODOS' | 'DIA' | 'SEMANA' | 'MES' | 'ANO';

const CATEGORIES: DocumentCategory[] = ['GTA', 'NFE', 'CONTRATO', 'EXAME', 'CERTIFICADO', 'OUTRO'];

const CATEGORY_LABELS: Record<DocumentCategory, string> = {
  GTA: 'GTA',
  NFE: 'Nota Fiscal',
  CONTRATO: 'Contrato',
  EXAME: 'Exame',
  CERTIFICADO: 'Certificado',
  OUTRO: 'Outro',
};

const CATEGORY_COLORS: Record<DocumentCategory, { bg: string; fg: string }> = {
  GTA: { bg: '#EAF3FF', fg: theme.colors.info },
  NFE: { bg: '#E9FBF0', fg: theme.colors.success },
  CONTRATO: { bg: '#F1EBFF', fg: '#6D28D9' },
  EXAME: { bg: '#FFF4E5', fg: theme.colors.warning },
  CERTIFICADO: { bg: '#EAF7EE', fg: theme.colors.primary },
  OUTRO: { bg: '#F2F4F7', fg: theme.colors.textMuted },
};

const PERIOD_LABELS: Record<PeriodFilter, string> = {
  TODOS: 'Todos',
  DIA: 'Hoje',
  SEMANA: 'Semana',
  MES: 'Mês',
  ANO: 'Ano',
};

const CATEGORY_ICONS: Record<DocumentCategory, keyof typeof Ionicons.glyphMap> = {
  GTA: 'document-text',
  NFE: 'receipt',
  CONTRATO: 'document',
  EXAME: 'flask',
  CERTIFICADO: 'ribbon',
  OUTRO: 'folder',
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}

function isWithinPeriod(iso: string, period: PeriodFilter): boolean {
  if (period === 'TODOS') return true;
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (period === 'DIA') return diffDays <= 1;
  if (period === 'SEMANA') return diffDays <= 7;
  if (period === 'MES') return diffDays <= 31;
  if (period === 'ANO') return diffDays <= 366;
  return true;
}

export default function DocumentsScreen() {
  const { farmId } = useLocalSearchParams<{ farmId: string }>();
  const queryClient = useQueryClient();

  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('TODOS');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('TODOS');

  const [showUpload, setShowUpload] = useState(false);
  const [uploadCategory, setUploadCategory] = useState<DocumentCategory>('OUTRO');
  const [uploadNotes, setUploadNotes] = useState('');
  const [pickedFile, setPickedFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['documents', farmId],
    queryFn: () => apiFetch<FarmDocument[]>(`/fazendas/${farmId}/documentos`),
    enabled: !!farmId,
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!pickedFile) throw new Error('Selecione um arquivo');
      const formData = new FormData();
      formData.append('file', {
        uri: pickedFile.uri,
        name: pickedFile.name,
        type: pickedFile.mimeType ?? 'application/octet-stream',
      } as unknown as Blob);
      formData.append('category', uploadCategory);
      if (uploadNotes) formData.append('notes', uploadNotes);
      return apiUpload(`/fazendas/${farmId}/documentos`, formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', farmId] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      resetUploadForm();
      setShowUpload(false);
    },
    onError: (err: any) => Alert.alert('Erro ao enviar', err.message ?? 'Tente novamente'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/fazendas/${farmId}/documentos/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', farmId] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (err: any) => Alert.alert('Erro ao excluir', err.message ?? 'Tente novamente'),
  });

  const resetUploadForm = () => {
    setUploadCategory('OUTRO');
    setUploadNotes('');
    setPickedFile(null);
  };

  const handlePickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (asset) setPickedFile(asset);
  };

  const handleUpload = () => {
    if (!pickedFile) {
      Alert.alert('Selecione um arquivo', 'Escolha um arquivo antes de enviar.');
      return;
    }
    uploadMutation.mutate();
  };

  const handleDownload = async (doc: FarmDocument) => {
    try {
      setDownloadingId(doc.id);
      await apiDownload(`/fazendas/${farmId}/documentos/${doc.id}/download`, doc.fileName);
    } catch (err: any) {
      Alert.alert('Erro ao baixar', err.message ?? 'Tente novamente');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = (doc: FarmDocument) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Excluir documento?', `Deseja excluir "${doc.fileName}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => deleteMutation.mutate(doc.id) },
    ]);
  };

  const filtered = useMemo(() => {
    if (!data) return [];
    return data
      .filter((doc: FarmDocument) => categoryFilter === 'TODOS' || doc.category === categoryFilter)
      .filter((doc: FarmDocument) => isWithinPeriod(doc.createdAt, periodFilter))
      .sort((a: FarmDocument, b: FarmDocument) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [data, categoryFilter, periodFilter]);

  if (isLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.filterScroll}
        contentContainerStyle={s.filterRow}
      >
        <TouchableOpacity
          style={[s.chip, categoryFilter === 'TODOS' && s.chipActive]}
          onPress={() => setCategoryFilter('TODOS')}
        >
          <Text style={[s.chipText, categoryFilter === 'TODOS' && s.chipTextActive]}>TODOS</Text>
        </TouchableOpacity>
        {CATEGORIES.map((c: DocumentCategory) => (
          <TouchableOpacity
            key={c}
            style={[s.chip, categoryFilter === c && s.chipActive]}
            onPress={() => setCategoryFilter(c)}
          >
            <Text style={[s.chipText, categoryFilter === c && s.chipTextActive]}>{CATEGORY_LABELS[c]}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.filterScroll}
        contentContainerStyle={s.filterRow}
      >
        {(Object.keys(PERIOD_LABELS) as PeriodFilter[]).map((p: PeriodFilter) => (
          <TouchableOpacity
            key={p}
            style={[s.periodChip, periodFilter === p && s.periodChipActive]}
            onPress={() => setPeriodFilter(p)}
          >
            <Text style={[s.periodChipText, periodFilter === p && s.periodChipTextActive]}>{PERIOD_LABELS[p]}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={s.resultsCount}>
        {filtered.length} {filtered.length === 1 ? 'documento' : 'documentos'}
      </Text>

      {!filtered.length ? (
        <EmptyState
          icon="📄"
          title="Nenhum documento"
          subtitle={data?.length ? 'Ajuste os filtros ou toque no + para enviar' : 'Toque no + para enviar um documento'}
        />
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={filtered}
          keyExtractor={(item: FarmDocument) => item.id}
          contentContainerStyle={{ padding: 16, paddingTop: 4 }}
          onRefresh={refetch}
          refreshing={isRefetching}
          renderItem={({ item, index }: { item: FarmDocument; index: number }) => {
            const colors = CATEGORY_COLORS[item.category];
            const isDownloading = downloadingId === item.id;
            return (
              <Animated.View entering={FadeInDown.delay(Math.min(index, 10) * 60).springify().damping(16)}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  disabled={isDownloading}
                  onPress={() => handleDownload(item)}
                  onLongPress={() => handleDelete(item)}
                >
                  <View style={s.card}>
                    <View style={[s.avatar, { backgroundColor: colors.bg }]}>
                      {isDownloading ? (
                        <ActivityIndicator size="small" color={colors.fg} />
                      ) : (
                        <Ionicons name={CATEGORY_ICONS[item.category]} size={20} color={colors.fg} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={s.row}>
                        <Text style={s.fileName} numberOfLines={1}>
                          {item.fileName}
                        </Text>
                      </View>
                      <View style={s.metaRow}>
                        <Text style={[s.badge, { backgroundColor: colors.bg, color: colors.fg }]}>
                          {CATEGORY_LABELS[item.category]}
                        </Text>
                        <Text style={s.meta}>{formatFileSize(item.fileSize)}</Text>
                        <Text style={s.meta}>{formatDate(item.createdAt)}</Text>
                      </View>
                      {item.notes ? (
                        <Text style={s.notes} numberOfLines={2}>
                          {item.notes}
                        </Text>
                      ) : null}
                    </View>
                    <Ionicons name="download-outline" size={18} color={theme.colors.textFaint} />
                  </View>
                </TouchableOpacity>
              </Animated.View>
            );
          }}
        />
      )}

      <Fab onPress={() => { resetUploadForm(); setShowUpload(true); }} />

      <Modal visible={showUpload} animationType="slide" transparent>
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.modal}>
            <ScrollView>
              <View style={s.dragHandle} />
              <Text style={s.modalTitle}>Novo documento</Text>

              <Text style={s.label}>Categoria</Text>
              <View style={s.chipRowWrap}>
                {CATEGORIES.map((c: DocumentCategory) => (
                  <TouchableOpacity
                    key={c}
                    style={[s.chip, uploadCategory === c && s.chipActive]}
                    onPress={() => setUploadCategory(c)}
                  >
                    <Text style={[s.chipText, uploadCategory === c && s.chipTextActive]}>{CATEGORY_LABELS[c]}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.label}>Observações</Text>
              <TextInput
                style={[s.input, { minHeight: 80, textAlignVertical: 'top' }]}
                value={uploadNotes}
                onChangeText={setUploadNotes}
                placeholder="Opcional"
                multiline
              />

              <Text style={s.label}>Arquivo</Text>
              <TouchableOpacity style={s.pickButton} onPress={handlePickFile}>
                <Ionicons name="attach" size={18} color={theme.colors.primary} />
                <Text style={s.pickButtonText} numberOfLines={1}>
                  {pickedFile ? pickedFile.name : 'Escolher arquivo'}
                </Text>
              </TouchableOpacity>
              {pickedFile ? (
                <Text style={s.pickedInfo}>{formatFileSize(pickedFile.size ?? 0)}</Text>
              ) : null}

              <View style={s.modalActions}>
                <TouchableOpacity
                  style={s.cancelBtn}
                  onPress={() => { setShowUpload(false); resetUploadForm(); }}
                >
                  <Text style={s.cancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.saveBtn, uploadMutation.isPending && { opacity: 0.7 }]}
                  onPress={handleUpload}
                  disabled={uploadMutation.isPending}
                >
                  {uploadMutation.isPending ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={s.saveText}>Enviar</Text>
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
  filterScroll: { flexGrow: 0, marginTop: 12 },
  filterRow: { paddingHorizontal: 16, gap: 8, flexDirection: 'row' },
  resultsCount: {
    fontSize: 13,
    color: theme.colors.textMuted,
    paddingHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipText: { fontSize: 13, color: theme.colors.textMuted, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  chipRowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  periodChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  periodChipActive: { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primaryLight },
  periodChipText: { fontSize: 12, color: theme.colors.textMuted, fontWeight: '600' },
  periodChipTextActive: { color: '#fff' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: theme.radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  fileName: { fontSize: 15, fontWeight: '700', color: theme.colors.text, flex: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, fontSize: 11, fontWeight: '700' },
  meta: { fontSize: 12, color: theme.colors.textMuted },
  notes: { fontSize: 12, color: theme.colors.textFaint, marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(16,24,40,0.55)', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    padding: 24,
    maxHeight: '85%',
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    alignSelf: 'center',
    marginBottom: 14,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3, color: theme.colors.primary, marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: theme.colors.textMuted, marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    padding: 12,
    fontSize: 15,
    backgroundColor: theme.colors.bg,
    color: theme.colors.text,
  },
  pickButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    padding: 12,
    backgroundColor: theme.colors.bg,
  },
  pickButtonText: { fontSize: 14, color: theme.colors.primary, fontWeight: '600', flex: 1 },
  pickedInfo: { fontSize: 12, color: theme.colors.textMuted, marginTop: 6 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20, marginBottom: 20 },
  cancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.bg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cancelText: { fontSize: 15, fontWeight: '600', color: theme.colors.textMuted },
  saveBtn: {
    flex: 1,
    padding: 14,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
  },
  saveText: { fontSize: 15, fontWeight: '600', color: '#fff' },
});
