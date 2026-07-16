import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { apiFetch } from '../../../src/lib/api';

interface Subscription { status: string; plan?: string; expiresAt?: string; trialEndsAt?: string }

export default function SubscriptionScreen() {
  const [sub, setSub] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Subscription>('/auth/subscription')
      .then(setSub)
      .catch((err) => Alert.alert('Erro', err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#1B5E20" /></View>;

  const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={s.title}>Assinatura</Text>
      <View style={s.card}>
        <View style={s.row}>
          <Text style={s.label}>Status</Text>
          <Text style={s.value}>{sub?.status ?? 'Desconhecido'}</Text>
        </View>
        <View style={s.row}>
          <Text style={s.label}>Plano</Text>
          <Text style={s.value}>{sub?.plan ?? '—'}</Text>
        </View>
        <View style={s.row}>
          <Text style={s.label}>Válido até</Text>
          <Text style={s.value}>{fmtDate(sub?.expiresAt)}</Text>
        </View>
        {sub?.trialEndsAt && (
          <View style={s.row}>
            <Text style={s.label}>Trial até</Text>
            <Text style={s.value}>{fmtDate(sub.trialEndsAt)}</Text>
          </View>
        )}
      </View>
      <Text style={s.hint}>Para alterar seu plano, acesse a versão web.</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700', color: '#1B5E20', marginBottom: 20 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  label: { fontSize: 14, color: '#666' },
  value: { fontSize: 14, fontWeight: '600', color: '#333' },
  hint: { fontSize: 13, color: '#999', textAlign: 'center', marginTop: 20 },
});
