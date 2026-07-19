import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Alert, LayoutAnimation, Platform, UIManager } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { theme } from '../../../../../src/lib/theme';
import { DateInput } from '../../../../../src/components/DateInput';
import { apiDownload, apiFetch } from '../../../../../src/lib/api';
import { useAuth } from '../../../../../src/lib/auth-context';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Format = 'pdf' | 'csv' | 'xlsx';

interface ReportDef {
  key: string;
  title: string;
  desc: string;
  icon: keyof typeof Ionicons.glyphMap;
  formats: Format[];
}

const REPORTS: ReportDef[] = [
  { key: 'rebanho', title: 'Rebanho', desc: 'Listagem completa dos animais', icon: 'paw', formats: ['pdf', 'csv', 'xlsx'] },
  { key: 'financeiro', title: 'Financeiro', desc: 'Lançamentos e fluxo de caixa', icon: 'wallet', formats: ['pdf', 'csv', 'xlsx'] },
  { key: 'pastagens', title: 'Pastagens', desc: 'Ocupação e capacidade dos pastos', icon: 'leaf', formats: ['pdf', 'csv', 'xlsx'] },
  { key: 'reproducao', title: 'Reprodução', desc: 'Eventos reprodutivos do rebanho', icon: 'heart', formats: ['pdf', 'csv', 'xlsx'] },
  { key: 'negocio', title: 'Negócio', desc: 'Relatório de um negócio específico', icon: 'swap-horizontal', formats: ['pdf'] },
];

const MONTHS = [
  { value: 1, label: 'Jan' },
  { value: 2, label: 'Fev' },
  { value: 3, label: 'Mar' },
  { value: 4, label: 'Abr' },
  { value: 5, label: 'Mai' },
  { value: 6, label: 'Jun' },
  { value: 7, label: 'Jul' },
  { value: 8, label: 'Ago' },
  { value: 9, label: 'Set' },
  { value: 10, label: 'Out' },
  { value: 11, label: 'Nov' },
  { value: 12, label: 'Dez' },
];

const PERFORMANCE_OPTIONS = [
  { value: 'CABECEIRA', label: 'Cabeceira' },
  { value: 'MEIO', label: 'Meio' },
  { value: 'FUNDO', label: 'Fundo' },
];

const CATEGORY_OPTIONS = [
  { value: 'BEZERRO', label: 'Bezerro' },
  { value: 'BEZERRA', label: 'Bezerra' },
  { value: 'NOVILHO', label: 'Novilho' },
  { value: 'NOVILHA', label: 'Novilha' },
  { value: 'GARROTE', label: 'Garrote' },
  { value: 'BOI', label: 'Boi' },
  { value: 'VACA', label: 'Vaca' },
  { value: 'TOURO', label: 'Touro' },
  { value: 'MATRIZ', label: 'Matriz' },
];

const SEX_OPTIONS = [
  { value: 'MALE', label: 'Macho' },
  { value: 'FEMALE', label: 'Fêmea' },
];

const REPRO_OPTIONS = [
  { value: 'COM_EVENTO', label: 'Com evento' },
  { value: 'SEM_EVENTO', label: 'Sem evento' },
  { value: 'PRENHE', label: 'Prenhe' },
];

const FORMAT_LABELS: Record<Format, string> = { pdf: 'PDF', csv: 'CSV', xlsx: 'XLSX' };

interface RebanhoParams {
  birthMonth: number | null;
  performance: string | null;
  sortByGain: boolean;
  category: string | null;
  sex: string | null;
  pastureId: string | null;
  vaccination: string;
  reproStatus: string | null;
  startDate: string;
  endDate: string;
}

interface PastureOption {
  id: string;
  name: string;
}

interface FinanceiroParams {
  startDate: string;
  endDate: string;
}

interface NegocioParams {
  dealId: string;
}

