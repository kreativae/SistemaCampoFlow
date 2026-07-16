import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { Link, router } from 'expo-router';
import { useAuth } from '../../src/lib/auth-context';

export default function RegisterScreen() {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!name || !email || !password) { Alert.alert('Erro', 'Preencha todos os campos'); return; }
    setLoading(true);
    try {
      await register(email, password, name);
      router.replace('/(app)/fazendas');
    } catch (err: any) {
      Alert.alert('Erro', err.message ?? 'Falha ao cadastrar');
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={s.card}>
        <Text style={s.title}>Criar conta</Text>
        <TextInput style={s.input} placeholder="Nome" value={name} onChangeText={setName} />
        <TextInput style={s.input} placeholder="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        <TextInput style={s.input} placeholder="Senha" value={password} onChangeText={setPassword} secureTextEntry />
        <TouchableOpacity style={s.button} onPress={handleRegister} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.buttonText}>Cadastrar</Text>}
        </TouchableOpacity>
        <Link href="/(auth)/entrar" style={s.link}><Text style={s.linkText}>Já tenho conta</Text></Link>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 24, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  title: { fontSize: 22, fontWeight: '700', color: '#1B5E20', textAlign: 'center', marginBottom: 24 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, fontSize: 16, marginBottom: 12, backgroundColor: '#fafafa' },
  button: { backgroundColor: '#1B5E20', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { marginTop: 16, alignSelf: 'center' },
  linkText: { color: '#1B5E20', fontSize: 14 },
});
