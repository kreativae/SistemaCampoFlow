import { ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { theme } from '../lib/theme';

export function Fab({ onPress, icon = 'add' }: { onPress: () => void; icon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <Animated.View entering={ZoomIn.delay(300).springify()} style={ui.fabWrap}>
      <TouchableOpacity
        style={ui.fab}
        activeOpacity={0.85}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onPress(); }}
      >
        <Ionicons name={icon} size={28} color="#fff" />
      </TouchableOpacity>
    </Animated.View>
  );
}

export function AnimatedCard({ children, index = 0, style, onPress }: { children: ReactNode; index?: number; style?: ViewStyle | ViewStyle[]; onPress?: () => void }) {
  const content = onPress ? (
    <Pressable onPress={onPress} style={({ pressed }) => [ui.card, style, pressed && { transform: [{ scale: 0.98 }], opacity: 0.92 }]}>
      {children}
    </Pressable>
  ) : (
    <View style={[ui.card, style as ViewStyle]}>{children}</View>
  );
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 10) * 70).springify().damping(16)}>
      {content}
    </Animated.View>
  );
}

export function IconBadge({ name, color = theme.colors.primary, bg = '#E7F3EB', size = 40 }: { name: keyof typeof Ionicons.glyphMap; color?: string; bg?: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2.6, backgroundColor: bg, justifyContent: 'center', alignItems: 'center' }}>
      <Ionicons name={name} size={size * 0.52} color={color} />
    </View>
  );
}

export function SectionTitle({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  return (
    <Animated.Text entering={FadeInUp.delay(delay)} style={ui.sectionTitle}>
      {children}
    </Animated.Text>
  );
}

const ui = StyleSheet.create({
  fabWrap: { position: 'absolute', bottom: 28, right: 24 },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadow.fab,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
  },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: theme.colors.text, marginBottom: 12, letterSpacing: -0.3 },
});
