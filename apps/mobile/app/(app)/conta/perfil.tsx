import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { apiFetch } from '../../../src/lib/api';
import { useAuth } from '../../../src/lib/auth-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { theme } from '../../../src/lib/theme';

interface Profile { name: string; email: string; phone?: string }

function getInitials(name?: string): string {
  if (!name) return '?';
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<Profile>('/auth/me')
      .then(setProfile)
      .catch((err) => Alert.alert('Erro', err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      await apiFetch('/auth/me', { method: 'PATCH', body: profile });
      Alert.alert('Sucesso', 'Perfil atualizado');
    } catch (err: any) {
      Alert.alert('Erro', err.message);
    } finally { setSaving(false); }
  };

  const handleLogout = () => {
    Alert.alert('Sair da conta', 'Tem certeza que deseja sair?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/entrar');
        },
      },
    ]);
  };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={theme.colors.primary} /></View>;

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      {/* Avatar + Identity */}
      <Animated.View entering={FadeInDown.delay(100).duration(400)} style={s.avatarSection}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{getInitials(profile?.name || user?.name)}</Text>
        </View>
        <Text style={s.userName}>{profile?.name || user?.name || ''}</Text>
        <Text style={s.userEmail}>{profile?.email || user?.email || ''}</Text>
      </Animated.View>

      {/* Profile Form */}
      <Animated.View entering={FadeInDown.delay(200).duration(400)} style={[s.card, theme.shadow.card]}>
        <Text style={s.cardTitle}>Dados pessoais</Text>

        <Text style={s.label}>Nome</Text>
        <TextInput
          style={s.input}
          value={profile?.name ?? ''}
          onChangeText={(v) => setProfile((p) => p ? { ...p, name: v } : p)}
          placeholder="Seu nome"
          placeholderTextColor={theme.colors.textFaint}
        />

        <Text style={s.label}>E-mail</Text>
        <TextInput
          style={[s.input, s.disabled]}
          value={profile?.email ?? ''}
          editable={false}
        />

        <Text style={s.label}>Telefone</Text>
        <TextInput
          style={s.input}
          value={profile?.phone ?? ''}
          onChangeText={(v) => setProfile((p) => p ? { ...p, phone: v } : p)}
          keyboardType="phone-pad"
          placeholder="(00) 00000-0000"
          placeholderTextColor={theme.colors.textFaint}
        />

        <TouchableOpacity style={s.saveButton} onPress={handleSave} disabled={saving} activeOpacity={0.8}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveButtonText}>Salvar alterações</Text>}
        </TouchableOpacity>
      </Animated.View>

      {/* Subscription Link */}
      <Animated.View entering={FadeInDown.delay(300).duration(400)}>
        <TouchableOpacity
          style={[s.card, s.linkCard, theme.shadow.card]}
          onPress={() => router.push('/(app)/conta/assinatura')}
          activeOpacity={0.7}
        >
          <View style={s.linkCardLeft}>
            <View style={s.linkIconBox}>
              <Ionicons name="diamond-outline" size={20} color={theme.colors.primary} />
            </View>
            <View>
              <Text style={s.linkCardTitle}>Minha assinatura</Text>
              <Text style={s.linkCardSub}>Gerencie seu plano e pagamentos</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
        </TouchableOpacity>
      </Animated.View>

      {/* Logout */}
      <Animated.View entering={FadeInDown.delay(400).duration(400)}>
        <TouchableOpacity style={s.logoutButton} onPress={handleLogout} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={20} color={theme.colors.danger} />
          <Text style={s.logoutText}>Sair da conta</Text>
        </TouchableOpacity>
      </Animated.View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.bg },

  // Avatar section
  avatarSection: { alignItems: 'center', marginBottom: 24, marginTop: 8 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: '700' },
  userName: { fontSize: 20, fontWeight: '700', color: theme.colors.text },
  userEmail: { fontSize: 14, color: theme.colors.textMuted, marginTop: 2 },

  // Card
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.text, marginBottom: 16 },

  // Form
  label: { fontSize: 13, fontWeight: '600', color: theme.colors.textMuted, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: theme.colors.bg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    padding: 14,
    fontSize: 16,
    color: theme.colors.text,
  },
  disabled: { backgroundColor: '#F0F0F0', color: theme.colors.textFaint },
  saveButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  // Link card
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  linkCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  linkIconBox: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: theme.colors.bg,
    justifyContent: 'center', alignItems: 'center',
  },
  linkCardTitle: { fontSize: 15, fontWeight: '600', color: theme.colors.text },
  linkCardSub: { fontSize: 13, color: theme.colors.textMuted, marginTop: 2 },

  // Logout
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    marginTop: 8,
  },
  logoutText: { fontSize: 16, fontWeight: '600', color: theme.colors.danger },
});
