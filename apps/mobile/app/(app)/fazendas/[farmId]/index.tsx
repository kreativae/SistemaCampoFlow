import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Beef, Leaf, Wallet, Heart, Package, Tractor, Users, UserPlus, Calendar, Sprout, Handshake, FileText, BarChart3, Sparkles, Bell, BookUser, MapPin, type LucideIcon } from 'lucide-react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiFetch } from '../../../../src/lib/api';
import { theme } from '../../../../src/lib/theme';
import { useOnlineStatus } from '../../../../src/lib/offline-sync';

interface DashboardData {
  totalAnimals: number;
  averageWeightKg: number;
  averageDailyGainKg: number;
  stockingRate: { totalCapacity: number; occupiedHeadCount: number; occupancyRate: number };
  currentMonthFinance: { receita: number; despesa: number; saldo: number };
  pendingAlerts: any[];
}

const modules: { key: string; label: string; icon: LucideIcon; color: string; bg: string }[] = [
  { key: 'animais', label: 'Rebanho', icon: Beef, color: '#14532D', bg: '#E7F3EB' },
  { key: 'pastagens', label: 'Pastagens', icon: Leaf, color: '#4D7C0F', bg: '#F0F7E5' },
  { key: 'financeiro', label: 'Financeiro', icon: Wallet, color: '#B45309', bg: '#FDF3E1' },
  { key: 'reproducao', label: 'Reprodução', icon: Heart, color: '#BE185D', bg: '#FCE9F1' },
  { key: 'insumos', label: 'Insumos', icon: Package, color: '#6D28D9', bg: '#F0EAFB' },
  { key: 'maquinas', label: 'Máquinas', icon: Tractor, color: '#B91C1C', bg: '#FCEAEA' },
  { key: 'equipe', label: 'Equipe', icon: Users, color: '#0E7490', bg: '#E5F5F9' },
  { key: 'agenda', label: 'Agenda', icon: Calendar, color: '#1D4ED8', bg: '#E8EEFC' },
  { key: 'safras', label: 'Safras', icon: Sprout, color: '#A16207', bg: '#FBF4DE' },
  { key: 'negocios', label: 'Negócios', icon: Handshake, color: '#374151', bg: '#EEF0F3' },
  { key: 'documentos', label: 'Documentos', icon: FileText, color: '#0369A1', bg: '#E4F2FA' },
  { key: 'relatorios', label: 'Relatórios', icon: BarChart3, color: '#7C3AED', bg: '#F1EBFC' },
  { key: 'inteligencia', label: 'Inteligência', icon: Sparkles, color: '#0F766E', bg: '#E4F5F3' },
  { key: 'notificacoes', label: 'Notificações', icon: Bell, color: '#C2410C', bg: '#FDEEE4' },
  { key: 'contatos', label: 'Contatos', icon: BookUser, color: '#15803D', bg: '#E8F5EC' },
  { key: 'membros', label: 'Membros', icon: UserPlus, color: '#6D28D9', bg: '#F0EAFB' },
  { key: 'mapa', label: 'Mapa', icon: MapPin, color: '#0369A1', bg: '#E4F2FA' },
];

function MetricCard({ label, value, icon, index }: { label: string; value: string | number; icon: keyof typeof Ionicons.glyphMap; index: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(index * 80).springify().damping(16)} style={s.metric}>
      <View style={s.metricIcon}><Ionicons name={icon} size={17} color={theme.colors.primary} /></View>
      <Text style={s.metricValue}>{value}</Text>
      <Text style={s.metricLabel}>{label}</Text>
    </Animated.View>
  );
}

