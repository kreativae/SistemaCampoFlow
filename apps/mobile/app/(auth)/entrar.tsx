import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { Link, router } from 'expo-router';
import { useAuth } from '../../src/lib/auth-context';
import { isBiometricAvailable, authenticateWithBiometrics } from '../../src/lib/biometrics';
import * as SecureStore from 'expo-secure-store';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaRequired, setMfaRequired] = useState(false);
  const [loading, setLoading] = useState(false);
  const [biometricReady, setBiometricReady] = useState(false);

  useEffect(() => {
    (async () => {
      const available = await isBiometricAvailable();
      const hasSaved = await SecureStore.getItemAsync('campoflow.biometric');
      setBiometricReady(available && !!hasSaved);
    })();
  }, []);

  const handleBiometric = async () => {
    const ok = await authenticateWithBiometrics();
    if (!ok) return;
    const saved = await SecureStore.getItemAsync('campoflow.biometric');
    if (!saved) return;
    const { email: e, password: p } = JSON.parse(saved);
    setEmail(e);
    setPassword(p);
    setLoading(true);
    try {
      const result = await login(e, p);
      if (!result.mfaRequired) router.replace('/(app)/fazendas');
    } catch (err: any) {
      Alert.alert('Erro', err.message ?? 'Falha ao entrar');
    } finally { setLoading(false); }
  };

  const handleLogin = async () => {
    if (!email || !password) { Alert.alert('Erro', 'Preencha e-mail e senha'); return; }
    setLoading(true);
    try {
      const result = await login(email, password, mfaRequired ? mfaCode : undefined);
      if (result.mfaRequired) { setMfaRequired(true); }
      else {
        const bioAvail = await isBiometricAvailable();
        if (bioAvail) await SecureStore.setItemAsync('campoflow.biometric', JSON.stringify({ email, password }));
        router.replace('/(app)/fazendas');
      }
    } catch (err: any) {
      Alert.alert('Erro', err.message ?? 'Falha ao entrar');
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={s.card}>
        <Text style={s.logo}>CampoFlow</Text>
        <Text style={s.subtitle}>Gestão agropecuária</Text>
        <TextInput style={s.input} placeholder="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
        <TextInput style={s.input} placeholder="Senha" value={password} onChangeText={setPassword} secureTextEntry />
        {mfaRequired && <TextInput style={s.input} placeholder="Código MFA" value={mfaCode} onChangeText={setMfaCode} keyboardType="number-pad" maxLength={6} />}
        <TouchableOpacity style={s.button} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.buttonText}>Entrar</Text>}
        </TouchableOpacity>
        {biometricReady && (
          <TouchableOpacity style={s.bioButton} onPress={handleBiometric}>
            <Text style={s.bioText}>Entrar com biometria</Text>
          </TouchableOpacity>
        )}
        <Link href="/(auth)/esqueci-senha" style={s.link}><Text style={s.linkText}>Esqueci minha senha</Text></Link>
        <Link href="/(auth)/cadastrar" style={s.link}><Text style={s.linkText}>Criar conta</Text></Link>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 24, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  logo: { fontSize: 28, fontWeight: '700', color: '#1B5E20', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 24 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, fontSize: 16, marginBottom: 12, backgroundColor: '#fafafa' },
  button: { backgroundColor: '#1B5E20', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  bioButton: { backgroundColor: '#e8f5e9', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 12 },
  bioText: { color: '#1B5E20', fontSize: 15, fontWeight: '600' },
  link: { marginTop: 16, alignSelf: 'center' },
  linkText: { color: '#1B5E20', fontSize: 14 },
});
