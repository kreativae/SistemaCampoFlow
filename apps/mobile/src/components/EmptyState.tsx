import { View, Text, StyleSheet } from 'react-native';

export function EmptyState({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  return (
    <View style={s.container}>
      <Text style={s.icon}>{icon}</Text>
      <Text style={s.title}>{title}</Text>
      {subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  icon: { fontSize: 48, marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '600', color: '#333', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#666', marginTop: 6, textAlign: 'center' },
});
