import { useState } from 'react';
import { View, Text, TouchableOpacity, Platform, StyleSheet, Modal } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../lib/theme';

interface DateInputProps {
  value: string;
  onChange: (dateStr: string) => void;
  label?: string;
  placeholder?: string;
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDate(s: string): Date {
  if (!s) return new Date();
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}

function formatBR(s: string): string {
  if (!s) return '';
  const [y, m, d] = s.split('-');
  if (!y || !m || !d) return s;
  return `${d}/${m}/${y}`;
}

export function DateInput({ value, onChange, label, placeholder }: DateInputProps) {
  const [show, setShow] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(parseDate(value));

  const openPicker = () => {
    setTempDate(parseDate(value));
    setShow(true);
  };

  const handleChange = (_: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShow(false);
      if (selectedDate) onChange(toISODate(selectedDate));
      return;
    }
    if (selectedDate) setTempDate(selectedDate);
  };

  const confirmIOS = () => {
    onChange(toISODate(tempDate));
    setShow(false);
  };

  const cancelIOS = () => {
    setShow(false);
  };

  return (
    <View>
      {label && <Text style={s.label}>{label}</Text>}
      <TouchableOpacity style={s.input} onPress={openPicker} activeOpacity={0.7}>
        <Text style={[s.inputText, !value && s.placeholder]}>
          {value ? formatBR(value) : (placeholder || 'Selecionar data')}
        </Text>
        <Ionicons name="calendar-outline" size={18} color={theme.colors.textMuted} />
      </TouchableOpacity>

      {Platform.OS === 'android' && show && (
        <DateTimePicker
          value={tempDate}
          mode="date"
          display="default"
          onChange={handleChange}
          locale="pt-BR"
        />
      )}

      {Platform.OS === 'ios' && (
        <Modal visible={show} transparent animationType="slide">
          <View style={s.overlay}>
            <TouchableOpacity style={s.overlayBg} onPress={cancelIOS} activeOpacity={1} />
            <View style={s.pickerSheet}>
              <View style={s.pickerHeader}>
                <TouchableOpacity onPress={cancelIOS}>
                  <Text style={s.cancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={confirmIOS}>
                  <Text style={s.confirmText}>Confirmar</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempDate}
                mode="date"
                display="spinner"
                onChange={handleChange}
                locale="pt-BR"
                style={{ height: 200, alignSelf: 'center', width: '100%' }}
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 4, marginTop: 12 },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12,
    backgroundColor: '#fafafa', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  inputText: { fontSize: 15, color: '#333' },
  placeholder: { color: '#999' },
  overlay: { flex: 1, justifyContent: 'flex-end' },
  overlayBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  pickerSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 30,
    alignItems: 'center',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  cancelText: { fontSize: 16, color: theme.colors.textMuted },
  confirmText: { fontSize: 16, fontWeight: '600', color: theme.colors.primary },
});
