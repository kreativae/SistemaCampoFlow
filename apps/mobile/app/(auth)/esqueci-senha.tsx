import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { Link } from 'expo-router';
import { apiFetch } from '../../src/lib/api';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!email) { Alert.alert('Erro', 'Preencha o e-mail'); return; }
    setLoading(true);
    try {
      await apiFetch('/auth/esqueci-senha', { method: 'POST', body: { email } });
      setSent(true);
    } catch (err: any) {
      Alert.alert('Erro', err.message ?? 'Falha ao enviar');
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={s.card}>
        <Text style={s.title}>Recuperar senha</Text>
        {sent ? (
          <Text style={s.message}>Se o e-mail estiver cadastrado, você receberá instruções para redefinir a senha.</Text>
        ) : (
          <>
            <TextInput style={s.input} placeholder="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            <TouchableOpacity style={s.button} onPress={handleSubmit} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.buttonText}>Enviar</Text>}
            </TouchableOpacity>
          </>
        )}
        <Link href="/(auth)/entrar" style={s.link}><Text style={s.linkText}>Voltar ao login</Text></Link>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 24, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  title: { fontSize: 22, fontWeight: '700', color: '#1B5E20', textAlign: 'center', marginBottom: 24 },
  message: { fontSize: 15, color: '#333', textAlign: 'center', lineHeight: 22 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, fontSize: 16, marginBottom: 12, backgroundColor: '#fafafa' },
  button: { backgroundColor: '#1B5E20', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { marginTop: 16, alignSelf: 'center' },
  linkText: { color: '#1B5E20', fontSize: 14 },
});