export default function ReportsScreen() {
  const { farmId } = useLocalSearchParams<{ farmId: string }>();
  const { accessToken } = useAuth();

  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [formatByReport, setFormatByReport] = useState<Record<string, Format>>({});
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);

  const [rebanhoParams, setRebanhoParams] = useState<RebanhoParams>({
    birthMonth: null,
    performance: null,
    sortByGain: false,
    category: null,
    sex: null,
    pastureId: null,
    vaccination: '',
    reproStatus: null,
    startDate: '',
    endDate: '',
  });
  const [pastures, setPastures] = useState<PastureOption[]>([]);

  const loadPastures = useCallback(async () => {
    try {
      const data = await apiFetch<PastureOption[]>(`/fazendas/${farmId}/pastagens`);
      setPastures(data);
    } catch { /* ignore */ }
  }, [farmId]);

  useEffect(() => { void loadPastures(); }, [loadPastures]);
  const [financeiroParams, setFinanceiroParams] = useState<FinanceiroParams>({
    startDate: '',
    endDate: '',
  });
  const [negocioParams, setNegocioParams] = useState<NegocioParams>({ dealId: '' });

  const toggleExpanded = (key: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Haptics.selectionAsync().catch(() => {});
    setExpandedKey((prev: string | null) => (prev === key ? null : key));
  };

  const selectFormat = (reportKey: string, format: Format) => {
    Haptics.selectionAsync().catch(() => {});
    setFormatByReport((prev: Record<string, Format>) => ({ ...prev, [reportKey]: format }));
  };

  const getFormat = (report: ReportDef): Format => {
    return formatByReport[report.key] ?? report.formats[0];
  };

  const buildUrlAndFilename = (report: ReportDef): { url: string; filename: string } | null => {
    const format = getFormat(report);
    const timestamp = new Date().toISOString().slice(0, 10);

    if (report.key === 'rebanho') {
      const params = new URLSearchParams();
      params.set('format', format);
      if (rebanhoParams.birthMonth) params.set('birthMonth', String(rebanhoParams.birthMonth));
      if (rebanhoParams.performance) params.set('performance', rebanhoParams.performance);
      if (rebanhoParams.sortByGain) params.set('sortByGain', 'desc');
      if (rebanhoParams.category) params.set('category', rebanhoParams.category);
      if (rebanhoParams.sex) params.set('sex', rebanhoParams.sex);
      if (rebanhoParams.pastureId) params.set('pastureId', rebanhoParams.pastureId);
      if (rebanhoParams.vaccination) params.set('vaccination', rebanhoParams.vaccination);
      if (rebanhoParams.reproStatus) params.set('reproStatus', rebanhoParams.reproStatus);
      if (rebanhoParams.startDate) params.set('startDate', rebanhoParams.startDate);
      if (rebanhoParams.endDate) params.set('endDate', rebanhoParams.endDate);
      return {
        url: `/fazendas/${farmId}/relatorios/rebanho?${params.toString()}`,
        filename: `rebanho-${timestamp}.${format}`,
      };
    }

    if (report.key === 'financeiro') {
      if (!financeiroParams.startDate || !financeiroParams.endDate) {
        Alert.alert('Atenção', 'Informe a data inicial e a data final');
        return null;
      }
      const params = new URLSearchParams();
      params.set('format', format);
      params.set('startDate', financeiroParams.startDate);
      params.set('endDate', financeiroParams.endDate);
      return {
        url: `/fazendas/${farmId}/relatorios/financeiro?${params.toString()}`,
        filename: `financeiro-${timestamp}.${format}`,
      };
    }

    if (report.key === 'pastagens') {
      return {
        url: `/fazendas/${farmId}/relatorios/pastagens?format=${format}`,
        filename: `pastagens-${timestamp}.${format}`,
      };
    }

    if (report.key === 'reproducao') {
      return {
        url: `/fazendas/${farmId}/relatorios/reproducao?format=${format}`,
        filename: `reproducao-${timestamp}.${format}`,
      };
    }

    if (report.key === 'negocio') {
      if (!negocioParams.dealId) {
        Alert.alert('Atenção', 'Informe o ID do negócio');
        return null;
      }
      const params = new URLSearchParams();
      params.set('format', format);
      params.set('dealId', negocioParams.dealId);
      return {
        url: `/fazendas/${farmId}/relatorios/negocio?${params.toString()}`,
        filename: `negocio-${timestamp}.${format}`,
      };
    }

    return null;
  };

  const handleGenerate = async (report: ReportDef) => {
    const built = buildUrlAndFilename(report);
    if (!built) return;

    setDownloadingKey(report.key);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      await apiDownload(built.url, built.filename, accessToken);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert('Erro ao gerar relatório', err?.message ?? 'Tente novamente mais tarde');
    } finally {
      setDownloadingKey(null);
    }
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <Text style={s.headerTitle}>Relatórios</Text>
      <Text style={s.headerSubtitle}>Gere relatórios em PDF, CSV ou XLSX para exportar dados da fazenda</Text>

      {REPORTS.map((report: ReportDef, index: number) => {
        const isExpanded = expandedKey === report.key;
        const isDownloading = downloadingKey === report.key;
        const currentFormat = getFormat(report);

        return (
          <Animated.View key={report.key} entering={FadeInDown.delay(index * 60)} style={s.card}>
            <TouchableOpacity style={s.cardHeader} onPress={() => toggleExpanded(report.key)} activeOpacity={0.7}>
              <View style={s.iconWrap}>
                <Ionicons name={report.icon} size={22} color={theme.colors.primary} />
              </View>
              <View style={s.cardHeaderText}>
                <Text style={s.cardTitle}>{report.title}</Text>
                <Text style={s.cardDesc}>{report.desc}</Text>
              </View>
              <Ionicons
                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={theme.colors.textMuted}
              />
            </TouchableOpacity>

            {isExpanded && (
              <View style={s.cardBody}>
                <Text style={s.sectionLabel}>Formato</Text>
                <View style={s.chipRow}>
                  {report.formats.map((format: Format) => (
                    <TouchableOpacity
                      key={format}
                      style={[s.chip, currentFormat === format && s.chipActive]}
                      onPress={() => selectFormat(report.key, format)}
                    >
                      <Text style={[s.chipText, currentFormat === format && s.chipTextActive]}>
                        {FORMAT_LABELS[format]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {report.key === 'rebanho' && (
                  <>
                    <Text style={s.sectionLabel}>Categoria</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={s.chipRow}>
                        <TouchableOpacity
                          style={[s.chip, rebanhoParams.category === null && s.chipActive]}
                          onPress={() => setRebanhoParams((prev: RebanhoParams) => ({ ...prev, category: null }))}
                        >
                          <Text style={[s.chipText, rebanhoParams.category === null && s.chipTextActive]}>Todas</Text>
                        </TouchableOpacity>
                        {CATEGORY_OPTIONS.map((opt: { value: string; label: string }) => (
                          <TouchableOpacity
                            key={opt.value}
                            style={[s.chip, rebanhoParams.category === opt.value && s.chipActive]}
                            onPress={() => setRebanhoParams((prev: RebanhoParams) => ({ ...prev, category: opt.value }))}
                          >
                            <Text style={[s.chipText, rebanhoParams.category === opt.value && s.chipTextActive]}>{opt.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>

                    <Text style={s.sectionLabel}>Sexo</Text>
                    <View style={s.chipRow}>
                      <TouchableOpacity
                        style={[s.chip, rebanhoParams.sex === null && s.chipActive]}
                        onPress={() => setRebanhoParams((prev: RebanhoParams) => ({ ...prev, sex: null }))}
                      >
                        <Text style={[s.chipText, rebanhoParams.sex === null && s.chipTextActive]}>Todos</Text>
                      </TouchableOpacity>
                      {SEX_OPTIONS.map((opt: { value: string; label: string }) => (
                        <TouchableOpacity
                          key={opt.value}
                          style={[s.chip, rebanhoParams.sex === opt.value && s.chipActive]}
                          onPress={() => setRebanhoParams((prev: RebanhoParams) => ({ ...prev, sex: opt.value }))}
                        >
                          <Text style={[s.chipText, rebanhoParams.sex === opt.value && s.chipTextActive]}>{opt.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text style={s.sectionLabel}>Pasto</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={s.chipRow}>
                        <TouchableOpacity
                          style={[s.chip, rebanhoParams.pastureId === null && s.chipActive]}
                          onPress={() => setRebanhoParams((prev: RebanhoParams) => ({ ...prev, pastureId: null }))}
                        >
                          <Text style={[s.chipText, rebanhoParams.pastureId === null && s.chipTextActive]}>Todos</Text>
                        </TouchableOpacity>
                        {pastures.map((p: PastureOption) => (
                          <TouchableOpacity
                            key={p.id}
                            style={[s.chip, rebanhoParams.pastureId === p.id && s.chipActive]}
                            onPress={() => setRebanhoParams((prev: RebanhoParams) => ({ ...prev, pastureId: p.id }))}
                          >
                            <Text style={[s.chipText, rebanhoParams.pastureId === p.id && s.chipTextActive]}>{p.name}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>

                    <Text style={s.sectionLabel}>Vacinação (filtrar por nome)</Text>
                    <TextInput
                      style={s.input}
                      placeholder="Ex: Raiva, Aftosa..."
                      placeholderTextColor={theme.colors.textFaint}
                      value={rebanhoParams.vaccination}
                      onChangeText={(text: string) => setRebanhoParams((prev: RebanhoParams) => ({ ...prev, vaccination: text }))}
                    />

                    <Text style={s.sectionLabel}>Reprodução</Text>
                    <View style={s.chipRow}>
                      <TouchableOpacity
                        style={[s.chip, rebanhoParams.reproStatus === null && s.chipActive]}
                        onPress={() => setRebanhoParams((prev: RebanhoParams) => ({ ...prev, reproStatus: null }))}
                      >
                        <Text style={[s.chipText, rebanhoParams.reproStatus === null && s.chipTextActive]}>Todos</Text>
                      </TouchableOpacity>
                      {REPRO_OPTIONS.map((opt: { value: string; label: string }) => (
                        <TouchableOpacity
                          key={opt.value}
                          style={[s.chip, rebanhoParams.reproStatus === opt.value && s.chipActive]}
                          onPress={() => setRebanhoParams((prev: RebanhoParams) => ({ ...prev, reproStatus: opt.value }))}
                        >
                          <Text style={[s.chipText, rebanhoParams.reproStatus === opt.value && s.chipTextActive]}>{opt.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text style={s.sectionLabel}>Período</Text>
                    <DateInput label="De" value={rebanhoParams.startDate} onChange={(v: string) => setRebanhoParams((prev: RebanhoParams) => ({ ...prev, startDate: v }))} />
                    <DateInput label="Até" value={rebanhoParams.endDate} onChange={(v: string) => setRebanhoParams((prev: RebanhoParams) => ({ ...prev, endDate: v }))} />

                    <Text style={s.sectionLabel}>Mês de nascimento (opcional)</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.monthScroll}>
                      <View style={s.chipRow}>
                        <TouchableOpacity
                          style={[s.chip, rebanhoParams.birthMonth === null && s.chipActive]}
                          onPress={() =>
                            setRebanhoParams((prev: RebanhoParams) => ({ ...prev, birthMonth: null }))
                          }
                        >
                          <Text
                            style={[
                              s.chipText,
                              rebanhoParams.birthMonth === null && s.chipTextActive,
                            ]}
                          >
                            Todos
                          </Text>
                        </TouchableOpacity>
                        {MONTHS.map((month: { value: number; label: string }) => (
                          <TouchableOpacity
                            key={month.value}
                            style={[s.chip, rebanhoParams.birthMonth === month.value && s.chipActive]}
                            onPress={() =>
                              setRebanhoParams((prev: RebanhoParams) => ({
                                ...prev,
                                birthMonth: month.value,
                              }))
                            }
                          >
                            <Text
                              style={[
                                s.chipText,
                                rebanhoParams.birthMonth === month.value && s.chipTextActive,
                              ]}
                            >
                              {month.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>

                    <Text style={s.sectionLabel}>Faixa de desempenho (opcional)</Text>
                    <View style={s.chipRow}>
                      <TouchableOpacity
                        style={[s.chip, rebanhoParams.performance === null && s.chipActive]}
                        onPress={() =>
                          setRebanhoParams((prev: RebanhoParams) => ({ ...prev, performance: null }))
                        }
                      >
                        <Text
                          style={[s.chipText, rebanhoParams.performance === null && s.chipTextActive]}
                        >
                          Todas
                        </Text>
                      </TouchableOpacity>
                      {PERFORMANCE_OPTIONS.map((opt: { value: string; label: string }) => (
                        <TouchableOpacity
                          key={opt.value}
                          style={[s.chip, rebanhoParams.performance === opt.value && s.chipActive]}
                          onPress={() =>
                            setRebanhoParams((prev: RebanhoParams) => ({
                              ...prev,
                              performance: opt.value,
                            }))
                          }
                        >
                          <Text
                            style={[
                              s.chipText,
                              rebanhoParams.performance === opt.value && s.chipTextActive,
                            ]}
                          >
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <TouchableOpacity
                      style={s.toggleRow}
                      onPress={() =>
                        setRebanhoParams((prev: RebanhoParams) => ({
                          ...prev,
                          sortByGain: !prev.sortByGain,
                        }))
                      }
                      activeOpacity={0.7}
                    >
                      <View style={[s.checkbox, rebanhoParams.sortByGain && s.checkboxActive]}>
                        {rebanhoParams.sortByGain && (
                          <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                        )}
                      </View>
                      <Text style={s.toggleLabel}>Ordenar por ganho de peso</Text>
                    </TouchableOpacity>
                  </>
                )}

                {report.key === 'financeiro' && (
                  <>
                    <DateInput label="Data inicial" value={financeiroParams.startDate} onChange={(text: string) => setFinanceiroParams((prev: FinanceiroParams) => ({ ...prev, startDate: text }))} />
                    <DateInput label="Data final" value={financeiroParams.endDate} onChange={(text: string) => setFinanceiroParams((prev: FinanceiroParams) => ({ ...prev, endDate: text }))} />
                  </>
                )}

                {report.key === 'negocio' && (
                  <>
                    <Text style={s.sectionLabel}>ID do negócio</Text>
                    <TextInput
                      style={s.input}
                      placeholder="Ex: 3f2a1b..."
                      placeholderTextColor={theme.colors.textFaint}
                      value={negocioParams.dealId}
                      onChangeText={(text: string) =>
                        setNegocioParams((prev: NegocioParams) => ({ ...prev, dealId: text }))
                      }
                    />
                  </>
                )}

                <TouchableOpacity
                  style={[s.generateButton, isDownloading && s.generateButtonDisabled]}
                  onPress={() => handleGenerate(report)}
                  disabled={isDownloading}
                  activeOpacity={0.85}
                >
                  {isDownloading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="download-outline" size={18} color="#FFFFFF" />
                      <Text style={s.generateButtonText}>Gerar relatório</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: theme.colors.textMuted,
    marginBottom: 20,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    marginBottom: 14,
    overflow: 'hidden',
    ...theme.shadow.card,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  cardDesc: {
    fontSize: 13,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  cardBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 14,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textMuted,
    marginBottom: 8,
    marginTop: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  monthScroll: {
    marginBottom: 0,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.bg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  chipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  input: {
    backgroundColor: theme.colors.bg,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: theme.colors.text,
    marginBottom: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkboxActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  toggleLabel: {
    fontSize: 14,
    color: theme.colors.text,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    paddingVertical: 13,
    marginTop: 16,
    gap: 8,
  },
  generateButtonDisabled: {
    opacity: 0.6,
  },
  generateButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
