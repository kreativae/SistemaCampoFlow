import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Alert, Modal, KeyboardAvoidingView, Platform, RefreshControl, Dimensions } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Beef, Scale, Syringe, Heart, Trash2, Pencil, MapPin, GitBranch, Clock } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Svg, { Path, Circle, Line, Text as SvgText } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../../../../src/lib/api';
import { DateInput } from '../../../../../src/components/DateInput';
import { useAnimal } from '../../../../../src/hooks/use-animals';
import { theme } from '../../../../../src/lib/theme';
import type { Animal, Pasture, GainSummary, AnimalPerformance, AnimalEvent } from '../../../../../src/lib/types';
import { ANIMAL_PERFORMANCE_LABEL, calcAnimalAge, ANIMAL_EVENT_TYPE_LABEL } from '../../../../../src/lib/types';

interface Weighing { id: string; weighedAt: string; weightKg: number }
interface Vaccination { id: string; vaccineName: string; scheduledDate: string; administeredAt?: string; batchNumber?: string }
interface ReproEvent { id: string; type: string; eventDate: string; result?: string; notes?: string }

const SCREEN_WIDTH = Dimensions.get('window').width;

const REPRO_TYPES = ['IATF', 'MONTA_NATURAL', 'INSEMINACAO', 'DIAGNOSTICO_PRENHEZ', 'PARTO', 'ABORTO'] as const;
const REPRO_LABELS: Record<string, string> = { IATF: 'IATF', MONTA_NATURAL: 'Monta natural', INSEMINACAO: 'Inseminação', DIAGNOSTICO_PRENHEZ: 'Diagnóstico', PARTO: 'Parto', ABORTO: 'Aborto' };
const RESULT_OPTIONS = ['PRENHE', 'VAZIA'] as const;
const SEX_LABELS: Record<string, string> = { MALE: 'Macho', FEMALE: 'Fêmea' };

const PERF_COLORS: Record<string, { bg: string; text: string }> = {
  CABECEIRA: { bg: '#DCFCE7', text: '#15803D' },
  MEIO: { bg: '#FEF9C3', text: '#854D0E' },
  FUNDO: { bg: '#FEE2E2', text: '#991B1B' },
};

const PERFORMANCE_OPTIONS: (AnimalPerformance | null)[] = ['CABECEIRA', 'MEIO', 'FUNDO', null];

