import { useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../../src/lib/api';
import { EmptyState } from '../../../src/components/EmptyState';

interface Ticket { id: string; subject: string; status: string; createdAt: string; messages?: { id: string; content: string; fromStaff: boolean; createdAt: string }[] }

export default function SupportScreen() {
  const qc = useQueryClient();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);

  const { data: tickets, isLoading, refetch } = useQuery({
    queryKey: ['tickets'],
    queryFn: () => apiFetch<Ticket[]>('/support/tickets'),
  });

  const createTicket = useMutation({
    mutationFn: (body: { subject: string; message: string }) => apiFetch('/support/tickets', { method: 'POST', body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tickets'] });
      setShowForm(false);
      setSubject('');
      setMessage('');
      Alert.alert('Sucesso', 'Ticket criado');
    },
    onError: (err: any) => Alert.alert('Erro', err.message),
  });

  if (isLoading) return <View style={s.center}><ActivityIndicator size="large" color="#1B5E20" /></View>;

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');

  return (
    <View style={s.container}>
      {showForm ? (
        <View style={s.form}>
          <Text style={s.formTitle}>Novo ticket</Text>
          <TextInput style={s.input} placeholder="Assunto" value={subject} onChangeText={setSubject} />
          <TextInput style={[s.input, s.textArea]} placeholder="Mensagem" value={message} onChangeText={setMessage} multiline numberOfLines={4} textAlignVertical="top" />
          <View style={s.formActions}>
            <TouchableOpacity onPress={() => setShowForm(false)}>
              <Text style={s.cancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.submitBtn} onPress={() => createTicket.mutate({ subject, message })} disabled={!subject || !message}>
              <Text style={s.submitText}>Enviar</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <>
          {!tickets?.length ? (
            <EmptyState icon="🎫" title="Nenhum ticket" subtitle="Abra um ticket para falar com o suporte" />
          ) : (
            <FlatList data={tickets} keyExtractor={(t) => t.id} contentContainerStyle={{ padding: 16 }} onRefresh={refetch} refreshing={false}
              renderItem={({ item }) => (
                <View style={s.card}>
                  <View style={s.row}>
                    <Text style={s.subject}>{item.subject}</Text>
                    <Text style={[s.status, item.status === 'ABERTO' ? s.statusOpen : s.statusClosed]}>{item.status}</Text>
                  </View>
                  <Text style={s.date}>{fmtDate(item.createdAt)}</Text>
                </View>
              )}
            />
          )}
          <TouchableOpacity style={s.fab} onPress={() => setShowForm(true)}>
            <Text style={s.fabText}>+</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  subject: { fontSize: 15, fontWeight: '600', color: '#333', flex: 1 },
  status: { fontSize: 12, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  statusOpen: { backgroundColor: '#e8f5e9', color: '#2e7d32' },
  statusClosed: { backgroundColor: '#f5f5f5', color: '#999' },
  date: { fontSize: 12, color: '#999' },
  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: '#1B5E20', justifyContent: 'center', alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8 },
  fabText: { fontSize: 28, color: '#fff', fontWeight: '300' },
  form: { padding: 16 },
  formTitle: { fontSize: 18, fontWeight: '700', color: '#333', marginBottom: 16 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, fontSize: 16, marginBottom: 12 },
  textArea: { height: 120 },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16, alignItems: 'center' },
  cancelText: { fontSize: 15, color: '#666' },
  submitBtn: { backgroundColor: '#1B5E20', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