export default function FarmDashboard() {
  const insets = useSafeAreaInsets();
  const { farmId } = useLocalSearchParams<{ farmId: string }>();
  const isOnline = useOnlineStatus();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const res = await apiFetch<DashboardData>(`/fazendas/${farmId}/painel`);
      setData(res);
    } catch (err: any) {
      Alert.alert('Erro', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, [farmId]);

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={theme.colors.primary} /></View>;

  const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 32 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.colors.primary} />}>
      <LinearGradient colors={[theme.colors.primaryDark, theme.colors.primary, theme.colors.primaryLight]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.hero, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={s.backBtn} activeOpacity={0.7} onPress={() => { Haptics.selectionAsync(); if (router.canGoBack()) router.back(); else router.replace('/(app)/fazendas'); }}>
          <Ionicons name="arrow-back" size={18} color="#fff" />
          <Text style={s.backText}>Minhas fazendas</Text>
        </TouchableOpacity>
        <Animated.Text entering={FadeInUp.delay(50)} style={s.heroEyebrow}>VISÃO GERAL</Animated.Text>
        <Animated.Text entering={FadeInUp.delay(120)} style={s.heroTitle}>Painel da fazenda</Animated.Text>
        {data && (
          <Animated.View entering={FadeInUp.delay(200)} style={s.heroStats}>
            <View style={s.heroStat}>
              <Text style={s.heroStatValue}>{data.totalAnimals}</Text>
              <Text style={s.heroStatLabel}>animais</Text>
            </View>
            <View style={s.heroDivider} />
            <View style={s.heroStat}>
              <Text style={[s.heroStatValue, { color: data.currentMonthFinance.saldo >= 0 ? '#BBF7D0' : '#FECACA' }]}>{fmt(data.currentMonthFinance.saldo)}</Text>
              <Text style={s.heroStatLabel}>saldo do mês</Text>
            </View>
          </Animated.View>
        )}
      </LinearGradient>

      {!isOnline && (
        <View style={s.offlineBanner}>
          <Ionicons name="cloud-offline" size={16} color="#92400E" />
          <Text style={s.offlineText}>Sem conexão — dados em cache</Text>
        </View>
      )}
      <View style={{ padding: 16, marginTop: data ? -28 : 12 }}>
        {data && (
          <>
            <View style={s.metricsRow}>
              <MetricCard index={0} icon="scale" label="Peso médio" value={`${data.averageWeightKg.toFixed(0)} kg`} />
              <MetricCard index={1} icon="trending-up" label="GMD" value={`${data.averageDailyGainKg.toFixed(2)} kg`} />
              <MetricCard index={2} icon="pie-chart" label="Ocupação" value={`${(data.stockingRate.occupancyRate * 100).toFixed(0)}%`} />
            </View>
            <Animated.View entering={FadeInDown.delay(260).springify().damping(16)} style={s.financeCard}>
              <View style={s.financeHeader}>
                <Ionicons name="wallet" size={18} color={theme.colors.primary} />
                <Text style={s.financeTitle}>Financeiro do mês</Text>
              </View>
              <View style={s.financeRow}>
                <View style={s.financeItem}>
                  <View style={s.financeLabelRow}><Ionicons name="arrow-up-circle" size={14} color={theme.colors.success} /><Text style={s.financeLabel}>Receita</Text></View>
                  <Text style={[s.financeValue, { color: theme.colors.success }]}>{fmt(data.currentMonthFinance.receita)}</Text>
                </View>
                <View style={s.financeItem}>
                  <View style={s.financeLabelRow}><Ionicons name="arrow-down-circle" size={14} color={theme.colors.danger} /><Text style={s.financeLabel}>Despesa</Text></View>
                  <Text style={[s.financeValue, { color: theme.colors.danger }]}>{fmt(data.currentMonthFinance.despesa)}</Text>
                </View>
                <View style={s.financeItem}>
                  <View style={s.financeLabelRow}><Ionicons name="cash" size={14} color={theme.colors.textMuted} /><Text style={s.financeLabel}>Saldo</Text></View>
                  <Text style={[s.financeValue, { color: data.currentMonthFinance.saldo >= 0 ? theme.colors.success : theme.colors.danger }]}>{fmt(data.currentMonthFinance.saldo)}</Text>
                </View>
              </View>
            </Animated.View>
          </>
        )}
        <Animated.Text entering={FadeInUp.delay(300)} style={s.sectionTitle}>Módulos</Animated.Text>
        <View style={s.modulesGrid}>
          {modules.map((m, i) => (
            <Animated.View key={m.key} entering={FadeInDown.delay(320 + i * 45).springify().damping(16)} style={s.moduleWrap}>
              <TouchableOpacity
                style={s.moduleCard}
                activeOpacity={0.8}
                onPress={() => { Haptics.selectionAsync(); router.navigate(`/(app)/fazendas/${farmId}/${m.key}` as any); }}
              >
                <View style={[s.moduleIconWrap, { backgroundColor: m.bg }]}>
                  <m.icon size={21} strokeWidth={1.9} color={m.color} />
                </View>
                <Text style={s.moduleLabel}>{m.label}</Text>
                <Ionicons name="chevron-forward" size={15} color={theme.colors.textFaint} style={s.moduleChevron} />
              </TouchableOpacity>
            </Animated.View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.bg },
  hero: { paddingTop: 14, paddingHorizontal: 20, paddingBottom: 48, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.14)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, marginBottom: 14 },
  backText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  heroEyebrow: { color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  heroTitle: { color: '#fff', fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginTop: 4 },
  heroStats: { flexDirection: 'row', alignItems: 'center', marginTop: 18, gap: 20 },
  heroStat: {},
  heroStatValue: { color: '#fff', fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  heroStatLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 },
  heroDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.25)' },
  metricsRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  metric: { flex: 1, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border, ...theme.shadow.card },
  metricIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#E7F3EB', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  metricValue: { fontSize: 17, fontWeight: '800', color: theme.colors.text, fontVariant: ['tabular-nums'] },
  metricLabel: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
  financeCard: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: 16, marginBottom: 22, borderWidth: 1, borderColor: theme.colors.border, ...theme.shadow.card },
  financeHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  financeTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.text },
  financeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  financeItem: { flex: 1 },
  financeLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  financeLabel: { fontSize: 11, color: theme.colors.textMuted },
  financeValue: { fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: theme.colors.text, marginBottom: 12, letterSpacing: -0.3 },
  modulesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  moduleWrap: { width: '48%', flexGrow: 1 },
  moduleCard: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: theme.colors.border, ...theme.shadow.card },
  moduleIconWrap: { width: 40, height: 40, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  moduleLabel: { fontSize: 13, fontWeight: '700', color: theme.colors.text, flex: 1 },
  moduleChevron: { marginLeft: -6 },
  offlineBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF3C7', paddingHorizontal: 16, paddingVertical: 10, marginHorizontal: 16, marginTop: -20, borderRadius: 10, marginBottom: 8 },
  offlineText: { fontSize: 13, fontWeight: '600', color: '#92400E' },
});