export default function AnimalDetailScreen() {
  const { farmId, animalId } = useLocalSearchParams<{ farmId: string; animalId: string }>();
  const qc = useQueryClient();
  const { data: animal, isLoading, refetch } = useAnimal(farmId, animalId);

  const { data: weighings, refetch: refetchW } = useQuery({
    queryKey: ['weighings', farmId, animalId],
    queryFn: () => apiFetch<Weighing[]>(`/fazendas/${farmId}/animais/${animalId}/pesagens`),
    enabled: !!farmId && !!animalId,
  });
  const { data: vaccinations, refetch: refetchV } = useQuery({
    queryKey: ['vaccinations', farmId, animalId],
    queryFn: () => apiFetch<Vaccination[]>(`/fazendas/${farmId}/animais/${animalId}/vacinacoes`),
    enabled: !!farmId && !!animalId,
  });
  const { data: reproEvents, refetch: refetchR } = useQuery({
    queryKey: ['reproEvents', farmId, animalId],
    queryFn: () => apiFetch<ReproEvent[]>(`/fazendas/${farmId}/animais/${animalId}/eventos-reprodutivos`),
    enabled: !!farmId && !!animalId,
  });
  const { data: gainSummary } = useQuery({
    queryKey: ['gainSummary', farmId, animalId],
    queryFn: () => apiFetch<GainSummary>(`/fazendas/${farmId}/animais/${animalId}/pesagens/resumo-ganho`),
    enabled: !!farmId && !!animalId,
  });
  const { data: pastures } = useQuery({
    queryKey: ['pastures', farmId],
    queryFn: () => apiFetch<Pasture[]>(`/fazendas/${farmId}/pastagens`),
    enabled: !!farmId,
  });
  const { data: history, refetch: refetchH } = useQuery({
    queryKey: ['animalHistory', farmId, animalId],
    queryFn: () => apiFetch<AnimalEvent[]>(`/fazendas/${farmId}/animais/${animalId}/historico`),
    enabled: !!farmId && !!animalId,
  });

  // Weighing CRUD
  const [showWeighingForm, setShowWeighingForm] = useState(false);
  const [editingWeighing, setEditingWeighing] = useState<Weighing | null>(null);
  const [wForm, setWForm] = useState({ weightKg: '', weighedAt: '' });

  const createWeighing = useMutation({
    mutationFn: (body: any) => apiFetch(`/fazendas/${farmId}/animais/${animalId}/pesagens`, { method: 'POST', body }),
    onSuccess: () => { refetchW(); setShowWeighingForm(false); setWForm({ weightKg: '', weighedAt: '' }); },
    onError: (e: any) => Alert.alert('Erro', e.message),
  });
  const updateWeighing = useMutation({
    mutationFn: ({ id, ...body }: any) => apiFetch(`/fazendas/${farmId}/animais/${animalId}/pesagens/${id}`, { method: 'PATCH', body }),
    onSuccess: () => { refetchW(); setEditingWeighing(null); setShowWeighingForm(false); setWForm({ weightKg: '', weighedAt: '' }); },
    onError: (e: any) => Alert.alert('Erro', e.message),
  });
  const deleteWeighing = useMutation({
    mutationFn: (id: string) => apiFetch(`/fazendas/${farmId}/animais/${animalId}/pesagens/${id}`, { method: 'DELETE' }),
    onSuccess: () => refetchW(),
    onError: (e: any) => Alert.alert('Erro', e.message),
  });

  // Vaccination CRUD
  const [showVaccForm, setShowVaccForm] = useState(false);
  const [vForm, setVForm] = useState({ vaccineName: '', scheduledDate: '', batchNumber: '' });

  const createVacc = useMutation({
    mutationFn: (body: any) => apiFetch(`/fazendas/${farmId}/animais/${animalId}/vacinacoes`, { method: 'POST', body }),
    onSuccess: () => { refetchV(); setShowVaccForm(false); setVForm({ vaccineName: '', scheduledDate: '', batchNumber: '' }); },
    onError: (e: any) => Alert.alert('Erro', e.message),
  });
  const markAdministered = useMutation({
    mutationFn: (id: string) => apiFetch(`/fazendas/${farmId}/animais/${animalId}/vacinacoes/${id}/aplicar`, { method: 'PATCH' }),
    onSuccess: () => refetchV(),
    onError: (e: any) => Alert.alert('Erro', e.message),
  });

  // Reproduction CRUD
  const [showReproForm, setShowReproForm] = useState(false);
  const [editingRepro, setEditingRepro] = useState<ReproEvent | null>(null);
  const [rForm, setRForm] = useState({ type: 'IATF' as string, eventDate: '', result: '' as string, notes: '' });

  const createRepro = useMutation({
    mutationFn: (body: any) => apiFetch(`/fazendas/${farmId}/animais/${animalId}/eventos-reprodutivos`, { method: 'POST', body }),
    onSuccess: () => { refetchR(); setShowReproForm(false); setEditingRepro(null); setRForm({ type: 'IATF', eventDate: '', result: '', notes: '' }); },
    onError: (e: any) => Alert.alert('Erro', e.message),
  });
  const updateRepro = useMutation({
    mutationFn: ({ id, ...body }: any) => apiFetch(`/fazendas/${farmId}/animais/${animalId}/eventos-reprodutivos/${id}`, { method: 'PATCH', body }),
    onSuccess: () => { refetchR(); setShowReproForm(false); setEditingRepro(null); setRForm({ type: 'IATF', eventDate: '', result: '', notes: '' }); },
    onError: (e: any) => Alert.alert('Erro', e.message),
  });
  const deleteRepro = useMutation({
    mutationFn: (id: string) => apiFetch(`/fazendas/${farmId}/animais/${animalId}/eventos-reprodutivos/${id}`, { method: 'DELETE' }),
    onSuccess: () => refetchR(),
    onError: (e: any) => Alert.alert('Erro', e.message),
  });

  const updateBirthDate = useMutation({
    mutationFn: (birthDate: string) => apiFetch(`/fazendas/${farmId}/animais/${animalId}`, { method: 'PATCH', body: { birthDate } }),
    onSuccess: () => { refetch(); try { Haptics.selectionAsync(); } catch {} },
    onError: (e: Error) => Alert.alert('Erro', e.message),
  });

  const updateEntryDate = useMutation({
    mutationFn: (entryDate: string) => apiFetch(`/fazendas/${farmId}/animais/${animalId}`, { method: 'PATCH', body: { entryDate } }),
    onSuccess: () => { refetch(); try { Haptics.selectionAsync(); } catch {} },
    onError: (e: Error) => Alert.alert('Erro', e.message),
  });

  const updatePerformance = useMutation({
    mutationFn: (performance: AnimalPerformance | null) => apiFetch(`/fazendas/${farmId}/animais/${animalId}`, { method: 'PATCH', body: { performance } }),
    onSuccess: () => { refetch(); Haptics.selectionAsync(); },
    onError: (e: any) => Alert.alert('Erro', e.message),
  });

  // Move pasture
  const movePasture = useMutation({
    mutationFn: (pastureId: string | null) => apiFetch(`/fazendas/${farmId}/animais/mover-pasto`, { method: 'POST', body: { animalIds: [animalId], pastureId } }),
    onSuccess: () => { refetch(); Haptics.selectionAsync(); },
    onError: (e: any) => Alert.alert('Erro', e.message),
  });

  // Pasture picker
  const [showPasturePicker, setShowPasturePicker] = useState(false);

  if (isLoading || !animal) return <View style={s.center}><ActivityIndicator size="large" color={theme.colors.primary} /></View>;

  const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';
  const today = () => new Date().toISOString().slice(0, 10);
  const age = calcAnimalAge(animal);
  const currentPasture = pastures?.find((p: Pasture) => p.id === animal.pastureId);

  const refetchAll = () => { refetch(); refetchW(); refetchV(); refetchR(); refetchH(); };

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={false} onRefresh={refetchAll} tintColor={theme.colors.primary} />}>
      {/* Header */}
      <Animated.View entering={FadeInDown.delay(50).springify().damping(16)} style={s.headerCard}>
        <View style={s.headerIcon}><Beef size={28} color={theme.colors.primary} strokeWidth={1.8} /></View>
        <Text style={s.animalName}>{animal.name || animal.earTag || 'Animal'}</Text>
        <View style={s.tagsRow}>
          {animal.earTag && <View style={s.tag}><Text style={s.tagText}>#{animal.earTag}</Text></View>}
          {animal.sex && <View style={s.tag}><Text style={s.tagText}>{SEX_LABELS[animal.sex] ?? animal.sex}</Text></View>}
          {animal.breed && <View style={s.tag}><Text style={s.tagText}>{animal.breed}</Text></View>}
          {animal.category && <View style={s.tag}><Text style={s.tagText}>{animal.category}</Text></View>}
          {animal.performance && (
            <View style={[s.tag, { backgroundColor: PERF_COLORS[animal.performance]?.bg }]}>
              <Text style={[s.tagText, { color: PERF_COLORS[animal.performance]?.text }]}>
                {ANIMAL_PERFORMANCE_LABEL[animal.performance as AnimalPerformance]}
              </Text>
            </View>
          )}
        </View>
      </Animated.View>

      {/* Gain Summary Cards */}
      <Animated.View entering={FadeInDown.delay(75).springify().damping(16)} style={s.metricsRow}>
        <View style={s.metricCard}>
          <Scale size={18} color={theme.colors.primary} strokeWidth={2} />
          <Text style={s.metricValue}>{animal.currentWeightKg != null ? `${animal.currentWeightKg}` : '—'}</Text>
          <Text style={s.metricLabel}>Peso atual (kg)</Text>
        </View>
        <View style={s.metricCard}>
          <GitBranch size={18} color={theme.colors.primary} strokeWidth={2} />
          <Text style={s.metricValue}>{gainSummary ? gainSummary.averageDailyGainKg.toFixed(2) : '—'}</Text>
          <Text style={s.metricLabel}>GMD (kg/dia)</Text>
        </View>
        <View style={s.metricCard}>
          <Scale size={18} color={theme.colors.primary} strokeWidth={2} />
          <Text style={s.metricValue}>{gainSummary ? gainSummary.averageMonthlyGainKg.toFixed(1) : '—'}</Text>
          <Text style={s.metricLabel}>Ganho mensal (kg)</Text>
        </View>
      </Animated.View>

      {/* Dados gerais */}
      <Animated.View entering={FadeInDown.delay(100).springify().damping(16)} style={s.section}>
        <Text style={s.sectionTitle}>Dados gerais</Text>
        <Row label="Brinco" value={animal.earTag} />
        <Row label="RFID" value={animal.rfid} />
        <Row label="Raça" value={animal.breed} />
        <Row label="Categoria" value={animal.category} />
        <Row label="Sexo" value={SEX_LABELS[animal.sex] ?? animal.sex} />
        <Row label="Peso atual" value={animal.currentWeightKg ? `${animal.currentWeightKg} kg` : undefined} />
        <View style={{ marginTop: 8 }}>
          <DateInput
            label="Data de nascimento"
            value={animal.birthDate ? animal.birthDate.slice(0, 10) : ''}
            onChange={(v: string) => { if (v) updateBirthDate.mutate(v); }}
            placeholder="Selecionar data"
          />
        </View>
        <View style={{ marginTop: 4 }}>
          <DateInput
            label="Data de entrada"
            value={animal.entryDate ? animal.entryDate.slice(0, 10) : ''}
            onChange={(v: string) => { if (v) updateEntryDate.mutate(v); }}
            placeholder="Selecionar data"
          />
        </View>
        {age && <Row label="Idade" value={age.label} />}
        <Row label="Status" value={animal.active ? 'Ativo' : 'Inativo'} />

        {/* Performance selector */}
        <View style={{ marginTop: 12 }}>
          <Text style={s.fieldLabel}>Desempenho</Text>
          <View style={[s.chipRow, { marginTop: 6 }]}>
            {PERFORMANCE_OPTIONS.map((perf) => {
              const isActive = animal.performance === perf;
              const colors = perf ? PERF_COLORS[perf] : null;
              return (
                <TouchableOpacity
                  key={perf ?? 'none'}
                  style={[
                    s.chip,
                    isActive && {
                      backgroundColor: colors?.bg ?? '#F2F4F1',
                      borderColor: colors?.text ?? theme.colors.border,
                    },
                  ]}
                  onPress={() => {
                    if (!isActive) updatePerformance.mutate(perf);
                  }}
                >
                  <Text style={[
                    s.chipText,
                    isActive && {
                      color: colors?.text ?? theme.colors.text,
                      fontWeight: '600',
                    },
                  ]}>
                    {perf ? ANIMAL_PERFORMANCE_LABEL[perf] : 'Nenhum'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Animated.View>

      {/* Pasto */}
      <Animated.View entering={FadeInDown.delay(110).springify().damping(16)} style={s.section}>
        <View style={s.sectionHeader}>
          <MapPin size={18} color={theme.colors.primary} strokeWidth={2} />
          <Text style={s.sectionTitle}>Pasto</Text>
        </View>
        <Text style={s.fieldValue}>
          {currentPasture ? currentPasture.name : 'Sem pasto atribuído'}
        </Text>
        <TouchableOpacity style={[s.addBtn, { marginTop: 10, width: 'auto' as any, paddingHorizontal: 14, flexDirection: 'row', gap: 6 }]} onPress={() => setShowPasturePicker(true)}>
          <MapPin size={14} color="#fff" strokeWidth={2} />
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Alterar pasto</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Evolução de peso */}
      {weighings && weighings.length >= 2 && (() => {
        const sorted = [...weighings].sort((a, b) => new Date(a.weighedAt).getTime() - new Date(b.weighedAt).getTime());
        const chartW = SCREEN_WIDTH - 64;
        const chartH = 160;
        const padL = 45, padR = 16, padT = 16, padB = 24;
        const plotW = chartW - padL - padR;
        const plotH = chartH - padT - padB;
        const weights = sorted.map(w => w.weightKg);
        const minW = Math.min(...weights);
        const maxW = Math.max(...weights);
        const range = maxW - minW || 1;
        const points = sorted.map((w, i) => ({
          x: padL + (sorted.length > 1 ? (i / (sorted.length - 1)) * plotW : plotW / 2),
          y: padT + plotH - ((w.weightKg - minW) / range) * plotH,
        }));
        const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
        const areaPath = `${linePath} L${points[points.length - 1].x},${padT + plotH} L${points[0].x},${padT + plotH} Z`;
        const fmtShort = (d: string) => { const dt = new Date(d); return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`; };

        return (
          <Animated.View entering={FadeInDown.delay(120).springify().damping(16)} style={s.section}>
            <View style={s.sectionHeader}>
              <Scale size={18} color={theme.colors.primary} strokeWidth={2} />
              <Text style={s.sectionTitle}>Evolução de peso</Text>
            </View>
            <Svg width={chartW} height={chartH}>
              <Path d={areaPath} fill={theme.colors.primary} opacity={0.15} />
              <Path d={linePath} fill="none" stroke={theme.colors.primary} strokeWidth={2.5} />
              {points.map((p, i) => (
                <Circle key={sorted[i].id} cx={p.x} cy={p.y} r={4} fill={theme.colors.primary} />
              ))}
              <SvgText x={padL - 4} y={padT + 4} textAnchor="end" fontSize={10} fill={theme.colors.textMuted}>{`${Math.round(maxW)} kg`}</SvgText>
              <SvgText x={padL - 4} y={padT + plotH} textAnchor="end" fontSize={10} fill={theme.colors.textMuted}>{`${Math.round(minW)} kg`}</SvgText>
              <SvgText x={points[0].x} y={chartH - 2} textAnchor="start" fontSize={10} fill={theme.colors.textMuted}>{fmtShort(sorted[0].weighedAt)}</SvgText>
              <SvgText x={points[points.length - 1].x} y={chartH - 2} textAnchor="end" fontSize={10} fill={theme.colors.textMuted}>{fmtShort(sorted[sorted.length - 1].weighedAt)}</SvgText>
            </Svg>
          </Animated.View>
        );
      })()}

      {/* Pesagens */}
      <Animated.View entering={FadeInDown.delay(150).springify().damping(16)} style={s.section}>
        <View style={s.sectionHeader}>
          <Scale size={18} color={theme.colors.primary} strokeWidth={2} />
          <Text style={s.sectionTitle}>Pesagens</Text>
          <TouchableOpacity style={s.addBtn} onPress={() => { setEditingWeighing(null); setWForm({ weightKg: '', weighedAt: today() }); setShowWeighingForm(true); }}>
            <Ionicons name="add" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
        {(!weighings || weighings.length === 0) ? (
          <Text style={s.emptyText}>Nenhuma pesagem registrada</Text>
        ) : (
          weighings.slice(0, 20).map((w: Weighing) => (
            <View key={w.id} style={s.listItem}>
              <View style={{ flex: 1 }}>
                <Text style={s.listPrimary}>{w.weightKg} kg</Text>
                <Text style={s.listSecondary}>{fmtDate(w.weighedAt)}</Text>
              </View>
              <TouchableOpacity onPress={() => { setEditingWeighing(w); setWForm({ weightKg: String(w.weightKg), weighedAt: w.weighedAt.slice(0, 10) }); setShowWeighingForm(true); }} style={s.iconBtn}>
                <Pencil size={15} color={theme.colors.textMuted} strokeWidth={2} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => Alert.alert('Excluir pesagem?', `${w.weightKg} kg`, [{ text: 'Não' }, { text: 'Sim', style: 'destructive', onPress: () => deleteWeighing.mutate(w.id) }])} style={s.iconBtn}>
                <Trash2 size={15} color={theme.colors.danger} strokeWidth={2} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </Animated.View>

      {/* Vacinações */}
      <Animated.View entering={FadeInDown.delay(200).springify().damping(16)} style={s.section}>
        <View style={s.sectionHeader}>
          <Syringe size={18} color="#7C3AED" strokeWidth={2} />
          <Text style={s.sectionTitle}>Vacinações</Text>
          <TouchableOpacity style={[s.addBtn, { backgroundColor: '#7C3AED' }]} onPress={() => { setVForm({ vaccineName: '', scheduledDate: today(), batchNumber: '' }); setShowVaccForm(true); }}>
            <Ionicons name="add" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
        {(!vaccinations || vaccinations.length === 0) ? (
          <Text style={s.emptyText}>Nenhuma vacinação registrada</Text>
        ) : (
          vaccinations.map((v: Vaccination) => (
            <View key={v.id} style={s.listItem}>
              <View style={{ flex: 1 }}>
                <Text style={s.listPrimary}>{v.vaccineName}</Text>
                <Text style={s.listSecondary}>
                  Agendada: {fmtDate(v.scheduledDate)}
                  {v.administeredAt ? ` · Aplicada: ${fmtDate(v.administeredAt)}` : ''}
                </Text>
              </View>
              {!v.administeredAt && (
                <TouchableOpacity style={s.applyBtn} onPress={() => { Haptics.selectionAsync(); markAdministered.mutate(v.id); }}>
                  <Text style={s.applyBtnText}>Aplicar</Text>
                </TouchableOpacity>
              )}
              {v.administeredAt && (
                <View style={s.appliedBadge}><Text style={s.appliedText}>Aplicada</Text></View>
              )}
            </View>
          ))
        )}
      </Animated.View>

      {/* Reprodução */}
      <Animated.View entering={FadeInDown.delay(250).springify().damping(16)} style={s.section}>
        <View style={s.sectionHeader}>
          <Heart size={18} color="#BE185D" strokeWidth={2} />
          <Text style={s.sectionTitle}>Reprodução</Text>
          <TouchableOpacity style={[s.addBtn, { backgroundColor: '#BE185D' }]} onPress={() => { setEditingRepro(null); setRForm({ type: 'IATF', eventDate: today(), result: '', notes: '' }); setShowReproForm(true); }}>
            <Ionicons name="add" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
        {(!reproEvents || reproEvents.length === 0) ? (
          <Text style={s.emptyText}>Nenhum evento reprodutivo</Text>
        ) : (
          reproEvents.map((r: ReproEvent) => (
            <View key={r.id} style={s.listItem}>
              <View style={{ flex: 1 }}>
                <Text style={s.listPrimary}>{REPRO_LABELS[r.type] ?? r.type}</Text>
                <Text style={s.listSecondary}>
                  {fmtDate(r.eventDate)}
                  {r.result ? ` · ${r.result}` : ''}
                  {r.notes ? ` · ${r.notes}` : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={() => { setEditingRepro(r); setRForm({ type: r.type, eventDate: r.eventDate.slice(0, 10), result: r.result ?? '', notes: r.notes ?? '' }); setShowReproForm(true); }} style={s.iconBtn}>
                <Pencil size={15} color={theme.colors.textMuted} strokeWidth={2} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => Alert.alert('Excluir evento?', REPRO_LABELS[r.type], [{ text: 'Não' }, { text: 'Sim', style: 'destructive', onPress: () => deleteRepro.mutate(r.id) }])} style={s.iconBtn}>
                <Trash2 size={15} color={theme.colors.danger} strokeWidth={2} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </Animated.View>

      {/* Histórico */}
      <Animated.View entering={FadeInDown.delay(300).springify().damping(16)} style={s.section}>
        <View style={s.sectionHeader}>
          <Clock size={18} color={theme.colors.primary} strokeWidth={2} />
          <Text style={s.sectionTitle}>Histórico</Text>
        </View>
        {(!history || history.length === 0) ? (
          <Text style={s.emptyText}>Nenhum evento no histórico</Text>
        ) : (
          history.map((evt: AnimalEvent, idx: number) => (
            <View key={evt.id} style={s.timelineItem}>
              <View style={s.timelineDot} />
              {idx < history.length - 1 && <View style={s.timelineLine} />}
              <View style={s.timelineContent}>
                <Text style={s.listPrimary}>{ANIMAL_EVENT_TYPE_LABEL[evt.type] ?? evt.type}</Text>
                <Text style={s.listSecondary}>{fmtDate(evt.occurredAt)}</Text>
                {evt.description ? <Text style={[s.listSecondary, { marginTop: 2 }]}>{evt.description}</Text> : null}
              </View>
            </View>
          ))
        )}
      </Animated.View>

      {/* Modal: Pesagem */}
      <Modal visible={showWeighingForm} animationType="slide" transparent>
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.modal}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>{editingWeighing ? 'Editar Pesagem' : 'Nova Pesagem'}</Text>
            <Text style={s.label}>Peso (kg) *</Text>
            <TextInput style={s.input} value={wForm.weightKg} onChangeText={(v) => setWForm({ ...wForm, weightKg: v })} keyboardType="numeric" placeholder="Ex: 350" placeholderTextColor={theme.colors.textFaint} />
            <DateInput label="Data" value={wForm.weighedAt} onChange={(v) => setWForm({ ...wForm, weighedAt: v })} />
            <View style={s.modalActions}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => { setShowWeighingForm(false); setEditingWeighing(null); }}><Text style={s.cancelText}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={s.saveBtn} onPress={() => {
                if (!wForm.weightKg) { Alert.alert('Erro', 'Peso é obrigatório'); return; }
                const body = { weightKg: Number(wForm.weightKg), weighedAt: wForm.weighedAt || undefined };
                if (editingWeighing) updateWeighing.mutate({ id: editingWeighing.id, ...body });
                else createWeighing.mutate(body);
              }}>
                <Text style={s.saveText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal: Vacinação */}
      <Modal visible={showVaccForm} animationType="slide" transparent>
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.modal}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>Nova Vacinação</Text>
            <Text style={s.label}>Vacina *</Text>
            <TextInput style={s.input} value={vForm.vaccineName} onChangeText={(v) => setVForm({ ...vForm, vaccineName: v })} placeholder="Ex: Aftosa" placeholderTextColor={theme.colors.textFaint} />
            <DateInput label="Data agendada" value={vForm.scheduledDate} onChange={(v) => setVForm({ ...vForm, scheduledDate: v })} />
            <Text style={s.label}>Lote</Text>
            <TextInput style={s.input} value={vForm.batchNumber} onChangeText={(v) => setVForm({ ...vForm, batchNumber: v })} placeholder="Opcional" placeholderTextColor={theme.colors.textFaint} />
            <View style={s.modalActions}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setShowVaccForm(false)}><Text style={s.cancelText}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={s.saveBtn} onPress={() => {
                if (!vForm.vaccineName) { Alert.alert('Erro', 'Nome da vacina é obrigatório'); return; }
                createVacc.mutate({ vaccineName: vForm.vaccineName, scheduledDate: vForm.scheduledDate || undefined, batchNumber: vForm.batchNumber || undefined });
              }}>
                <Text style={s.saveText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal: Reprodução */}
      <Modal visible={showReproForm} animationType="slide" transparent>
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.modal}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>{editingRepro ? 'Editar Evento Reprodutivo' : 'Novo Evento Reprodutivo'}</Text>
            <Text style={s.label}>Tipo *</Text>
            <View style={s.chipRow}>
              {REPRO_TYPES.map((t) => (
                <TouchableOpacity key={t} style={[s.chip, rForm.type === t && { backgroundColor: '#BE185D', borderColor: '#BE185D' }]} onPress={() => setRForm({ ...rForm, type: t })}>
                  <Text style={[s.chipText, rForm.type === t && { color: '#fff', fontWeight: '600' }]}>{REPRO_LABELS[t]}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <DateInput label="Data" value={rForm.eventDate} onChange={(v) => setRForm({ ...rForm, eventDate: v })} />
            {rForm.type === 'DIAGNOSTICO_PRENHEZ' && (
              <>
                <Text style={s.label}>Resultado</Text>
                <View style={s.chipRow}>
                  {RESULT_OPTIONS.map((r) => (
                    <TouchableOpacity key={r} style={[s.chip, rForm.result === r && { backgroundColor: '#BE185D', borderColor: '#BE185D' }]} onPress={() => setRForm({ ...rForm, result: r })}>
                      <Text style={[s.chipText, rForm.result === r && { color: '#fff', fontWeight: '600' }]}>{r}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
            <Text style={s.label}>Observações</Text>
            <TextInput style={[s.input, { height: 60 }]} value={rForm.notes} onChangeText={(v) => setRForm({ ...rForm, notes: v })} multiline placeholder="Opcional" placeholderTextColor={theme.colors.textFaint} />
            <View style={s.modalActions}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => { setShowReproForm(false); setEditingRepro(null); }}><Text style={s.cancelText}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={s.saveBtn} onPress={() => {
                const body = { type: rForm.type, eventDate: rForm.eventDate || undefined, result: rForm.result || undefined, notes: rForm.notes || undefined };
                if (editingRepro) updateRepro.mutate({ id: editingRepro.id, ...body });
                else createRepro.mutate(body);
              }}>
                <Text style={s.saveText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal: Pasture Picker */}
      <Modal visible={showPasturePicker} animationType="slide" transparent>
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.modal}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>Selecionar Pasto</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {pastures && pastures.map((p: Pasture) => (
                <TouchableOpacity
                  key={p.id}
                  style={[s.listItem, animal.pastureId === p.id && { backgroundColor: '#E7F3EB' }]}
                  onPress={() => {
                    movePasture.mutate(p.id);
                    setShowPasturePicker(false);
                  }}
                >
                  <MapPin size={16} color={animal.pastureId === p.id ? theme.colors.primary : theme.colors.textMuted} strokeWidth={2} />
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={s.listPrimary}>{p.name}</Text>
                    <Text style={s.listSecondary}>{p.areaHectares} ha · Cap. {p.animalCapacity}</Text>
                  </View>
                  {animal.pastureId === p.id && (
                    <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={s.modalActions}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setShowPasturePicker(false)}><Text style={s.cancelText}>Fechar</Text></TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null;
  return (
    <View style={s.fieldRow}>
      <Text style={s.fieldLabel}>{label}</Text>
      <Text style={s.fieldValue}>{String(value)}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.bg },
  headerCard: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: 20, marginBottom: 14, alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border, ...theme.shadow.card },
  headerIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: '#E7F3EB', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  animalName: { fontSize: 22, fontWeight: '800', color: theme.colors.text, letterSpacing: -0.3 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8, justifyContent: 'center' },
  tag: { backgroundColor: '#E7F3EB', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  tagText: { fontSize: 12, fontWeight: '600', color: theme.colors.primary },
  metricsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  metricCard: { flex: 1, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border, ...theme.shadow.card, gap: 4 },
  metricValue: { fontSize: 18, fontWeight: '800', color: theme.colors.text, letterSpacing: -0.3 },
  metricLabel: { fontSize: 10, color: theme.colors.textMuted, textAlign: 'center' },
  section: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: theme.colors.border, ...theme.shadow.card },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.text, flex: 1, letterSpacing: -0.2 },
  addBtn: { width: 30, height: 30, borderRadius: 10, backgroundColor: theme.colors.primary, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 13, color: theme.colors.textMuted, fontStyle: 'italic' },
  listItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.border, gap: 8 },
  listPrimary: { fontSize: 14, fontWeight: '700', color: theme.colors.text },
  listSecondary: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  iconBtn: { padding: 6 },
  applyBtn: { backgroundColor: '#7C3AED', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  applyBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  appliedBadge: { backgroundColor: '#DCFCE7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  appliedText: { color: '#15803D', fontSize: 12, fontWeight: '600' },
  fieldRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  fieldLabel: { fontSize: 14, color: theme.colors.textMuted },
  fieldValue: { fontSize: 14, fontWeight: '600', color: theme.colors.text },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(16,24,40,0.55)', justifyContent: 'flex-end' },
  modal: { backgroundColor: theme.colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '85%' },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: theme.colors.border, alignSelf: 'center', marginBottom: 14 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: theme.colors.text, marginBottom: 12, letterSpacing: -0.3 },
  label: { fontSize: 13, fontWeight: '600', color: theme.colors.textMuted, marginBottom: 4, marginTop: 12 },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.sm, padding: 12, fontSize: 15, backgroundColor: '#FAFBFA', color: theme.colors.text },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18, backgroundColor: '#F2F4F1', borderWidth: 1, borderColor: theme.colors.border },
  chipText: { fontSize: 12, color: theme.colors.textMuted },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20, marginBottom: 20 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: theme.radius.sm, backgroundColor: '#F2F4F1', alignItems: 'center' },
  cancelText: { fontSize: 15, fontWeight: '700', color: theme.colors.textMuted },
  saveBtn: { flex: 1, padding: 14, borderRadius: theme.radius.sm, backgroundColor: theme.colors.primary, alignItems: 'center' },
  saveText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  timelineItem: { flexDirection: 'row', paddingLeft: 4, marginBottom: 4, position: 'relative' },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.primary, marginTop: 5, marginRight: 12 },
  timelineLine: { position: 'absolute', left: 8, top: 18, width: 2, bottom: -4, backgroundColor: theme.colors.border },
  timelineContent: { flex: 1, paddingBottom: 10 },
});
