import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Crown, Zap, Building2, Clock } from 'lucide-react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { apiFetch } from '../../../src/lib/api';
import { theme } from '../../../src/lib/theme';

interface SubscriptionData {
  id: string;
  accountId: string;
  planTier: string;
  status: string;
  trialEndsAt?: string;
  currentPeriodEnd?: string;
  plan: { tier: string; label: string; maxFarms: number | null; priceBRL: number | null };
  farmCount: number;
  farmsLimit: number | null;
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  TRIALING: { label: 'Em teste', color: '#1D4ED8', bg: '#DBEAFE' },
  ACTIVE: { label: 'Ativo', color: '#15803D', bg: '#DCFCE7' },
  CANCELED: { label: 'Cancelado', color: '#B91C1C', bg: '#FEE2E2' },
  PAST_DUE: { label: 'Pagamento pendente', color: '#B45309', bg: '#FEF3C7' },
  INCOMPLETE: { label: 'Incompleto', color: '#6B7280', bg: '#F3F4F6' },
};

const PLANS = [
  { tier: 'BASICO', label: 'Básico', price: 'R$ 99,90', period: '/mês', farms: '2 fazendas', icon: Zap, color: '#15803D', features: ['Até 2 fazendas', 'Todos os módulos', 'Suporte por email'] },
  { tier: 'PROFISSIONAL', label: 'Profissional', price: 'R$ 299,90', period: '/mês', farms: '10 fazendas', icon: Crown, color: '#7C3AED', features: ['Até 10 fazendas', 'Todos os módulos', 'Relatórios avançados', 'Suporte prioritário'], recommended: true },
  { tier: 'ENTERPRISE', label: 'Enterprise', price: 'Sob consulta', period: '', farms: 'Ilimitado', icon: Building2, color: '#0E7490', features: ['Fazendas ilimitadas', 'API dedicada', 'Gestor de conta', 'SLA garantido'] },
];

