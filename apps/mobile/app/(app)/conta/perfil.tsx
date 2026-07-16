import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { apiFetch } from '../../../src/lib/api';
import { useAuth } from '../../../src/lib/auth-context';

interface Profile { name: string; email: string; phone?: string }

export default function ProfileScreen() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<Profile>('/auth/profile')
      .then(setProfile)
      .catch((err) => Alert.alert('Erro', err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      await apiFetch('/auth/profile', { method: 'PATCH', body: profile });
      Alert.alert('Sucesso', 'Perfil atualizado');
    } catch (err: any) {
      Alert.alert('Erro', err.message);
    } finally { setSaving(false); }
  };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#1B5E20" /></View>;

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={s.title}>Meu Perfil</Text>
      <Text style={s.label}>Nome</Text>
      <TextInput style={s.input} value={profile?.name ?? ''} onChangeText={(v) => setProfile((p) => p ? { ...p, name: v } : p)} />
      <Text style={s.label}>E-mail</Text>
      <TextInput style={[s.input, s.disabled]} value={profile?.email ?? ''} editable={false} />
      <Text style={s.label}>Telefone</Text>
      <TextInput style={s.input} value={profile?.phone ?? ''} onChangeText={(v) => setProfile((p) => p ? { ...p, phone: v } : p)} keyboardType="phone-pad" />
      <TouchableOpacity style={s.button} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.buttonText}>Salvar</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700', color: '#1B5E20', marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#666', marginBottom: 4, marginTop: 12 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, fontSize: 16 },
  disabled: { backgroundColor: '#f0f0f0', color: '#999' },
  button: { backgroundColor: '#1B5E20', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 24 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
