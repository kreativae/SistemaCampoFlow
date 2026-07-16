import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface Props {
  visible: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  destructive?: boolean;
}

export function ConfirmModal({ visible, title, message, onConfirm, onCancel, confirmLabel = 'Confirmar', destructive }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={s.overlay}>
        <View style={s.card}>
          <Text style={s.title}>{title}</Text>
          <Text style={s.message}>{message}</Text>
          <View style={s.actions}>
            <TouchableOpacity style={s.cancelBtn} onPress={onCancel}>
              <Text style={s.cancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.confirmBtn, destructive && s.destructiveBtn]} onPress={onConfirm}>
              <Text style={s.confirmText}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 24 },
  title: { fontSize: 18, fontWeight: '700', color: '#333', marginBottom: 8 },
  message: { fontSize: 15, color: '#666', lineHeight: 22, marginBottom: 20 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  cancelText: { fontSize: 15, color: '#666', fontWeight: '600' },
  confirmBtn: { backgroundColor: '#1B5E20', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  destructiveBtn: { backgroundColor: '#c62828' },
  confirmText: { fontSize: 15, color: '#fff', fontWeight: '600' },
});