export default function SubscriptionScreen() {
  const [sub, setSub] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<SubscriptionData>('/conta/assinatura')
      .then(setSub)
      .catch((err) => Alert.alert('Erro', err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleCheckout = async (planTier: string) => {
    if (planTier === 'ENTERPRISE') {
      Alert.alert('Enterprise', 'Entre em contato pelo suporte para contratar o plano Enterprise.');
      return;
    }
    setCheckingOut(planTier);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await apiFetch<{ url: string }>('/conta/assinatura/checkout', { method: 'POST', body: { planTier } });
      if (res.url) {
        await Linking.openURL(res.url);
      }
    } catch (err: any) {
      Alert.alert('Erro', err.message);
    } finally {
      setCheckingOut(null);
    }
  };

  const handleCancel = () => {
    Alert.alert('Cancelar assinatura', 'Tem certeza? Você perderá acesso de escrita após o fim do período.', [
      { text: 'Não', style: 'cancel' },
      {
        text: 'Sim, cancelar', style: 'destructive', onPress: async () => {
          try {
            await apiFetch('/conta/assinatura/cancelar', { method: 'POST' });
            const updated = await apiFetch<SubscriptionData>('/conta/assinatura');
            setSub(updated);
            Alert.alert('Cancelado', 'Sua assinatura foi cancelada.');
          } catch (err: any) {
            Alert.alert('Erro', err.message);
          }
        },
      },
    ]);
  };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={theme.colors.primary} /></View>;

  const status = STATUS_LABELS[sub?.status ?? ''] ?? { label: sub?.status ?? '—', color: '#6B7280', bg: '#F3F4F6' };
  const daysLeft = sub?.trialEndsAt ? Math.max(0, Math.ceil((new Date(sub.trialEndsAt).getTime() - Date.now()) / 86400000)) : null;

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      {sub && (
        <Animated.View entering={FadeInDown.delay(50).springify().damping(16)} style={s.currentCard}>
          <View style={s.currentHeader}>
            <View>
              <Text style={s.currentPlanLabel}>Plano atual</Text>
              <Text style={s.currentPlanName}>{sub.plan.label}</Text>
            </View>
            <View style={[s.statusBadge, { backgroundColor: status.bg }]}>
              <Text style={[s.statusText, { color: status.color }]}>{status.label}</Text>
            </View>
          </View>
          <View style={s.currentDetails}>
            <View style={s.detailRow}>
              <Ionicons name="home-outline" size={16} color={theme.colors.textMuted} />
              <Text style={s.detailText}>{sub.farmCount} / {sub.farmsLimit ?? '∞'} fazendas</Text>
            </View>
            {daysLeft !== null && sub.status === 'TRIALING' && (
              <View style={s.detailRow}>
                <Clock size={16} color={theme.colors.textMuted} strokeWidth={2} />
                <Text style={s.detailText}>{daysLeft} dias restantes de teste</Text>
              </View>
            )}
            {sub.currentPeriodEnd && (
              <View style={s.detailRow}>
                <Ionicons name="calendar-outline" size={16} color={theme.colors.textMuted} />
                <Text style={s.detailText}>Válido até {new Date(sub.currentPeriodEnd).toLocaleDateString('pt-BR')}</Text>
              </View>
            )}
          </View>
          {(sub.status === 'ACTIVE' || sub.status === 'TRIALING') && sub.planTier !== 'TRIAL' && (
            <TouchableOpacity style={s.cancelLink} onPress={handleCancel}>
              <Text style={s.cancelLinkText}>Cancelar assinatura</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      )}

      <Animated.Text entering={FadeInUp.delay(150)} style={s.sectionTitle}>Planos disponíveis</Animated.Text>

      {PLANS.map((plan, i) => {
        const isCurrent = sub?.planTier === plan.tier;
        return (
          <Animated.View key={plan.tier} entering={FadeInDown.delay(200 + i * 80).springify().damping(16)}>
            <View style={[s.planCard, plan.recommended && s.planCardRecommended]}>
              {plan.recommended && (
                <View style={s.recommendedBadge}><Text style={s.recommendedText}>Recomendado</Text></View>
              )}
              <View style={s.planHeader}>
                <View style={[s.planIconWrap, { backgroundColor: plan.color + '18' }]}>
                  <plan.icon size={22} color={plan.color} strokeWidth={1.8} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.planName}>{plan.label}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                    <Text style={s.planPrice}>{plan.price}</Text>
                    {plan.period ? <Text style={s.planPeriod}>{plan.period}</Text> : null}
                  </View>
                </View>
              </View>
              <View style={s.featuresList}>
                {plan.features.map((f) => (
                  <View key={f} style={s.featureRow}>
                    <Ionicons name="checkmark-circle" size={16} color={plan.color} />
                    <Text style={s.featureText}>{f}</Text>
                  </View>
                ))}
              </View>
              {isCurrent ? (
                <View style={s.currentBtnWrap}>
                  <Text style={s.currentBtnText}>Plano atual</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={[s.upgradeBtn, { backgroundColor: plan.color }]}
                  activeOpacity={0.85}
                  onPress={() => handleCheckout(plan.tier)}
                  disabled={checkingOut !== null}
                >
                  {checkingOut === plan.tier ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={s.upgradeBtnText}>{plan.tier === 'ENTERPRISE' ? 'Falar com vendas' : 'Assinar'}</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.bg },
  currentCard: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: 18, marginBottom: 20, borderWidth: 1, borderColor: theme.colors.border, ...theme.shadow.card },
  currentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  currentPlanLabel: { fontSize: 12, color: theme.colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  currentPlanName: { fontSize: 20, fontWeight: '800', color: theme.colors.text, marginTop: 2, letterSpacing: -0.3 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: '700' },
  currentDetails: { gap: 8 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailText: { fontSize: 14, color: theme.colors.textMuted },
  cancelLink: { marginTop: 14, alignSelf: 'flex-start' },
  cancelLinkText: { fontSize: 13, color: theme.colors.danger, fontWeight: '600' },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: theme.colors.text, marginBottom: 14, letterSpacing: -0.3 },
  planCard: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: theme.colors.border, ...theme.shadow.card },
  planCardRecommended: { borderColor: '#7C3AED', borderWidth: 2 },
  recommendedBadge: { position: 'absolute', top: -10, right: 16, backgroundColor: '#7C3AED', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  recommendedText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  planHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
  planIconWrap: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  planName: { fontSize: 16, fontWeight: '800', color: theme.colors.text, letterSpacing: -0.2 },
  planPrice: { fontSize: 22, fontWeight: '800', color: theme.colors.text, letterSpacing: -0.5 },
  planPeriod: { fontSize: 13, color: theme.colors.textMuted, marginLeft: 2 },
  featuresList: { gap: 6, marginBottom: 16 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureText: { fontSize: 13, color: theme.colors.textMuted },
  currentBtnWrap: { backgroundColor: '#F2F4F1', borderRadius: theme.radius.sm, padding: 13, alignItems: 'center' },
  currentBtnText: { fontSize: 14, fontWeight: '700', color: theme.colors.textMuted },
  upgradeBtn: { borderRadius: theme.radius.sm, padding: 14, alignItems: 'center' },
  upgradeBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
